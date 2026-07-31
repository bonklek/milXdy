#!/usr/bin/env python3
"""Classify Maker request changes and plan safe pet-pipeline reuse."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PLAN_VERSION = 1
ALL_ROWS = list(range(11))
NON_PET_POLICY_PATHS = {
    "traitPolicy.background",
    "traitPolicy.friend",
    "traitPolicy.overlay",
}
METADATA_ONLY_PATHS = {
    "pet.name",
    "pet.personality",
    "rightsScope",
    "sourceNftNumber",
}
SMALL_APPEARANCE_TRAITS = {"eyes", "glasses", "earrings"}
MAJOR_SILHOUETTE_TRAITS = {"race", "hair", "shirt"}


class DiffInputError(ValueError):
    """Raised when either side of a trait diff is malformed."""


def load_request(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DiffInputError(f"{label} request is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise DiffInputError(f"{label} request must be a JSON object")
    return value


def flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key in sorted(value):
            path = f"{prefix}.{key}" if prefix else key
            result.update(flatten(value[key], path))
        return result
    return {prefix: value}


def plan_diff(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    before = flatten(previous)
    after = flatten(current)
    paths = sorted(
        path
        for path in set(before) | set(after)
        if before.get(path) != after.get(path)
    )
    changes = [
        {
            "path": path,
            "previous": before.get(path),
            "current": after.get(path),
        }
        for path in paths
    ]
    trait_names = {
        path.split(".")[1]
        for path in paths
        if path.startswith("traits.") and len(path.split(".")) >= 3
    }

    if not paths:
        classification = "exact-match"
        action = "reuse-validated-atlas-candidate"
        reusable_rows = ALL_ROWS
        regenerate_rows: list[int] = []
        reason = "All request fields match. Provenance and cached atlas validation must still be verified."
    elif set(paths).issubset(NON_PET_POLICY_PATHS):
        classification = "non-pet-only"
        action = "reuse-validated-atlas-candidate"
        reusable_rows = ALL_ROWS
        regenerate_rows = []
        reason = "Only background, friend, or overlay omission policy changed; those inputs are outside pet identity."
    elif set(paths).issubset(NON_PET_POLICY_PATHS | METADATA_ONLY_PATHS):
        classification = "metadata-only"
        action = "reuse-imagery-update-provenance"
        reusable_rows = ALL_ROWS
        regenerate_rows = []
        reason = "Only pet metadata, rights scope, or non-pet policy changed; imagery is unchanged."
    elif (
        trait_names
        and trait_names.issubset(SMALL_APPEARANCE_TRAITS)
        and all(
            path.startswith("traits.") or path in NON_PET_POLICY_PATHS or path in METADATA_ONLY_PATHS
            for path in paths
        )
    ):
        classification = "small-appearance-change"
        action = "targeted-row-edits"
        reusable_rows = []
        regenerate_rows = ALL_ROWS
        reason = (
            "A face/accessory trait changed. Retain the motion templates and edit only completed visual rows; "
            "because the trait is visible throughout the atlas, no visual row is assumed safe without review."
        )
    else:
        major_markers = {
            "imageSha256",
            "templateFamily",
            "templateVersion",
            "bodyCompletion",
        }
        has_major_path = any(
            path in major_markers
            or any(path.startswith(f"{marker}.") for marker in major_markers)
            for path in paths
        )
        has_major_trait = bool(trait_names & MAJOR_SILHOUETTE_TRAITS)
        classification = "major-silhouette-change" if (has_major_path or has_major_trait) else "identity-change"
        action = "regenerate-character-imagery"
        reusable_rows = []
        regenerate_rows = ALL_ROWS
        reason = (
            "A template, source image, body-completion, or silhouette-bearing identity input changed. "
            "Retain version-compatible motion templates, but invalidate prior character imagery."
        )

    return {
        "schemaVersion": PLAN_VERSION,
        "classification": classification,
        "action": action,
        "changedPaths": paths,
        "changes": changes,
        "changedTraitCategories": sorted(trait_names),
        "reusableRows": reusable_rows,
        "regenerateRows": regenerate_rows,
        "templateReuse": not any(path in {"templateFamily", "templateVersion"} for path in paths),
        "requiresDeterministicQa": bool(regenerate_rows),
        "requiresSemanticReview": bool(regenerate_rows),
        "reason": reason,
        "safety": {
            "rawSilhouetteSimilarityUsed": False,
            "unchangedVisualRowsInferred": False,
            "cacheProvenanceVerificationRequired": action.startswith("reuse-"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", type=Path, required=True)
    parser.add_argument("--current", type=Path, required=True)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()
    try:
        result = plan_diff(
            load_request(args.previous.expanduser().resolve(), "previous"),
            load_request(args.current.expanduser().resolve(), "current"),
        )
    except DiffInputError as exc:
        print(f"ERROR: {exc}")
        return 2
    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
