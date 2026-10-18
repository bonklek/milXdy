#!/usr/bin/env python3
"""Select and validate one versioned Maker motion-template family."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from validate_bundle import (
    BundleValidationError,
    FAMILIES,
    load_bundle,
    reject_duplicate_json_keys,
    write_json,
)


SKILL_ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_ROOT = SKILL_ROOT / "assets" / "templates"
REQUIRED_ROWS = {
    0: ("idle", 6),
    1: ("running-right", 8),
    2: ("running-left", 8),
    3: ("waving", 4),
    4: ("jumping", 5),
    5: ("failed", 8),
    6: ("waiting", 6),
    7: ("running", 6),
    8: ("review", 6),
    9: ("look-000-through-157.5", 8),
    10: ("look-180-through-337.5", 8),
}
MOTION_GRAMMAR_KEYS = {
    "idle",
    "directionalRun",
    "wave",
    "jump",
    "failed",
    "waiting",
    "working",
    "review",
    "look",
}
REQUIRED_REGION_IDS = {
    "head-core",
    "torso-core",
    "lower-body-core",
    "foot-contact",
}
LOOK_DIRECTIONS = [
    "000",
    "022.5",
    "045",
    "067.5",
    "090",
    "112.5",
    "135",
    "157.5",
    "180",
    "202.5",
    "225",
    "247.5",
    "270",
    "292.5",
    "315",
    "337.5",
]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicate_json_keys,
        )
    except (OSError, json.JSONDecodeError) as exc:
        raise BundleValidationError(f"{label} is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise BundleValidationError(f"{label} must contain an object.")
    return value


def select_template(
    family: str,
    version: int,
    templates_root: Path = TEMPLATES_ROOT,
) -> dict[str, Any]:
    if family not in FAMILIES:
        raise BundleValidationError(f"Unsupported Maker template family: {family}")
    if version != 1:
        raise BundleValidationError(f"Unsupported {family} template version: {version}")
    root = templates_root.resolve()
    template_id = f"{family}-v{version}"
    manifest_path = (root / template_id / "manifest.json").resolve()
    if root not in manifest_path.parents or not manifest_path.is_file():
        raise BundleValidationError(f"Template manifest not found: {template_id}")
    manifest = load_json(manifest_path, f"{template_id} manifest")
    validate_manifest(manifest, template_id, family, version)
    motion_relative = manifest["motionProfile"]
    motion_path = (manifest_path.parent / motion_relative).resolve()
    if root not in motion_path.parents or not motion_path.is_file():
        raise BundleValidationError(f"{template_id}: motionProfile escapes or is missing.")
    motion = load_json(motion_path, f"{template_id} motion profile")
    validate_motion_profile(motion)
    manifest_hash = sha256_file(manifest_path)
    motion_hash = sha256_file(motion_path)
    combined_hash = hashlib.sha256(
        bytes.fromhex(manifest_hash) + bytes.fromhex(motion_hash)
    ).hexdigest()
    return {
        "schemaVersion": 1,
        "templateId": template_id,
        "family": family,
        "templateVersion": version,
        "manifest": manifest,
        "motionProfile": motion,
        "provenance": {
            "manifest": f"assets/templates/{template_id}/manifest.json",
            "manifestSha256": manifest_hash,
            "motionProfile": "assets/templates/motion-profile-v1.json",
            "motionProfileSha256": motion_hash,
            "combinedTemplateSha256": combined_hash,
        },
    }


def validate_manifest(
    manifest: dict[str, Any],
    template_id: str,
    family: str,
    version: int,
) -> None:
    required_fields = {
        "schemaVersion",
        "templateId",
        "family",
        "templateVersion",
        "status",
        "motionProfile",
        "bodyClass",
        "description",
        "neutralFullBody",
        "motionGrammar",
        "geometry",
        "thresholds",
    }
    if set(manifest) != required_fields:
        raise BundleValidationError(f"{template_id}: manifest fields do not match schema version 1.")
    if manifest.get("schemaVersion") != 1:
        raise BundleValidationError(f"{template_id}: schemaVersion must be 1.")
    if manifest.get("templateId") != template_id:
        raise BundleValidationError(f"{template_id}: templateId mismatch.")
    if manifest.get("family") != family or manifest.get("templateVersion") != version:
        raise BundleValidationError(f"{template_id}: family/version mismatch.")
    if manifest.get("motionProfile") != "../motion-profile-v1.json":
        raise BundleValidationError(f"{template_id}: unsupported motionProfile.")
    if manifest.get("status") != "versioned-specification":
        raise BundleValidationError(f"{template_id}: status must be versioned-specification.")
    for key in ("bodyClass", "description"):
        if not isinstance(manifest.get(key), str) or not manifest[key].strip():
            raise BundleValidationError(f"{template_id}: {key} must be a nonempty string.")
    neutral = manifest.get("neutralFullBody")
    if not isinstance(neutral, dict):
        raise BundleValidationError(f"{template_id}: neutralFullBody is required.")
    required_landmarks = {
        "bodyCenter",
        "baseline",
        "headCenter",
        "leftHand",
        "rightHand",
        "leftFoot",
        "rightFoot",
        "headToBodyRatio",
        "stanceWidth",
    }
    missing_landmarks = sorted(required_landmarks - set(neutral))
    if missing_landmarks:
        raise BundleValidationError(
            f"{template_id}: neutralFullBody missing {', '.join(missing_landmarks)}."
        )
    for key in ("bodyCenter", "headCenter", "leftHand", "rightHand", "leftFoot", "rightFoot"):
        validate_point(neutral[key], f"{template_id}.neutralFullBody.{key}")
    validate_unit_number(neutral["baseline"], f"{template_id}.neutralFullBody.baseline")
    validate_unit_number(
        neutral["headToBodyRatio"], f"{template_id}.neutralFullBody.headToBodyRatio", positive=True
    )
    validate_unit_number(neutral["stanceWidth"], f"{template_id}.neutralFullBody.stanceWidth", positive=True)
    grammar = manifest.get("motionGrammar")
    if not isinstance(grammar, dict) or set(grammar) != MOTION_GRAMMAR_KEYS:
        raise BundleValidationError(f"{template_id}: family motionGrammar is incomplete.")
    if any(not isinstance(value, str) or not value.strip() for value in grammar.values()):
        raise BundleValidationError(f"{template_id}: motionGrammar entries must be nonempty strings.")
    geometry = manifest.get("geometry")
    if not isinstance(geometry, dict) or set(geometry) != {
        "alphaRegistration",
        "permittedEnvelope",
        "requiredInnerRegions",
        "expansionZones",
    }:
        raise BundleValidationError(f"{template_id}: geometry is required.")
    registration = geometry["alphaRegistration"]
    if not isinstance(registration, dict) or set(registration) != {"centroid", "baseline"}:
        raise BundleValidationError(f"{template_id}: alphaRegistration is incomplete.")
    validate_point(registration["centroid"], f"{template_id}.alphaRegistration.centroid")
    validate_unit_number(
        registration["baseline"], f"{template_id}.alphaRegistration.baseline", positive=True
    )
    validate_rect(geometry.get("permittedEnvelope"), f"{template_id}.permittedEnvelope")
    regions = geometry.get("requiredInnerRegions")
    if not isinstance(regions, list) or len(regions) != 4:
        raise BundleValidationError(f"{template_id}: exactly four requiredInnerRegions are required.")
    region_ids = {region.get("id") for region in regions if isinstance(region, dict)}
    if region_ids != REQUIRED_REGION_IDS:
        raise BundleValidationError(f"{template_id}: requiredInnerRegions IDs are incomplete.")
    for region in regions:
        if not isinstance(region, dict) or set(region) != {"id", "rect", "minimumCoverage"}:
            raise BundleValidationError(f"{template_id}: invalid requiredInnerRegions record.")
        validate_rect(region["rect"], f"{template_id}.requiredInnerRegions.{region.get('id')}")
        validate_unit_number(
            region["minimumCoverage"],
            f"{template_id}.requiredInnerRegions.{region.get('id')}.minimumCoverage",
            positive=True,
        )
    zones = geometry.get("expansionZones")
    if not isinstance(zones, dict) or set(zones) != {"hair", "headwear", "costume", "prop"}:
        raise BundleValidationError(f"{template_id}: all four expansionZones are required.")
    for zone, rect in zones.items():
        validate_rect(rect, f"{template_id}.expansionZones.{zone}")
    alpha_registration = geometry.get("alphaRegistration")
    if alpha_registration is not None:
        if not isinstance(alpha_registration, dict) or set(alpha_registration) != {
            "centroid",
            "baseline",
        }:
            raise BundleValidationError(
                f"{template_id}: alphaRegistration must contain centroid and baseline."
            )
        validate_point(alpha_registration["centroid"], f"{template_id}.alphaRegistration.centroid")
        validate_unit_number(
            alpha_registration["baseline"],
            f"{template_id}.alphaRegistration.baseline",
        )
    thresholds = manifest.get("thresholds")
    required_thresholds = {
        "minimumVisibleAlphaPixels",
        "maximumEdgeAlphaPixels",
        "baselineTolerance",
        "centroidTolerance",
        "scaleTolerance",
        "maximumOutsideEnvelopeRatio",
        "maximumAdjacentCentroidStep",
        "maximumLoopClosureCentroidStep",
    }
    if not isinstance(thresholds, dict) or required_thresholds - set(thresholds):
        raise BundleValidationError(f"{template_id}: deterministic threshold contract is incomplete.")
    if set(thresholds) != required_thresholds:
        raise BundleValidationError(f"{template_id}: deterministic threshold fields are unsupported.")
    if (
        isinstance(thresholds["minimumVisibleAlphaPixels"], bool)
        or not isinstance(thresholds["minimumVisibleAlphaPixels"], int)
        or thresholds["minimumVisibleAlphaPixels"] <= 0
    ):
        raise BundleValidationError(f"{template_id}: minimumVisibleAlphaPixels must be positive.")
    if thresholds["maximumEdgeAlphaPixels"] != 0:
        raise BundleValidationError(f"{template_id}: maximumEdgeAlphaPixels must fail closed at zero.")
    for key in required_thresholds - {"minimumVisibleAlphaPixels", "maximumEdgeAlphaPixels"}:
        validate_unit_number(thresholds[key], f"{template_id}.thresholds.{key}", positive=True)


def validate_motion_profile(profile: dict[str, Any]) -> None:
    if set(profile) != {
        "schemaVersion",
        "profileId",
        "cell",
        "atlas",
        "landmarkContract",
        "runtimeRows",
        "cardinalLookAnchors",
    }:
        raise BundleValidationError("motion profile fields do not match schema version 1.")
    if profile.get("schemaVersion") != 1:
        raise BundleValidationError("motion profile schemaVersion must be 1.")
    cell = profile.get("cell")
    atlas = profile.get("atlas")
    if cell != {"width": 192, "height": 208}:
        raise BundleValidationError("motion profile cell contract must be 192x208.")
    if not isinstance(atlas, dict) or (
        atlas.get("columns"),
        atlas.get("rows"),
        atlas.get("width"),
        atlas.get("height"),
        atlas.get("spriteVersionNumber"),
    ) != (8, 11, 1536, 2288, 2):
        raise BundleValidationError("motion profile atlas contract must be Codex v2.")
    if profile.get("profileId") != "remilia-maker-standard-motion-v1":
        raise BundleValidationError("motion profile ID is unsupported.")
    landmarks = profile.get("landmarkContract")
    if not isinstance(landmarks, dict) or set(landmarks) != {
        "coordinateSpace",
        "required",
        "screenCoordinates",
        "baselinePolicy",
        "loopPolicy",
    }:
        raise BundleValidationError("motion profile landmark contract is incomplete.")
    if landmarks["coordinateSpace"] != "normalized-cell" or landmarks["screenCoordinates"] is not True:
        raise BundleValidationError("motion profile landmark coordinates are unsupported.")
    if landmarks["required"] != [
        "bodyCenter",
        "baseline",
        "headCenter",
        "leftHand",
        "rightHand",
        "leftFoot",
        "rightFoot",
        "facing",
        "phase",
    ]:
        raise BundleValidationError("motion profile required landmarks are incomplete or reordered.")
    rows = profile.get("runtimeRows")
    if not isinstance(rows, list) or len(rows) != 11:
        raise BundleValidationError("motion profile must declare exactly 11 runtimeRows.")
    if [row.get("index") for row in rows if isinstance(row, dict)] != list(range(11)):
        raise BundleValidationError("motion profile runtimeRows must be uniquely ordered from 0 through 10.")
    for row in rows:
        if not isinstance(row, dict):
            raise BundleValidationError("motion profile runtimeRows must contain objects.")
        index = row.get("index")
        expected = REQUIRED_ROWS.get(index)
        if not expected or (row.get("state"), row.get("frameCount")) != expected:
            raise BundleValidationError(f"motion profile row {index} has an invalid state/frame contract.")
        if row.get("loopOrder") != list(range(expected[1])):
            raise BundleValidationError(f"motion profile row {index} has an invalid loop order.")
        if not isinstance(row.get("poseGuide"), str) or not row["poseGuide"].strip():
            raise BundleValidationError(f"motion profile row {index} lacks a pose guide.")
        landmark_policy = row.get("landmarkPolicy")
        if not isinstance(landmark_policy, dict) or set(landmark_policy) != {
            "baseline",
            "bodyCenter",
            "headCenter",
            "hands",
            "feet",
        }:
            raise BundleValidationError(f"motion profile row {index} lacks landmark policy.")
        if any(not isinstance(value, str) or not value for value in landmark_policy.values()):
            raise BundleValidationError(f"motion profile row {index} has an invalid landmark policy.")
        if index < 9:
            phases = row.get("phases")
            if not isinstance(phases, list) or len(phases) != expected[1] or len(set(phases)) < 2:
                raise BundleValidationError(f"motion profile row {index} has an invalid phase sequence.")
        else:
            expected_directions = LOOK_DIRECTIONS[:8] if index == 9 else LOOK_DIRECTIONS[8:]
            if row.get("directions") != expected_directions:
                raise BundleValidationError(f"motion profile row {index} has an invalid look sequence.")
        qa_policy = row.get("qaPolicy")
        if not isinstance(qa_policy, dict):
            raise BundleValidationError(f"motion profile row {index} lacks QA policy.")
        if qa_policy.get("baselineMode") not in {"locked", "may-rise"}:
            raise BundleValidationError(f"motion profile row {index} has an invalid baseline QA mode.")
        if qa_policy.get("centroidMode") not in {"registered", "continuity-only"}:
            raise BundleValidationError(f"motion profile row {index} has an invalid centroid QA mode.")
        if qa_policy.get("scaleMode") not in {"row-median", "dynamic"}:
            raise BundleValidationError(f"motion profile row {index} has an invalid scale QA mode.")
        required_regions = qa_policy.get("requiredRegions")
        if not isinstance(required_regions, list) or not set(required_regions) <= {
            "head-core",
            "torso-core",
            "lower-body-core",
            "foot-contact",
        }:
            raise BundleValidationError(f"motion profile row {index} has invalid required regions.")
        if not required_regions:
            raise BundleValidationError(f"motion profile row {index} must require at least one inner region.")
        for multiplier in ("scaleToleranceMultiplier", "adjacentCentroidMultiplier"):
            if multiplier in qa_policy:
                value = qa_policy[multiplier]
                if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
                    raise BundleValidationError(f"motion profile row {index} has invalid {multiplier}.")
        exemptions = qa_policy.get("phaseRegionExemptions")
        if exemptions is not None:
            if index >= 9 or not isinstance(exemptions, dict):
                raise BundleValidationError(f"motion profile row {index} has invalid phase exemptions.")
            if not set(exemptions) <= set(row["phases"]):
                raise BundleValidationError(f"motion profile row {index} exempts an unknown phase.")
            if any(not isinstance(value, list) or not set(value) <= REQUIRED_REGION_IDS for value in exemptions.values()):
                raise BundleValidationError(f"motion profile row {index} has invalid region exemptions.")
    reserved = atlas.get("reservedCells")
    if reserved != [{"row": 0, "column": 6, "purpose": "neutral-look-fallback"}]:
        raise BundleValidationError("motion profile must declare the Codex v2 neutral-look fallback cell.")
    cardinals = profile.get("cardinalLookAnchors")
    if [item.get("direction") for item in cardinals or []] != ["000", "090", "180", "270"]:
        raise BundleValidationError("motion profile must declare the four fixed cardinal anchors.")
    expected_cardinals = [
        ("000", "up", "vertical-negative"),
        ("090", "screen-right", "horizontal-positive"),
        ("180", "down", "vertical-positive"),
        ("270", "screen-left", "horizontal-negative"),
    ]
    for anchor, expected in zip(cardinals, expected_cardinals):
        if (
            not isinstance(anchor, dict)
            or (anchor.get("direction"), anchor.get("expected"), anchor.get("screenAxis")) != expected
            or not isinstance(anchor.get("requiredEvidence"), list)
            or len(anchor["requiredEvidence"]) < 2
            or any(not isinstance(item, str) or not item for item in anchor["requiredEvidence"])
        ):
            raise BundleValidationError(f"motion profile cardinal anchor {expected[0]} is incomplete.")


def validate_point(value: Any, label: str) -> None:
    if not isinstance(value, list) or len(value) != 2:
        raise BundleValidationError(f"{label} must be a normalized [x, y] point.")
    for item in value:
        validate_unit_number(item, label)


def validate_rect(value: Any, label: str) -> None:
    if not isinstance(value, list) or len(value) != 4:
        raise BundleValidationError(f"{label} must be a normalized [left, top, right, bottom] rect.")
    for item in value:
        validate_unit_number(item, label)
    if value[0] >= value[2] or value[1] >= value[3]:
        raise BundleValidationError(f"{label} has inverted edges.")


def validate_unit_number(value: Any, label: str, positive: bool = False) -> None:
    lower_bound = 0 < value if isinstance(value, (int, float)) and not isinstance(value, bool) else False
    if (
        not isinstance(value, (int, float))
        or isinstance(value, bool)
        or not 0 <= value <= 1
        or (positive and not lower_bound)
    ):
        raise BundleValidationError(f"{label} must be between 0 and 1.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--bundle", type=Path)
    source.add_argument("--request", type=Path)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()
    try:
        if args.bundle:
            request = load_bundle(args.bundle).request
        else:
            request = json.loads(
                args.request.read_text(encoding="utf-8"),
                object_pairs_hook=reject_duplicate_json_keys,
            )
        selected = select_template(request["templateFamily"], request["templateVersion"])
        if args.json_out:
            write_json(args.json_out, selected)
        print(json.dumps(selected["provenance"], indent=2, sort_keys=True))
        return 0
    except (BundleValidationError, OSError, json.JSONDecodeError, KeyError) as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
