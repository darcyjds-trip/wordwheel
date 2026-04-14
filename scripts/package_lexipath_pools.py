from __future__ import annotations

import argparse
import json
from pathlib import Path


ALLOWED_QUALITIES = {"EXCELLENT", "GOOD", "BORDERLINE"}


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


def summarize_pool(chains: list[dict]) -> dict:
    counts = {str(level): 0 for level in range(1, 6)}
    for chain in chains:
        difficulty = chain.get("curation", {}).get("curatedDifficulty")
        if difficulty is not None:
            counts[str(difficulty)] += 1
    return {
        "count": len(chains),
        "difficultyCounts": counts,
    }


def format_difficulty_breakdown(summary: dict) -> str:
    counts = summary["difficultyCounts"]
    return ", ".join(
        [
            f"d1={counts['1']}",
            f"d2={counts['2']}",
            f"d3={counts['3']}",
            f"d4={counts['4']}",
            f"d5={counts['5']}",
        ]
    )


def build_pool_payload(source: Path, pool_name: str, chains: list[dict]) -> dict:
    return {
        "source": str(source),
        "pool": pool_name,
        "summary": summarize_pool(chains),
        "chains": chains,
    }


def package_pools(chains: list[dict]) -> dict[str, list[dict]]:
    filtered = [
        chain
        for chain in chains
        if chain.get("curation", {}).get("quality") in ALLOWED_QUALITIES
    ]
    filtered = sort_chains(filtered)

    easy_1_2 = [chain for chain in filtered if chain.get("curation", {}).get("curatedDifficulty") in {1, 2}]
    medium_3 = [chain for chain in filtered if chain.get("curation", {}).get("curatedDifficulty") == 3]
    hard_4 = [chain for chain in filtered if chain.get("curation", {}).get("curatedDifficulty") == 4]
    very_hard_5 = [chain for chain in filtered if chain.get("curation", {}).get("curatedDifficulty") == 5]

    total = len(filtered)
    target = total // 3
    if total % 3:
        target += 1

    easy = list(easy_1_2)
    easy_fill = max(0, target - len(easy))
    easy.extend(medium_3[:easy_fill])
    remaining_medium = medium_3[easy_fill:]

    hard = list(very_hard_5)
    hard_fill = max(0, target - len(hard))
    hard.extend(hard_4[:hard_fill])
    remaining_hard = hard_4[hard_fill:]

    medium = remaining_medium + remaining_hard

    return {
        "easy": sort_chains(easy),
        "medium": sort_chains(medium),
        "hard": sort_chains(hard),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Split curated LexiPath chains into easy / medium / hard pools.")
    parser.add_argument(
        "--input",
        default="data/lexipath/generated-curated.json",
        help="Curated LexiPath JSON input.",
    )
    parser.add_argument(
        "--output",
        default="data/lexipath/generated-pooled.json",
        help="Base output path. The script writes separate easy/medium/hard JSON files beside this path.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    payload = load_json(input_path)
    chains = payload.get("chains", [])
    pools = package_pools(chains)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    base_stem = output_path.stem
    suffix = output_path.suffix or ".json"

    easy_path = output_path.with_name(f"{base_stem}-easy{suffix}")
    medium_path = output_path.with_name(f"{base_stem}-medium{suffix}")
    hard_path = output_path.with_name(f"{base_stem}-hard{suffix}")

    save_json(easy_path, build_pool_payload(input_path, "easy", pools["easy"]))
    save_json(medium_path, build_pool_payload(input_path, "medium", pools["medium"]))
    save_json(hard_path, build_pool_payload(input_path, "hard", pools["hard"]))

    eligible_count = sum(len(pool) for pool in pools.values())
    removed = len(chains) - eligible_count
    easy_summary = summarize_pool(pools["easy"])
    medium_summary = summarize_pool(pools["medium"])
    hard_summary = summarize_pool(pools["hard"])
    print(f"Loaded {len(chains)} curated chains")
    print(f"Removed {removed} rejected chains")
    print(f"Easy pool: {len(pools['easy'])} ({format_difficulty_breakdown(easy_summary)})")
    print(f"Medium pool: {len(pools['medium'])} ({format_difficulty_breakdown(medium_summary)})")
    print(f"Hard pool: {len(pools['hard'])} ({format_difficulty_breakdown(hard_summary)})")
    print(f"Wrote easy pool to {easy_path}")
    print(f"Wrote medium pool to {medium_path}")
    print(f"Wrote hard pool to {hard_path}")


if __name__ == "__main__":
    main()
