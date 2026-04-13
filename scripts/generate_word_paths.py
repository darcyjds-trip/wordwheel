from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import DefaultDict, Iterable


MIN_WORD_LENGTH = 4
MAX_WORD_LENGTH = 7
DEFAULT_PATTERNS = ["GGG", "GRGG", "RGGG", "GGRG", "GGGG"]
TRIVIAL_SUFFIXES = ("S", "ES", "ED", "ER", "ERS", "ING", "LY")


@dataclass(frozen=True)
class PathResult:
    pattern: list[str]
    sequence: list[str]
    start_length: int
    end_length: int
    green_moves: int
    red_moves: int
    score: int


def load_words(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def normalize_filter_words(words: Iterable[str]) -> list[str]:
    normalized = {
        raw.strip().upper()
        for raw in words
        if raw and raw.strip().isalpha()
    }
    return sorted(
        word for word in normalized
        if MIN_WORD_LENGTH <= len(word) <= MAX_WORD_LENGTH
    )


def signature(word: str) -> str:
    return "".join(sorted(word))


def deletion_signatures(word: str) -> set[str]:
    sig = signature(word)
    return {sig[:index] + sig[index + 1:] for index in range(len(sig))}


def build_signature_maps(words: Iterable[str]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    by_signature: DefaultDict[str, list[str]] = defaultdict(list)
    by_length: DefaultDict[int, list[str]] = defaultdict(list)

    for word in words:
        by_signature[signature(word)].append(word)
        by_length[len(word)].append(word)

    return dict(by_signature), dict(by_length)


def build_green_edges(words: Iterable[str]) -> dict[str, list[str]]:
    # A green move works if removing one letter from the longer word leaves
    # the exact multiset signature of the shorter word.
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
    # A red move works if two same-length words share a deletion signature,
    # which means one letter can be swapped for a different one after rearranging.
    edges: DefaultDict[str, set[str]] = defaultdict(set)

    for length, words in words_by_length.items():
        buckets: DefaultDict[str, set[str]] = defaultdict(set)
        for word in words:
            for deleted in deletion_signatures(word):
                buckets[deleted].add(word)

        for neighbors in buckets.values():
            neighbor_list = sorted(neighbors)
            for index, left in enumerate(neighbor_list):
                left_signature = signature(left)
                for right in neighbor_list[index + 1:]:
                    if left_signature == signature(right):
                        continue
                    edges[left].add(right)
                    edges[right].add(left)

    return {word: sorted(neighbors) for word, neighbors in edges.items()}


def move_is_trivial_suffix(left: str, right: str) -> bool:
    if len(right) != len(left) + 1:
        return False
    return any(right == f"{left}{suffix}" for suffix in TRIVIAL_SUFFIXES)


def score_sequence(sequence: list[str], pattern: list[str]) -> int:
    green_moves = pattern.count("G")
    red_moves = pattern.count("R")
    end_length = len(sequence[-1])
    distinct_lengths = len({len(word) for word in sequence})
    unique_signatures = len({signature(word) for word in sequence})
    trivial_penalty = sum(
        12 for left, right, move in zip(sequence, sequence[1:], pattern)
        if move == "G" and move_is_trivial_suffix(left, right)
    )
    repeated_letters_bonus = sum(len(set(word)) for word in sequence)

    return (
        end_length * 30
        + green_moves * 18
        + red_moves * 24
        + distinct_lengths * 10
        + unique_signatures * 6
        + repeated_letters_bonus
        - trivial_penalty
    )


def search_sequences(
    words: Iterable[str],
    green_edges: dict[str, list[str]],
    red_edges: dict[str, list[str]],
    patterns: list[list[str]],
    max_results_per_pattern: int,
) -> list[PathResult]:
    # We search pattern-by-pattern so content designers can ask for specific
    # puzzle rhythms like G,G,G or G,R,G,G.
    results: list[PathResult] = []
    word_list = sorted(words)

    def dfs(sequence: list[str], pattern: list[str], step_index: int, seen: set[str], bucket: list[PathResult]) -> None:
        if len(bucket) >= max_results_per_pattern:
            return

        if step_index == len(pattern):
            bucket.append(
                PathResult(
                    pattern=pattern,
                    sequence=sequence.copy(),
                    start_length=len(sequence[0]),
                    end_length=len(sequence[-1]),
                    green_moves=pattern.count("G"),
                    red_moves=pattern.count("R"),
                    score=score_sequence(sequence, pattern),
                )
            )
            return

        current = sequence[-1]
        move = pattern[step_index]
        neighbor_map = green_edges if move == "G" else red_edges

        for candidate in neighbor_map.get(current, []):
            if candidate in seen:
                continue
            seen.add(candidate)
            sequence.append(candidate)
            dfs(sequence, pattern, step_index + 1, seen, bucket)
            sequence.pop()
            seen.remove(candidate)

    for pattern in patterns:
        bucket: list[PathResult] = []
        for start_word in word_list:
            dfs([start_word], pattern, 0, {start_word}, bucket)
        bucket.sort(key=lambda item: (-item.score, item.sequence))
        results.extend(bucket[:max_results_per_pattern])

    return sorted(results, key=lambda item: (-item.score, item.pattern, item.sequence))


def export_json(results: list[PathResult], output_path: Path, source_path: Path) -> None:
    payload = {
        "source": str(source_path),
        "results": [
            {
                "pattern": result.pattern,
                "sequence": result.sequence,
                "startLength": result.start_length,
                "endLength": result.end_length,
                "greenMoves": result.green_moves,
                "redMoves": result.red_moves,
                "score": result.score,
            }
            for result in results
        ]
    }
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def parse_patterns(raw_patterns: list[str]) -> list[list[str]]:
    parsed: list[list[str]] = []
    for raw in raw_patterns:
        compact = raw.strip().upper().replace(",", "")
        if not compact:
            continue
        if any(char not in {"G", "R"} for char in compact):
            raise ValueError(f"Invalid pattern '{raw}'. Use only G and R.")
        parsed.append(list(compact))
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate structured word-path puzzle candidates from a raw word list."
    )
    parser.add_argument(
        "--words",
        default="data/popular.txt",
        help="Path to a raw newline-separated words file. Default: data/popular.txt",
    )
    parser.add_argument(
        "--output",
        default="data/word-path-results.json",
        help="Where to write the generated JSON results.",
    )
    parser.add_argument(
        "--patterns",
        nargs="*",
        default=DEFAULT_PATTERNS,
        help="Move patterns to search, like GGG GRGG RGGG.",
    )
    parser.add_argument(
        "--limit-per-pattern",
        type=int,
        default=50,
        help="Maximum number of ranked results to keep per pattern.",
    )
    args = parser.parse_args()

    source_path = Path(args.words)
    output_path = Path(args.output)

    raw_words = load_words(source_path)
    candidate_words = normalize_filter_words(raw_words)
    _, words_by_length = build_signature_maps(candidate_words)
    green_edges = build_green_edges(candidate_words)
    red_edges = build_red_edges(words_by_length)
    patterns = parse_patterns(args.patterns)
    results = search_sequences(
        candidate_words,
        green_edges,
        red_edges,
        patterns,
        max_results_per_pattern=args.limit_per_pattern,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    export_json(results, output_path, source_path)

    print(f"Loaded {len(raw_words)} raw entries")
    print(f"Kept {len(candidate_words)} candidate words")
    print(f"Built {sum(len(v) for v in green_edges.values())} green edges")
    print(f"Built {sum(len(v) for v in red_edges.values())} red edges")
    print(f"Wrote {len(results)} puzzle paths to {output_path}")


if __name__ == "__main__":
    main()
