from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, DefaultDict, Iterable


MIN_WORD_LENGTH = 4
MAX_WORD_LENGTH = 9
DEFAULT_MIN_CHAIN_WORDS = 4
DEFAULT_MAX_CHAIN_WORDS = 6
DEFAULT_PATTERNS = ["YRG", "YRY", "RYG", "YBR", "BRY", "BYRG", "YGBR", "YGRY", "RYRY", "YRYR", "BYRGR", "YGRYR", "RYRYR", "YRYRY"]
DEFAULT_LIMIT_PER_PATTERN = 400
TRIVIAL_SUFFIXES = ("S", "ES", "ED", "ER", "ERS", "ING", "LY")
SIMPLE_INFLECTION_SUFFIXES = ("S", "ES", "ED", "ING")
MOVE_CODES = {"B", "Y", "G", "R"}


@dataclass(frozen=True)
class ChainResult:
    sequence: list[str]
    pattern: list[str]
    start: str
    end: str
    difficulty: int
    score: int
    blue_moves: int
    yellow_moves: int
    green_moves: int
    red_moves: int


def load_words(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def normalize_filter_words(words: Iterable[str]) -> list[str]:
    normalized = {
        raw.strip().upper()
        for raw in words
        if raw and raw.strip().isalpha()
    }
    return sorted(
        (word for word in normalized if MIN_WORD_LENGTH <= len(word) <= MAX_WORD_LENGTH),
        key=lambda word: (len(word), word),
    )


def filter_against_reference(words: Iterable[str], reference_words: Iterable[str]) -> list[str]:
    reference_pool = set(normalize_filter_words(reference_words))
    return [word for word in normalize_filter_words(words) if word in reference_pool]


def signature(word: str) -> str:
    return "".join(sorted(word))


def deletion_signatures(word: str) -> set[str]:
    sig = signature(word)
    return {sig[:index] + sig[index + 1:] for index in range(len(sig))}


def is_subsequence(source: str, target: str) -> bool:
    source_index = 0
    target_index = 0
    while source_index < len(source) and target_index < len(target):
        if source[source_index] == target[target_index]:
            source_index += 1
        target_index += 1
    return source_index == len(source)


def is_blue_move(previous: str, next_word: str) -> bool:
    return (
        len(previous) == len(next_word)
        and previous != next_word
        and signature(previous) == signature(next_word)
    )


def is_yellow_move(previous: str, next_word: str) -> bool:
    return len(next_word) == len(previous) + 1 and is_subsequence(previous, next_word)


def is_green_move(previous: str, next_word: str) -> bool:
    if len(next_word) != len(previous) + 1:
        return False
    return signature(previous) in deletion_signatures(next_word)


def is_red_move(previous: str, next_word: str) -> bool:
    if len(previous) != len(next_word) or previous == next_word:
        return False
    differences = sum(1 for left, right in zip(previous, next_word) if left != right)
    return differences == 1


def build_index_maps(words: Iterable[str]) -> tuple[dict[str, list[str]], dict[int, list[str]]]:
    by_signature: DefaultDict[str, list[str]] = defaultdict(list)
    by_length: DefaultDict[int, list[str]] = defaultdict(list)

    for word in words:
        by_signature[signature(word)].append(word)
        by_length[len(word)].append(word)

    return dict(by_signature), dict(by_length)


def build_blue_edges(words_by_signature: dict[str, list[str]]) -> dict[str, list[str]]:
    edges: DefaultDict[str, set[str]] = defaultdict(set)
    for neighbors in words_by_signature.values():
        if len(neighbors) < 2:
            continue
        for word in neighbors:
            edges[word].update(other for other in neighbors if other != word)
    return {word: sorted(neighbors) for word, neighbors in edges.items()}


def build_yellow_edges(words_by_length: dict[int, list[str]]) -> dict[str, list[str]]:
    edges: DefaultDict[str, set[str]] = defaultdict(set)
    for length in range(MIN_WORD_LENGTH, MAX_WORD_LENGTH):
        shorter_words = words_by_length.get(length, [])
        longer_words = words_by_length.get(length + 1, [])
        if not shorter_words or not longer_words:
            continue
        for shorter in shorter_words:
            for longer in longer_words:
                if is_yellow_move(shorter, longer):
                    edges[shorter].add(longer)
    return {word: sorted(neighbors) for word, neighbors in edges.items()}


def build_green_edges(words: Iterable[str]) -> dict[str, list[str]]:
    edges: DefaultDict[str, set[str]] = defaultdict(set)
    longer_by_deleted_signature: DefaultDict[str, set[str]] = defaultdict(set)

    for word in words:
        if len(word) == MIN_WORD_LENGTH:
            continue
        for deleted in deletion_signatures(word):
            longer_by_deleted_signature[deleted].add(word)

    for word in words:
        edges[word].update(longer_by_deleted_signature.get(signature(word), set()))

    return {word: sorted(neighbors) for word, neighbors in edges.items()}


def build_red_edges(words_by_length: dict[int, list[str]]) -> dict[str, list[str]]:
    edges: DefaultDict[str, set[str]] = defaultdict(set)
    for words in words_by_length.values():
        for index, left in enumerate(words):
            for right in words[index + 1:]:
                if is_red_move(left, right):
                    edges[left].add(right)
                    edges[right].add(left)

    return {word: sorted(neighbors) for word, neighbors in edges.items()}


def move_is_trivial_suffix(left: str, right: str, move: str) -> bool:
    if move not in {"Y", "G"} or len(right) != len(left) + 1:
        return False
    return any(right == f"{left}{suffix}" for suffix in TRIVIAL_SUFFIXES)


def is_simple_inflection_of(base: str, candidate: str) -> bool:
    if len(candidate) <= len(base):
        return False

    direct_forms = {f"{base}{suffix}" for suffix in SIMPLE_INFLECTION_SUFFIXES}
    if candidate in direct_forms:
        return True

    if base.endswith("E"):
        stem = base[:-1]
        if candidate in {f"{stem}ING", f"{stem}ED"}:
            return True

    return False


def shared_letter_ratio(left: str, right: str) -> float:
    left_counts = defaultdict(int)
    right_counts = defaultdict(int)
    for letter in left:
        left_counts[letter] += 1
    for letter in right:
        right_counts[letter] += 1

    shared = sum(min(left_counts[letter], right_counts[letter]) for letter in set(left_counts) | set(right_counts))
    longest = max(len(left), len(right), 1)
    return shared / longest


def interior_insertion(previous: str, next_word: str) -> bool:
    if len(next_word) != len(previous) + 1:
        return False
    for index in range(len(next_word)):
        if next_word[:index] + next_word[index + 1:] == previous:
            return 0 < index < len(next_word) - 1
    return False


def chain_has_trivial_suffix(sequence: list[str], pattern: list[str]) -> bool:
    return any(
        move_is_trivial_suffix(left, right, move)
        for left, right, move in zip(sequence, sequence[1:], pattern)
    )


def chain_reuses_simple_inflection(sequence: list[str]) -> bool:
    for later_index, candidate in enumerate(sequence[1:], start=1):
        for base in sequence[:later_index]:
            if is_simple_inflection_of(base, candidate):
                return True
    return False


def chain_has_redundant_length_profile(sequence: list[str]) -> bool:
    lengths = [len(word) for word in sequence]
    same_length_steps = sum(1 for left, right in zip(lengths, lengths[1:]) if left == right)
    return same_length_steps >= 3


def blue_overuse_penalty(pattern: list[str]) -> int:
    blue_moves = pattern.count("B")
    if blue_moves <= 1:
        return 0
    return (blue_moves - 1) * 18


def repeated_root_penalty(sequence: list[str]) -> int:
    penalty = 0
    for left, right in zip(sequence, sequence[1:]):
        ratio = shared_letter_ratio(left, right)
        if ratio >= 0.85:
            penalty += 16
        elif ratio >= 0.7:
            penalty += 8
    return penalty


def monotony_penalty(sequence: list[str], pattern: list[str]) -> int:
    same_length_runs = 0
    for left, right, move in zip(sequence, sequence[1:], pattern):
        if len(left) == len(right) and move in {"B", "R"}:
            same_length_runs += 1
    return max(0, same_length_runs - 1) * 8


def journey_penalty(sequence: list[str]) -> int:
    if len(sequence) < 2:
        return 0

    start = sequence[0]
    end = sequence[-1]
    ratio = shared_letter_ratio(start, end)
    penalty = 0

    if ratio >= 0.85:
        penalty += 24
    elif ratio >= 0.7:
        penalty += 12

    if signature(start) == signature(end):
        penalty += 24

    if start in end or end in start:
        penalty += 10

    return penalty


def chain_is_boring(sequence: list[str], pattern: list[str]) -> bool:
    if len(set(sequence)) != len(sequence):
        return True
    if chain_has_trivial_suffix(sequence, pattern):
        return True
    if chain_reuses_simple_inflection(sequence):
        return True
    if chain_has_redundant_length_profile(sequence):
        return True
    return False


def score_sequence(sequence: list[str], pattern: list[str]) -> int:
    counts = {
        "B": pattern.count("B"),
        "Y": pattern.count("Y"),
        "G": pattern.count("G"),
        "R": pattern.count("R"),
    }
    end_length = len(sequence[-1])
    distinct_lengths = len({len(word) for word in sequence})
    unique_signatures = len({signature(word) for word in sequence})
    move_variety_bonus = len({move for move in pattern}) * 18
    trivial_penalty = sum(
        14 for left, right, move in zip(sequence, sequence[1:], pattern)
        if move_is_trivial_suffix(left, right, move)
    )
    repeated_word_shapes_penalty = max(0, len(sequence) - unique_signatures) * 10
    vowel_balance_bonus = sum(1 for word in sequence if any(letter in "AEIOU" for letter in word))
    yellow_interior_bonus = sum(
        8 for left, right, move in zip(sequence, sequence[1:], pattern)
        if move == "Y" and interior_insertion(left, right)
    )

    return (
        end_length * 32
        + counts["B"] * 8
        + counts["Y"] * 18
        + counts["G"] * 20
        + counts["R"] * 24
        + distinct_lengths * 10
        + unique_signatures * 6
        + move_variety_bonus
        + vowel_balance_bonus
        + yellow_interior_bonus
        - trivial_penalty
        - repeated_word_shapes_penalty
        - blue_overuse_penalty(pattern)
        - repeated_root_penalty(sequence)
        - monotony_penalty(sequence, pattern)
        - journey_penalty(sequence)
    )


def estimate_difficulty(sequence: list[str], pattern: list[str]) -> int:
    score = (
        len(pattern)
        + pattern.count("R")
        + pattern.count("B")
        + max(0, len(sequence[-1]) - 5)
    )
    return max(1, min(5, 1 + score // 2))


def violates_pattern_constraints(pattern: list[str], previous_move: str | None) -> bool:
    if previous_move == "B" and pattern and pattern[0] == "B":
        return True
    return False


def search_sequences(
    words: Iterable[str],
    edge_maps: dict[str, dict[str, list[str]]],
    patterns: list[list[str]],
    max_results_per_pattern: int | None,
    progress_callback: Callable[[str, list[ChainResult], list[ChainResult]], None] | None = None,
) -> list[ChainResult]:
    results: list[ChainResult] = []
    word_list = sorted(words, key=lambda word: (len(word), word))
    seen_sequences: set[tuple[tuple[str, ...], tuple[str, ...]]] = set()
    progress_interval = max(1, len(word_list) // 20)

    def dfs(
        sequence: list[str],
        pattern: list[str],
        step_index: int,
        seen: set[str],
        bucket: list[ChainResult],
        previous_move: str | None,
    ) -> None:
        if max_results_per_pattern is not None and len(bucket) >= max_results_per_pattern:
            return

        if step_index == len(pattern):
            if chain_is_boring(sequence, pattern):
                return
            key = (tuple(sequence), tuple(pattern))
            if key in seen_sequences:
                return
            seen_sequences.add(key)
            score = score_sequence(sequence, pattern)
            bucket.append(
                ChainResult(
                    sequence=sequence.copy(),
                    pattern=pattern.copy(),
                    start=sequence[0],
                    end=sequence[-1],
                    difficulty=estimate_difficulty(sequence, pattern),
                    score=score,
                    blue_moves=pattern.count("B"),
                    yellow_moves=pattern.count("Y"),
                    green_moves=pattern.count("G"),
                    red_moves=pattern.count("R"),
                )
            )
            return

        move = pattern[step_index]
        if violates_pattern_constraints([move], previous_move):
            return

        current = sequence[-1]
        for candidate in edge_maps[move].get(current, []):
            if candidate in seen:
                continue
            seen.add(candidate)
            sequence.append(candidate)
            dfs(sequence, pattern, step_index + 1, seen, bucket, move)
            sequence.pop()
            seen.remove(candidate)

    for pattern in patterns:
        bucket: list[ChainResult] = []
        pattern_label = "".join(pattern)
        print(f"Exploring pattern {pattern_label} across {len(word_list)} start words...")
        for start_index, start_word in enumerate(word_list, start=1):
            dfs([start_word], pattern, 0, {start_word}, bucket, None)
            if start_index == len(word_list) or start_index % progress_interval == 0:
                print(
                    f"  Pattern {pattern_label}: processed {start_index}/{len(word_list)} start words, "
                    f"found {len(bucket)} chains so far"
                )
        bucket.sort(key=lambda item: (-item.score, item.sequence))
        kept_bucket = bucket if max_results_per_pattern is None else bucket[:max_results_per_pattern]
        print(f"Finished pattern {pattern_label}: kept {len(kept_bucket)} chains")
        results.extend(kept_bucket)
        if progress_callback is not None:
            progress_callback(pattern_label, kept_bucket, results)

    return sorted(results, key=lambda item: (-item.score, item.pattern, item.sequence))


def export_json(results: list[ChainResult], output_path: Path, source_path: Path) -> None:
    payload = {
        "source": str(source_path),
        "chains": [
            {
                "id": f"generated_{index + 1:04d}",
                "sequence": result.sequence,
                "pattern": result.pattern,
                "start": result.start,
                "end": result.end,
                "difficulty": result.difficulty,
                "score": result.score,
                "blueMoves": result.blue_moves,
                "yellowMoves": result.yellow_moves,
                "greenMoves": result.green_moves,
                "redMoves": result.red_moves,
            }
            for index, result in enumerate(results)
        ],
    }
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def append_log(log_path: Path, message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"{line}\n")


def parse_patterns(raw_patterns: list[str]) -> list[list[str]]:
    parsed: list[list[str]] = []
    for raw in raw_patterns:
        compact = raw.strip().upper().replace(",", "")
        if not compact:
            continue
        if any(char not in MOVE_CODES for char in compact):
            raise ValueError(f"Invalid pattern '{raw}'. Use only B, Y, G, and R.")
        if "BB" in compact:
            raise ValueError(f"Invalid pattern '{raw}'. Adjacent blue moves are not allowed.")
        parsed.append(list(compact))
    return parsed


def generate_patterns(min_chain_words: int, max_chain_words: int) -> list[list[str]]:
    return parse_patterns(DEFAULT_PATTERNS)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate LexiPath puzzle candidates from a raw word list."
    )
    parser.add_argument(
        "--words",
        default="data/popular.txt",
        help="Path to a raw newline-separated words file. Default: data/popular.txt",
    )
    parser.add_argument(
        "--reference-words",
        default="",
        help="Optional second dictionary source. Only words present in both files are kept.",
    )
    parser.add_argument(
        "--output",
        default="data/lexipath/generated.json",
        help="Where to write the generated JSON results.",
    )
    parser.add_argument(
        "--log",
        default="",
        help="Optional path for a run log. Defaults to the output path with .log appended.",
    )
    parser.add_argument(
        "--patterns",
        nargs="*",
        default=DEFAULT_PATTERNS,
        help="Move patterns to search. Defaults to a curated LexiPath set.",
    )
    parser.add_argument(
        "--min-chain-words",
        type=int,
        default=DEFAULT_MIN_CHAIN_WORDS,
        help="Minimum number of words in a generated chain. Default: 4",
    )
    parser.add_argument(
        "--max-chain-words",
        type=int,
        default=DEFAULT_MAX_CHAIN_WORDS,
        help="Maximum number of words in a generated chain. Default: 6",
    )
    parser.add_argument(
        "--limit-per-pattern",
        type=int,
        default=DEFAULT_LIMIT_PER_PATTERN,
        help="Maximum number of ranked results to keep per pattern. Default: 400",
    )
    args = parser.parse_args()

    source_path = Path(args.words)
    output_path = Path(args.output)
    log_path = Path(args.log) if args.log else output_path.with_suffix(".log")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("", encoding="utf-8")
    results: list[ChainResult] = []

    try:
        raw_words = load_words(source_path)
        append_log(log_path, f"Loaded {len(raw_words)} raw entries from {source_path}")
        if args.reference_words:
            reference_path = Path(args.reference_words)
            reference_words = load_words(reference_path)
            append_log(log_path, f"Loaded {len(reference_words)} reference entries from {reference_path}")
            candidate_words = filter_against_reference(raw_words, reference_words)
        else:
            candidate_words = normalize_filter_words(raw_words)
        append_log(log_path, f"Kept {len(candidate_words)} candidate words after filtering")

        words_by_signature, words_by_length = build_index_maps(candidate_words)
        edge_maps = {
            "B": build_blue_edges(words_by_signature),
            "Y": build_yellow_edges(words_by_length),
            "G": build_green_edges(candidate_words),
            "R": build_red_edges(words_by_length),
        }
        append_log(log_path, f"Built {sum(len(v) for v in edge_maps['B'].values())} blue edges")
        append_log(log_path, f"Built {sum(len(v) for v in edge_maps['Y'].values())} yellow edges")
        append_log(log_path, f"Built {sum(len(v) for v in edge_maps['G'].values())} green edges")
        append_log(log_path, f"Built {sum(len(v) for v in edge_maps['R'].values())} red edges")

        patterns = parse_patterns(args.patterns) if args.patterns else generate_patterns(args.min_chain_words, args.max_chain_words)
        append_log(log_path, f"Exploring {len(patterns)} patterns across chain lengths {args.min_chain_words}-{args.max_chain_words}")

        def checkpoint(pattern_label: str, kept_bucket: list[ChainResult], all_results: list[ChainResult]) -> None:
            export_json(all_results, output_path, source_path)
            append_log(
                log_path,
                f"Checkpoint after pattern {pattern_label}: kept {len(kept_bucket)} chains this pattern, {len(all_results)} total",
            )

        results = search_sequences(
            candidate_words,
            edge_maps,
            patterns,
            max_results_per_pattern=args.limit_per_pattern or None,
            progress_callback=checkpoint,
        )

        if args.reference_words:
            append_log(log_path, f"Cross-checked against {args.reference_words}")
        append_log(log_path, f"Wrote {len(results)} LexiPath chains to {output_path}")
    finally:
        export_json(results, output_path, source_path)
        append_log(log_path, f"Final checkpoint saved {len(results)} chains to {output_path}")


if __name__ == "__main__":
    main()
