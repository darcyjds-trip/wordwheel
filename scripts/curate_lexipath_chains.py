from __future__ import annotations

import argparse
import json
from pathlib import Path


MIN_WORD_LENGTH = 4
MAX_WORD_LENGTH = 9
QUALITY_ORDER = ["EXCELLENT", "GOOD", "BORDERLINE", "REJECT"]
DIFFICULTY_LABELS = {
    1: "Easy",
    2: "Easy-Medium",
    3: "Medium",
    4: "Hard",
    5: "Very Hard",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_frequency_ranks(path: Path) -> dict[str, int]:
    words = [
        line.strip().upper()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip().isalpha()
    ]
    filtered = [word for word in words if MIN_WORD_LENGTH <= len(word) <= MAX_WORD_LENGTH]
    return {word: index + 1 for index, word in enumerate(filtered)}


def move_variety(pattern: list[str]) -> int:
    return len(set(pattern))


def shared_word_limit(sequence: list[str]) -> int:
    return 2 if len(sequence) <= 4 else 3


def overlaps_too_much(left: list[str], right: list[str]) -> bool:
    shared = len(set(left) & set(right))
    return shared >= min(shared_word_limit(left), shared_word_limit(right))


def adjacent_pairs(sequence: list[str]) -> set[tuple[str, str]]:
    return {(left, right) for left, right in zip(sequence, sequence[1:])}


def frequency_band(rank: int, total_words: int) -> str:
    ratio = rank / max(1, total_words)
    if ratio <= 0.1:
        return "very common"
    if ratio <= 0.3:
        return "common"
    if ratio <= 0.6:
        return "mid-frequency"
    return "low-frequency"


def estimate_curated_difficulty(
    sequence: list[str],
    pattern: list[str],
    average_rank_score: float,
    unranked_count: int,
) -> int:
    difficulty_score = 0
    difficulty_score += max(0, len(sequence) - 4) * 10
    difficulty_score += pattern.count("R") * 10
    difficulty_score += pattern.count("B") * 8
    difficulty_score += pattern.count("G") * 4
    difficulty_score += pattern.count("Y") * 2
    difficulty_score += max(0, len(sequence[-1]) - 6) * 4
    difficulty_score += unranked_count * 8

    if average_rank_score >= 24:
        difficulty_score -= 10
    elif average_rank_score >= 18:
        difficulty_score -= 4
    elif average_rank_score < 12:
        difficulty_score += 10

    if pattern.count("B") + pattern.count("R") >= 3:
        difficulty_score += 6

    if difficulty_score <= 8:
        return 1
    if difficulty_score <= 20:
        return 2
    if difficulty_score <= 34:
        return 3
    if difficulty_score <= 48:
        return 4
    return 5


def score_chain(chain: dict, frequency_ranks: dict[str, int]) -> tuple[int, str, list[str], dict]:
    sequence = [str(word).upper() for word in chain.get("sequence", [])]
    pattern = [str(step).upper() for step in chain.get("pattern", [])]
    base_score = int(chain.get("score", 0))
    total_ranked_words = len(frequency_ranks)
    ranked_words = [word for word in sequence if word in frequency_ranks]
    unranked_words = [word for word in sequence if word not in frequency_ranks]
    ranked_count = len(ranked_words)
    unranked_count = len(unranked_words)
    coverage_ratio = ranked_count / max(1, len(sequence))
    variety = move_variety(pattern)
    rank_scores = [
        max(0, 30 - int(((frequency_ranks[word] - 1) / max(1, total_ranked_words - 1)) * 30))
        for word in ranked_words
    ]
    average_rank_score = sum(rank_scores) / max(1, len(rank_scores))
    end_rank = frequency_ranks.get(chain.get("end", "").upper())

    curated_score = base_score
    curated_score += int(round(average_rank_score * 2.2))
    curated_score += ranked_count * 6
    curated_score -= unranked_count * 8
    curated_score += variety * 6

    reasons: list[str] = []

    if end_rank is None:
        curated_score -= 14
        reasons.append("end word is unranked in the frequency list")
    else:
        end_band = frequency_band(end_rank, total_ranked_words)
        if end_band == "very common":
            curated_score += 10
            reasons.append("end word is very common")
        elif end_band == "common":
            curated_score += 6
            reasons.append("end word is common")
        elif end_band == "low-frequency":
            curated_score -= 4
            reasons.append("end word is relatively low-frequency")

    if unranked_count == 0:
        curated_score += 8
        reasons.append("all words are ranked in the source list")
    elif unranked_count >= 2:
        curated_score -= 14
        reasons.append("multiple words are unranked in the source list")

    if coverage_ratio >= 0.9:
        curated_score += 8
        reasons.append("very high frequency-list coverage")
    elif coverage_ratio < 0.6:
        curated_score -= 12
        reasons.append("low frequency-list coverage")

    if average_rank_score >= 22:
        curated_score += 10
        reasons.append("strong average frequency rank")
    elif average_rank_score < 12:
        curated_score -= 10
        reasons.append("weak average frequency rank")

    if variety >= 3:
        curated_score += 8
        reasons.append("good move variety")
    elif variety == 1:
        curated_score -= 12
        reasons.append("flat move variety")

    if len(sequence[-1]) >= 8:
        curated_score += 6
        reasons.append("strong ending word length")

    if unranked_count == 0 and average_rank_score >= 20 and curated_score >= 430:
        quality = "EXCELLENT"
    elif unranked_count <= 1 and average_rank_score >= 16 and curated_score >= 375:
        quality = "GOOD"
    elif curated_score >= 320:
        quality = "BORDERLINE"
    else:
        quality = "REJECT"

    curated_difficulty = estimate_curated_difficulty(
        sequence,
        pattern,
        average_rank_score,
        unranked_count,
    )

    meta = {
        "baseScore": base_score,
        "curatedScore": curated_score,
        "rankedWordCount": ranked_count,
        "totalWords": len(sequence),
        "frequencyCoverage": round(coverage_ratio, 2),
        "unrankedWords": unranked_words,
        "averageRankScore": round(average_rank_score, 1),
        "endRank": end_rank,
        "moveVariety": variety,
        "quality": quality,
        "curatedDifficulty": curated_difficulty,
        "difficultyLabel": DIFFICULTY_LABELS[curated_difficulty],
    }
    return curated_score, quality, reasons, meta


def format_chain_block(chain: dict, reasons: list[str], meta: dict) -> str:
    unranked = ", ".join(meta["unrankedWords"]) if meta["unrankedWords"] else "none"
    notes = "; ".join(reasons) if reasons else "no special notes"
    filter_status = meta.get("filterStatus", "UNFILTERED")
    return "\n".join(
        [
            f"Score: {meta['curatedScore']} (base {meta['baseScore']})",
            f"Quality: {meta['quality']}",
            f"Filter status: {filter_status}",
            f"Pattern: {' '.join(chain.get('pattern', []))}",
            f"Sequence: {' -> '.join(chain.get('sequence', []))}",
            f"Difficulty: {meta['curatedDifficulty']}/5 ({meta['difficultyLabel']})",
            f"Ranked words: {meta['rankedWordCount']}/{meta['totalWords']}",
            f"Average rank score: {meta['averageRankScore']}",
            f"Unranked words: {unranked}",
            f"Move variety: {meta['moveVariety']}",
            f"Notes: {notes}",
        ]
    )


def annotate_chains(chains: list[dict], frequency_ranks: dict[str, int]) -> None:
    for chain in chains:
        _, quality, reasons, meta = score_chain(chain, frequency_ranks)
        meta["filterStatus"] = "UNFILTERED"
        chain["curation"] = meta
        chain["curationReasons"] = reasons


def write_review(chains: list[dict], source_path: Path, frequency_path: Path, output_path: Path) -> None:
    sections: dict[str, list[str]] = {quality: [] for quality in QUALITY_ORDER}

    for chain in chains:
        quality = chain["curation"]["quality"]
        reasons = chain.get("curationReasons", [])
        sections[quality].append(format_chain_block(chain, reasons, chain["curation"]))

    lines = [
        "LEXIPATH REVIEW",
        f"Generated source: {source_path}",
        f"Frequency-ranked source list: {frequency_path}",
        "",
    ]

    for quality in QUALITY_ORDER:
        lines.append(f"=== {quality} ===")
        if sections[quality]:
            lines.extend(sections[quality])
        else:
            lines.append("No chains in this bucket.")
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_quality_json(chains: list[dict], output_path: Path) -> None:
    payload = {
        "chains": chains,
        "count": len(chains),
    }
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def select_distinct_chains(chains: list[dict]) -> tuple[list[dict], int, int]:
    kept: list[dict] = []
    overlap_rejections = 0
    pair_rejections = 0
    pair_counts: dict[tuple[tuple[str, ...], tuple[str, str]], int] = {}

    for chain in chains:
        if chain["curation"]["quality"] not in {"EXCELLENT", "GOOD", "BORDERLINE"}:
            chain["curation"]["filterStatus"] = "SKIPPED_LOW_QUALITY"
            continue
        chain_pattern = tuple(chain.get("pattern", []))
        if any(
            tuple(existing.get("pattern", [])) == chain_pattern
            and overlaps_too_much(chain["sequence"], existing["sequence"])
            for existing in kept
        ):
            chain["curation"]["filterStatus"] = "REJECTED_OVERLAP"
            chain["curation"]["rejectionReason"] = "overlaps heavily with a stronger chain in the same pattern"
            chain["curationReasons"] = [*chain.get("curationReasons", []), "overlaps heavily with a stronger chain in the same pattern"]
            overlap_rejections += 1
            continue
        chain_pairs = adjacent_pairs(chain["sequence"])
        overused_pairs = [
            pair
            for pair in chain_pairs
            if pair_counts.get((chain_pattern, pair), 0) >= 2
        ]
        if overused_pairs:
            chain["curation"]["filterStatus"] = "REJECTED_PAIR_REUSE"
            chain["curation"]["rejectionReason"] = "reuses an adjacent word pair more than twice in the same pattern"
            chain["curationReasons"] = [
                *chain.get("curationReasons", []),
                "reuses an adjacent word pair more than twice in the same pattern",
            ]
            pair_rejections += 1
            continue
        chain["curation"]["filterStatus"] = "KEPT"
        kept.append(chain)
        for pair in chain_pairs:
            key = (chain_pattern, pair)
            pair_counts[key] = pair_counts.get(key, 0) + 1

    return kept, overlap_rejections, pair_rejections


def write_curated_json(chains: list[dict], output_path: Path) -> tuple[int, int, int]:
    kept, overlap_rejections, pair_rejections = select_distinct_chains(chains)
    payload = {
        "chains": kept,
        "count": len(kept),
    }
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    return len(kept), overlap_rejections, pair_rejections


def difficulty_histogram(chains: list[dict]) -> dict[int, int]:
    histogram = {level: 0 for level in DIFFICULTY_LABELS}
    for chain in chains:
        level = chain.get("curation", {}).get("curatedDifficulty")
        if level in histogram:
            histogram[level] += 1
    return histogram


def main() -> None:
    parser = argparse.ArgumentParser(description="Curate generated LexiPath chains into a human-friendly review.")
    parser.add_argument(
        "--input",
        default="data/lexipath/generated.json",
        help="Generated LexiPath JSON to review.",
    )
    parser.add_argument(
        "--frequency-words",
        default="data/lexipath/word list.txt",
        help="Path to the ranked frequency word list.",
    )
    parser.add_argument(
        "--review-output",
        default="data/lexipath/generated-review.txt",
        help="Where to write the human-friendly review report.",
    )
    parser.add_argument(
        "--quality-output",
        default="data/lexipath/generated-quality.json",
        help="Where to write the step-1 quality JSON before overlap/pair filtering.",
    )
    parser.add_argument(
        "--quality-review-output",
        default="data/lexipath/generated-quality-review.txt",
        help="Where to write the step-1 quality review before overlap/pair filtering.",
    )
    parser.add_argument(
        "--curated-output",
        default="data/lexipath/generated-curated.json",
        help="Where to write the filtered JSON of strong chains.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    frequency_path = Path(args.frequency_words)
    review_output = Path(args.review_output)
    quality_output = Path(args.quality_output)
    quality_review_output = Path(args.quality_review_output)
    curated_output = Path(args.curated_output)

    payload = load_json(input_path)
    chains = payload.get("chains", [])
    frequency_ranks = load_frequency_ranks(frequency_path)

    chains.sort(
        key=lambda chain: score_chain(chain, frequency_ranks)[0],
        reverse=True,
    )

    review_output.parent.mkdir(parents=True, exist_ok=True)
    quality_output.parent.mkdir(parents=True, exist_ok=True)
    quality_review_output.parent.mkdir(parents=True, exist_ok=True)
    curated_output.parent.mkdir(parents=True, exist_ok=True)

    annotate_chains(chains, frequency_ranks)
    write_quality_json(chains, quality_output)
    write_review(chains, input_path, frequency_path, quality_review_output)
    kept_count, overlap_rejections, pair_rejections = write_curated_json(chains, curated_output)
    write_review(chains, input_path, frequency_path, review_output)

    excellent = sum(1 for chain in chains if chain["curation"]["quality"] == "EXCELLENT")
    good = sum(1 for chain in chains if chain["curation"]["quality"] == "GOOD")
    borderline = sum(1 for chain in chains if chain["curation"]["quality"] == "BORDERLINE")
    reject = sum(1 for chain in chains if chain["curation"]["quality"] == "REJECT")
    reviewable_chains = [
        chain
        for chain in chains
        if chain["curation"]["quality"] in {"EXCELLENT", "GOOD", "BORDERLINE"}
    ]
    kept_difficulties = difficulty_histogram(reviewable_chains)

    print(f"Reviewed {len(chains)} chains")
    print(f"Excellent: {excellent}")
    print(f"Good: {good}")
    print(f"Borderline: {borderline}")
    print(f"Reject: {reject}")
    print(f"Thrown out for overlap: {overlap_rejections}")
    print(f"Thrown out for shared word pairs: {pair_rejections}")
    print(f"Kept after filtering: {kept_count}")
    print("Difficulty breakdown (excellent, good, and borderline chains):")
    for level, label in DIFFICULTY_LABELS.items():
        print(f"  {label}: {kept_difficulties[level]}")
    print(f"Wrote quality JSON to {quality_output}")
    print(f"Wrote quality review to {quality_review_output}")
    print(f"Wrote review to {review_output}")
    print(f"Wrote curated JSON to {curated_output}")
if __name__ == "__main__":
    main()
