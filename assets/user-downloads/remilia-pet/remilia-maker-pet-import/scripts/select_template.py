#!/usr/bin/env python3
"""Select and validate one versioned Maker motion-template family."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from validate_bundle import BundleValidationError, FAMILIES, load_bundle, write_json


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


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
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
    if manifest.get("schemaVersion") != 1:
        raise BundleValidationError(f"{template_id}: schemaVersion must be 1.")
    if manifest.get("templateId") != template_id:
        raise BundleValidationError(f"{template_id}: templateId mismatch.")
    if manifest.get("family") != family or manifest.get("templateVersion") != version:
        raise BundleValidationError(f"{template_id}: family/version mismatch.")
    if manifest.get("motionProfile") != "../motion-profile-v1.json":
        raise BundleValidationError(f"{template_id}: unsupported motionProfile.")
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
    geometry = manifest.get("geometry")
    if not isinstance(geometry, dict):
        raise BundleValidationError(f"{template_id}: geometry is required.")
    validate_rect(geometry.get("permittedEnvelope"), f"{template_id}.permittedEnvelope")
    regions = geometry.get("requiredInnerRegions")
    if not isinstance(regions, list) or len(regions) < 4:
        raise BundleValidationError(f"{template_id}: at least four requiredInnerRegions are required.")
    for region in regions:
        if not isinstance(region, dict) or not {"id", "rect", "minimumCoverage"} <= set(region):
            raise BundleValidationError(f"{template_id}: invalid requiredInnerRegions record.")
        validate_rect(region["rect"], f"{template_id}.requiredInnerRegions.{region.get('id')}")
        validate_unit_number(
            region["minimumCoverage"],
            f"{template_id}.requiredInnerRegions.{region.get('id')}.minimumCoverage",
        )
    zones = geometry.get("expansionZones")
    if not isinstance(zones, dict) or set(zones) != {"hair", "headwear", "costume", "prop"}:
        raise BundleValidationError(f"{template_id}: all four expansionZones are required.")
    for zone, rect in zones.items():
        validate_rect(rect, f"{template_id}.expansionZones.{zone}")
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
    grammar = manifest.get("motionGrammar")
    if not isinstance(grammar, dict) or len(grammar) < 9:
        raise BundleValidationError(f"{template_id}: family motionGrammar is incomplete.")


def validate_motion_profile(profile: dict[str, Any]) -> None:
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
    rows = profile.get("runtimeRows")
    if not isinstance(rows, list) or len(rows) != 11:
        raise BundleValidationError("motion profile must declare exactly 11 runtimeRows.")
    for row in rows:
        index = row.get("index")
        expected = REQUIRED_ROWS.get(index)
        if not expected or (row.get("state"), row.get("frameCount")) != expected:
            raise BundleValidationError(f"motion profile row {index} has an invalid state/frame contract.")
        if row.get("loopOrder") != list(range(expected[1])):
            raise BundleValidationError(f"motion profile row {index} has an invalid loop order.")
        if not isinstance(row.get("landmarkPolicy"), dict):
            raise BundleValidationError(f"motion profile row {index} lacks landmark policy.")
    cardinals = profile.get("cardinalLookAnchors")
    if [item.get("direction") for item in cardinals or []] != ["000", "090", "180", "270"]:
        raise BundleValidationError("motion profile must declare the four fixed cardinal anchors.")


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


def validate_unit_number(value: Any, label: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 1:
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
            request = json.loads(args.request.read_text(encoding="utf-8"))
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
