from __future__ import annotations

import argparse
import json
from pathlib import Path


REVIEWABLE_QUALITIES = {"EXCELLENT", "GOOD", "BORDERLINE"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict) -> None:
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def sort_chains(chains: list[dict]) -> list[dict]:
    return sorted(
        chains,
        key=lambda chain: (
            -int(chain.get("curation", {}).get("curatedScore", 0)),
            chain.get("id", ""),
        ),
    )


def shared_word_limit(sequence: list[str]) -> int:
    return 2 if len(sequence) <= 4 else 3


def overlaps_too_much(left: list[str], right: list[str]) -> bool:
    shared = len(set(left) & set(right))
    return shared >= min(shared_word_limit(left), shared_word_limit(right))


def adjacent_pairs(sequence: list[str]) -> set[tuple[str, str]]:
    return {(left, right) for left, right in zip(sequence, sequence[1:])}


def summarize_filter_statuses(chains: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for chain in chains:
        status = chain.get("curation", {}).get("filterStatus", "UNKNOWN")
        counts[status] = counts.get(status, 0) + 1
    return counts


def apply_filters(chains: list[dict]) -> tuple[list[dict], int, int]:
    kept: list[dict] = []
    overlap_rejections = 0
    pair_rejections = 0
    pair_counts: dict[tuple[tuple[str, ...], tuple[str, str]], int] = {}

    for chain in sort_chains(chains):
        curation = chain.setdefault("curation", {})
        reasons = list(chain.get("curationReasons", []))
        quality = curation.get("quality")

        if quality not in REVIEWABLE_QUALITIES:
            curation["filterStatus"] = "SKIPPED_LOW_QUALITY"
            chain["curationReasons"] = reasons
            continue

        chain_pattern = tuple(chain.get("pattern", []))
        same_pattern_kept = [
            existing
            for existing in kept
            if tuple(existing.get("pattern", [])) == chain_pattern
        ]
        overlap_matches = [
            existing
            for existing in same_pattern_kept
            if overlaps_too_much(chain.get("sequence", []), existing.get("sequence", []))
        ]
        if len(overlap_matches) >= 2:
            curation["filterStatus"] = "REJECTED_OVERLAP"
            curation["rejectionReason"] = "overlaps heavily with two stronger chains in the same pattern"
            chain["curationReasons"] = [
                *reasons,
                "overlaps heavily with two stronger chains in the same pattern",
            ]
            overlap_rejections += 1
            continue

        chain_pairs = adjacent_pairs(chain.get("sequence", []))
        overused_pairs = [
            pair
            for pair in chain_pairs
            if pair_counts.get((chain_pattern, pair), 0) >= 2
        ]
        if overused_pairs:
            curation["filterStatus"] = "REJECTED_PAIR_REUSE"
            curation["rejectionReason"] = "reuses an adjacent word pair more than twice in the same pattern"
            chain["curationReasons"] = [
                *reasons,
                "reuses an adjacent word pair more than twice in the same pattern",
            ]
            pair_rejections += 1
            continue

        curation["filterStatus"] = "KEPT"
        curation.pop("rejectionReason", None)
        chain["curationReasons"] = reasons
        kept.append(chain)
        for pair in chain_pairs:
            key = (chain_pattern, pair)
            pair_counts[key] = pair_counts.get(key, 0) + 1

    return kept, overlap_rejections, pair_rejections


def build_review(chains: list[dict], source_path: Path, output_path: Path) -> None:
    groups = {
        "KEPT": [],
        "REJECTED_OVERLAP": [],
        "REJECTED_PAIR_REUSE": [],
        "SKIPPED_LOW_QUALITY": [],
        "UNKNOWN": [],
    }

    for chain in sort_chains(chains):
        curation = chain.get("curation", {})
        status = curation.get("filterStatus", "UNKNOWN")
        groups.setdefault(status, [])
        reasons = "; ".join(chain.get("curationReasons", [])) or "no special notes"
        groups[status].append(
            "\n".join(
                [
                    f"Score: {curation.get('curatedScore', 0)} (base {curation.get('baseScore', 0)})",
                    f"Quality: {curation.get('quality', 'UNKNOWN')}",
                    f"Filter status: {status}",
                    f"Pattern: {' '.join(chain.get('pattern', []))}",
                    f"Sequence: {' -> '.join(chain.get('sequence', []))}",
                    f"Notes: {reasons}",
                ]
            )
        )

    lines = [
        "LEXIPATH OVERLAP FILTER REVIEW",
        f"Source quality file: {source_path}",
        "",
    ]

    for status, blocks in groups.items():
        lines.append(f"=== {status} ===")
        if blocks:
            lines.extend(blocks)
        else:
            lines.append("No chains in this bucket.")
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply step-2 overlap and pair filters to LexiPath quality output.")
    parser.add_argument(
        "--input",
        default="data/lexipath/generated-quality.json",
        help="Step-1 quality JSON input.",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Filtered JSON output. Defaults to '<input stem>-overlap-filtered.json'.",
    )
    parser.add_argument(
        "--review-output",
        default="",
        help="Filtered review output. Defaults to '<input stem>-overlap-filtered-review.txt'.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_name(f"{input_path.stem}-overlap-filtered{input_path.suffix or '.json'}")

    if args.review_output:
        review_path = Path(args.review_output)
    else:
        review_path = input_path.with_name(f"{input_path.stem}-overlap-filtered-review.txt")

    payload = load_json(input_path)
    chains = payload.get("chains", [])
    kept, overlap_rejections, pair_rejections = apply_filters(chains)

    output_payload = {
        "source": str(input_path),
        "count": len(kept),
        "chains": sort_chains(kept),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    review_path.parent.mkdir(parents=True, exist_ok=True)
    save_json(output_path, output_payload)
    build_review(chains, input_path, review_path)

    status_counts = summarize_filter_statuses(chains)
    print(f"Loaded {len(chains)} quality-scored chains")
    print(f"Kept after filtering: {len(kept)}")
    print(f"Thrown out for overlap: {overlap_rejections}")
    print(f"Thrown out for shared word pairs: {pair_rejections}")
    for status, count in status_counts.items():
        print(f"{status}: {count}")
    print(f"Wrote overlap-filtered JSON to {output_path}")
    print(f"Wrote overlap-filtered review to {review_path}")


if __name__ == "__main__":
    main()
