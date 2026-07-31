#!/usr/bin/env python3
"""Run deterministic Maker-template QA on a Codex v2 pet atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, UnidentifiedImageError


REPORT_VERSION = 1
ALPHA_THRESHOLD = 0


class QaInputError(ValueError):
    """Raised when the QA inputs cannot be measured safely."""


@dataclass(frozen=True)
class FrameMeasurement:
    row: int
    column: int
    state: str
    phase: str
    bbox: tuple[int, int, int, int] | None
    visible_alpha_pixels: int
    edge_alpha_pixels: int
    centroid: tuple[float, float] | None
    baseline: float | None
    scale: float | None
    outside_envelope_ratio: float | None
    inner_region_coverage: dict[str, float]


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise QaInputError(f"{label} is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise QaInputError(f"{label} must contain a JSON object")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def pixel_rect(rect: list[float], width: int, height: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = rect
    return (
        max(0, min(width, math.floor(left * width))),
        max(0, min(height, math.floor(top * height))),
        max(0, min(width, math.ceil(right * width))),
        max(0, min(height, math.ceil(bottom * height))),
    )


def union_rect(rects: list[list[float]]) -> list[float]:
    return [
        min(rect[0] for rect in rects),
        min(rect[1] for rect in rects),
        max(rect[2] for rect in rects),
        max(rect[3] for rect in rects),
    ]


def active_expansion_zones(
    identity: dict[str, Any] | None,
    manifest: dict[str, Any],
) -> list[str]:
    if not identity:
        return []
    traits = {
        item.get("category"): item.get("assetId")
        for item in identity.get("traits", [])
        if isinstance(item, dict)
    }
    zones = manifest["geometry"]["expansionZones"]
    active: list[str] = []
    if traits.get("hair") not in {None, "none"} and "hair" in zones:
        active.append("hair")
    shirt = str(traits.get("shirt") or "").lower()
    bottom = str(identity.get("bodyCompletion", {}).get("bottom", {}).get("category") or "").lower()
    if any(marker in f"{shirt} {bottom}" for marker in ("costume", "dress", "robe", "coat")):
        if "costume" in zones:
            active.append("costume")
    declared = identity.get("declaredExpansionZones", [])
    if isinstance(declared, list):
        for zone in declared:
            if zone in zones and zone not in active:
                active.append(zone)
    return sorted(active)


def alpha_count(alpha: Image.Image) -> int:
    return sum(1 for value in alpha.tobytes() if value > ALPHA_THRESHOLD)


def edge_alpha_count(alpha: Image.Image) -> int:
    width, height = alpha.size
    pixels = alpha.load()
    points = {(x, 0) for x in range(width)}
    points.update((x, height - 1) for x in range(width))
    points.update((0, y) for y in range(height))
    points.update((width - 1, y) for y in range(height))
    return sum(1 for x, y in points if pixels[x, y] > ALPHA_THRESHOLD)


def alpha_centroid(alpha: Image.Image, visible: int) -> tuple[float, float] | None:
    if visible == 0:
        return None
    width, height = alpha.size
    pixels = alpha.load()
    x_total = 0.0
    y_total = 0.0
    for y in range(height):
        for x in range(width):
            if pixels[x, y] > ALPHA_THRESHOLD:
                x_total += (x + 0.5) / width
                y_total += (y + 0.5) / height
    return (x_total / visible, y_total / visible)


def coverage(alpha: Image.Image, rect: list[float]) -> float:
    bounds = pixel_rect(rect, *alpha.size)
    region = alpha.crop(bounds)
    area = region.width * region.height
    return alpha_count(region) / area if area else 0.0


def outside_ratio(alpha: Image.Image, allowed_rect: list[float], visible: int) -> float | None:
    if visible == 0:
        return None
    left, top, right, bottom = pixel_rect(allowed_rect, *alpha.size)
    pixels = alpha.load()
    outside = 0
    for y in range(alpha.height):
        for x in range(alpha.width):
            if pixels[x, y] > ALPHA_THRESHOLD and not (left <= x < right and top <= y < bottom):
                outside += 1
    return outside / visible


def measure_frame(
    frame: Image.Image,
    row: int,
    column: int,
    row_spec: dict[str, Any],
    manifest: dict[str, Any],
    allowed_envelope: list[float],
) -> FrameMeasurement:
    alpha = frame.getchannel("A")
    visible = alpha_count(alpha)
    bbox = alpha.getbbox()
    centroid = alpha_centroid(alpha, visible)
    baseline = (bbox[3] / alpha.height) if bbox else None
    scale = ((bbox[3] - bbox[1]) / alpha.height) if bbox else None
    regions = {
        region["id"]: coverage(alpha, region["rect"])
        for region in manifest["geometry"]["requiredInnerRegions"]
    }
    phases = row_spec.get("phases") or row_spec.get("directions") or []
    phase = str(phases[column]) if column < len(phases) else f"frame-{column}"
    return FrameMeasurement(
        row=row,
        column=column,
        state=row_spec["state"],
        phase=phase,
        bbox=bbox,
        visible_alpha_pixels=visible,
        edge_alpha_pixels=edge_alpha_count(alpha),
        centroid=centroid,
        baseline=baseline,
        scale=scale,
        outside_envelope_ratio=outside_ratio(alpha, allowed_envelope, visible),
        inner_region_coverage=regions,
    )


def finding(
    measurement: FrameMeasurement,
    check: str,
    actual: Any,
    threshold: Any,
    template_id: str,
    diagnostic: str,
) -> dict[str, Any]:
    return {
        "row": measurement.row,
        "column": measurement.column,
        "state": measurement.state,
        "phase": measurement.phase,
        "check": check,
        "actual": actual,
        "threshold": threshold,
        "templateId": template_id,
        "diagnosticArtifact": diagnostic,
    }


def frame_record(measurement: FrameMeasurement) -> dict[str, Any]:
    return {
        "row": measurement.row,
        "column": measurement.column,
        "state": measurement.state,
        "phase": measurement.phase,
        "bbox": list(measurement.bbox) if measurement.bbox else None,
        "visibleAlphaPixels": measurement.visible_alpha_pixels,
        "edgeAlphaPixels": measurement.edge_alpha_pixels,
        "centroid": list(measurement.centroid) if measurement.centroid else None,
        "baseline": measurement.baseline,
        "scale": measurement.scale,
        "outsideEnvelopeRatio": measurement.outside_envelope_ratio,
        "innerRegionCoverage": measurement.inner_region_coverage,
    }


def distance(left: tuple[float, float] | None, right: tuple[float, float] | None) -> float | None:
    if left is None or right is None:
        return None
    return math.dist(left, right)


def draw_diagnostic(
    frame: Image.Image,
    measurement: FrameMeasurement,
    manifest: dict[str, Any],
    allowed_envelope: list[float],
    output: Path,
) -> None:
    diagnostic = frame.copy()
    draw = ImageDraw.Draw(diagnostic)
    draw.rectangle(pixel_rect(allowed_envelope, *frame.size), outline=(255, 0, 0, 255), width=2)
    for region in manifest["geometry"]["requiredInnerRegions"]:
        draw.rectangle(pixel_rect(region["rect"], *frame.size), outline=(0, 200, 255, 255), width=1)
    if measurement.bbox:
        draw.rectangle(measurement.bbox, outline=(255, 255, 0, 255), width=1)
    if measurement.centroid:
        x = int(measurement.centroid[0] * frame.width)
        y = int(measurement.centroid[1] * frame.height)
        draw.line((x - 4, y, x + 4, y), fill=(255, 0, 255, 255), width=1)
        draw.line((x, y - 4, x, y + 4), fill=(255, 0, 255, 255), width=1)
    output.parent.mkdir(parents=True, exist_ok=True)
    diagnostic.save(output, format="PNG", optimize=False)


def validate_inputs(
    manifest: dict[str, Any],
    motion: dict[str, Any],
    atlas: Image.Image,
) -> None:
    cell = motion.get("cell", {})
    expected = motion.get("atlas", {})
    if atlas.size != (expected.get("width"), expected.get("height")):
        raise QaInputError(
            f"atlas canvas must be {expected.get('width')}x{expected.get('height')}; "
            f"found {atlas.width}x{atlas.height}"
        )
    if cell.get("width") * expected.get("columns", 0) != atlas.width:
        raise QaInputError("motion profile column geometry is inconsistent")
    if cell.get("height") * expected.get("rows", 0) != atlas.height:
        raise QaInputError("motion profile row geometry is inconsistent")
    rows = motion.get("runtimeRows")
    if not isinstance(rows, list) or len(rows) != 11:
        raise QaInputError("motion profile must define exactly 11 runtime rows")
    if manifest.get("templateId") is None or manifest.get("geometry") is None:
        raise QaInputError("selected template is missing template identity or geometry")


def run_qa(
    atlas_path: Path,
    selected_path: Path,
    output_dir: Path,
    identity_path: Path | None,
) -> dict[str, Any]:
    selected = load_json(selected_path, "selected template")
    manifest = selected.get("manifest", selected)
    motion = selected.get("motionProfile")
    if not isinstance(manifest, dict) or not isinstance(motion, dict):
        raise QaInputError("selected template must include manifest and motionProfile objects")
    identity = load_json(identity_path, "identity brief") if identity_path else None
    try:
        with Image.open(atlas_path) as opened:
            atlas_format = opened.format
            atlas = opened.convert("RGBA")
    except (OSError, UnidentifiedImageError) as exc:
        raise QaInputError(f"atlas is not a readable image: {exc}") from exc
    validate_inputs(manifest, motion, atlas)

    output_dir.mkdir(parents=True, exist_ok=True)
    diagnostics_dir = output_dir / "diagnostics"
    diagnostics_dir.mkdir(parents=True, exist_ok=True)
    template_id = manifest["templateId"]
    thresholds = manifest["thresholds"]
    active_zones = active_expansion_zones(identity, manifest)
    envelope_rects = [manifest["geometry"]["permittedEnvelope"]]
    envelope_rects.extend(manifest["geometry"]["expansionZones"][zone] for zone in active_zones)
    allowed_envelope = union_rect(envelope_rects)
    width = motion["cell"]["width"]
    height = motion["cell"]["height"]
    measurements: list[FrameMeasurement] = []
    failures: list[dict[str, Any]] = []
    sequence_checks: list[dict[str, Any]] = []
    reserved_cells = {
        (item["row"], item["column"]): item
        for item in motion["atlas"].get("reservedCells", [])
    }

    for row_spec in motion["runtimeRows"]:
        row = row_spec["index"]
        frame_count = row_spec["frameCount"]
        qa_policy = row_spec.get("qaPolicy", {})
        if row_spec.get("loopOrder") != list(range(frame_count)):
            raise QaInputError(f"{row_spec['state']}: loopOrder must enumerate its frames in fixed order")
        phases = row_spec.get("phases") or row_spec.get("directions")
        if not isinstance(phases, list) or len(phases) != frame_count:
            raise QaInputError(f"{row_spec['state']}: phase/direction order must match frameCount")
        for column in range(8):
            frame = atlas.crop((column * width, row * height, (column + 1) * width, (row + 1) * height))
            reserved = reserved_cells.get((row, column))
            if column >= frame_count and reserved is None:
                unused_alpha = alpha_count(frame.getchannel("A"))
                if unused_alpha:
                    synthetic = FrameMeasurement(
                        row, column, row_spec["state"], "unused", None, unused_alpha, 0, None, None, None, None, {}
                    )
                    diag = f"diagnostics/row-{row:02d}-frame-{column:02d}.png"
                    draw_diagnostic(frame, synthetic, manifest, allowed_envelope, output_dir / diag)
                    failures.append(
                        finding(synthetic, "frame-separation-unused-cell-alpha", unused_alpha, 0, template_id, diag)
                    )
                continue
            measurement_spec = row_spec
            if reserved is not None:
                measurement_spec = {
                    **row_spec,
                    "state": reserved["purpose"],
                    "phases": [reserved["purpose"]] * 8,
                }
            measured = measure_frame(frame, row, column, measurement_spec, manifest, allowed_envelope)
            measurements.append(measured)
            diag = f"diagnostics/row-{row:02d}-frame-{column:02d}.png"
            local_failures: list[dict[str, Any]] = []
            if measured.visible_alpha_pixels < thresholds["minimumVisibleAlphaPixels"]:
                local_failures.append(
                    finding(
                        measured,
                        "visible-alpha",
                        measured.visible_alpha_pixels,
                        {"minimum": thresholds["minimumVisibleAlphaPixels"]},
                        template_id,
                        diag,
                    )
                )
            if measured.edge_alpha_pixels > thresholds["maximumEdgeAlphaPixels"]:
                local_failures.append(
                    finding(
                        measured,
                        "clipping-edge-alpha",
                        measured.edge_alpha_pixels,
                        {"maximum": thresholds["maximumEdgeAlphaPixels"]},
                        template_id,
                        diag,
                    )
                )
            if measured.outside_envelope_ratio is not None and (
                measured.outside_envelope_ratio > thresholds["maximumOutsideEnvelopeRatio"]
            ):
                local_failures.append(
                    finding(
                        measured,
                        "permitted-envelope",
                        measured.outside_envelope_ratio,
                        {"maximum": thresholds["maximumOutsideEnvelopeRatio"]},
                        template_id,
                        diag,
                    )
                )
            alpha_registration = manifest["geometry"].get("alphaRegistration", {})
            expected_baseline = alpha_registration.get(
                "baseline",
                manifest["neutralFullBody"]["baseline"],
            )
            if measured.baseline is not None:
                baseline_delta = abs(measured.baseline - expected_baseline)
                baseline_mode = qa_policy.get("baselineMode", "locked")
                baseline_failed = (
                    measured.baseline > expected_baseline + thresholds["baselineTolerance"]
                    if baseline_mode == "may-rise"
                    else baseline_delta > thresholds["baselineTolerance"]
                )
                if baseline_failed:
                    local_failures.append(
                        finding(
                            measured,
                            "baseline-registration",
                            {"value": measured.baseline, "delta": baseline_delta},
                            {
                                "expected": expected_baseline,
                                "tolerance": thresholds["baselineTolerance"],
                                "mode": baseline_mode,
                            },
                            template_id,
                            diag,
                        )
                    )
            if measured.centroid is not None and qa_policy.get("centroidMode", "registered") == "registered":
                expected_center = tuple(
                    alpha_registration.get(
                        "centroid",
                        manifest["neutralFullBody"]["bodyCenter"],
                    )
                )
                centroid_delta = distance(measured.centroid, expected_center)
                if centroid_delta is not None and centroid_delta > thresholds["centroidTolerance"]:
                    local_failures.append(
                        finding(
                            measured,
                            "centroid-registration",
                            {"value": list(measured.centroid), "distance": centroid_delta},
                            {
                                "expected": list(expected_center),
                                "maximumDistance": thresholds["centroidTolerance"],
                            },
                            template_id,
                            diag,
                        )
                    )
            required_region_ids = set(
                qa_policy.get(
                    "requiredRegions",
                    [region["id"] for region in manifest["geometry"]["requiredInnerRegions"]],
                )
            )
            required_region_ids.difference_update(
                qa_policy.get("phaseRegionExemptions", {}).get(measured.phase, [])
            )
            for region in manifest["geometry"]["requiredInnerRegions"]:
                if region["id"] not in required_region_ids:
                    continue
                actual = measured.inner_region_coverage[region["id"]]
                if actual < region["minimumCoverage"]:
                    local_failures.append(
                        finding(
                            measured,
                            f"required-inner-region:{region['id']}",
                            actual,
                            {"minimum": region["minimumCoverage"]},
                            template_id,
                            diag,
                        )
                    )
            if local_failures:
                draw_diagnostic(frame, measured, manifest, allowed_envelope, output_dir / diag)
                failures.extend(local_failures)

    by_row: dict[int, list[FrameMeasurement]] = {}
    runtime_frame_counts = {
        row_spec["index"]: row_spec["frameCount"]
        for row_spec in motion["runtimeRows"]
    }
    for measured in measurements:
        if measured.column < runtime_frame_counts[measured.row]:
            by_row.setdefault(measured.row, []).append(measured)
    for row_spec in motion["runtimeRows"]:
        row_frames = by_row.get(row_spec["index"], [])
        qa_policy = row_spec.get("qaPolicy", {})
        scales = [frame.scale for frame in row_frames if frame.scale is not None]
        median_scale = sorted(scales)[len(scales) // 2] if scales else None
        scale_threshold = (
            thresholds["scaleTolerance"]
            * qa_policy.get("scaleToleranceMultiplier", 1.0)
        )
        if median_scale is not None and qa_policy.get("scaleMode", "row-median") == "row-median":
            for measured in row_frames:
                if measured.scale is None:
                    continue
                scale_delta = abs(measured.scale - median_scale) / median_scale if median_scale else 0.0
                if scale_delta > scale_threshold:
                    diag = f"diagnostics/row-{measured.row:02d}-frame-{measured.column:02d}.png"
                    frame = atlas.crop(
                        (
                            measured.column * width,
                            measured.row * height,
                            (measured.column + 1) * width,
                            (measured.row + 1) * height,
                        )
                    )
                    draw_diagnostic(frame, measured, manifest, allowed_envelope, output_dir / diag)
                    failures.append(
                        finding(
                            measured,
                            "scale-continuity",
                            {"value": measured.scale, "relativeDelta": scale_delta},
                            {"rowMedian": median_scale, "maximumRelativeDelta": scale_threshold},
                            template_id,
                            diag,
                        )
                    )
        for previous, current in zip(row_frames, row_frames[1:]):
            step = distance(previous.centroid, current.centroid)
            adjacent_threshold = (
                thresholds["maximumAdjacentCentroidStep"]
                * qa_policy.get("adjacentCentroidMultiplier", 1.0)
            )
            passed = step is not None and step <= adjacent_threshold
            sequence_checks.append(
                {
                    "check": "adjacent-centroid-continuity",
                    "state": row_spec["state"],
                    "from": previous.column,
                    "to": current.column,
                    "actual": step,
                    "threshold": adjacent_threshold,
                    "passed": passed,
                }
            )
            if not passed:
                diag = f"diagnostics/row-{current.row:02d}-frame-{current.column:02d}.png"
                frame = atlas.crop(
                    (
                        current.column * width,
                        current.row * height,
                        (current.column + 1) * width,
                        (current.row + 1) * height,
                    )
                )
                draw_diagnostic(frame, current, manifest, allowed_envelope, output_dir / diag)
                failures.append(
                    finding(
                        current,
                        "adjacent-centroid-continuity",
                        step,
                        {"maximum": adjacent_threshold, "previousFrame": previous.column},
                        template_id,
                        diag,
                    )
                )
        if row_frames:
            closure = distance(row_frames[-1].centroid, row_frames[0].centroid)
            passed = closure is not None and closure <= thresholds["maximumLoopClosureCentroidStep"]
            sequence_checks.append(
                {
                    "check": "loop-closure",
                    "state": row_spec["state"],
                    "from": row_frames[-1].column,
                    "to": row_frames[0].column,
                    "actual": closure,
                    "threshold": thresholds["maximumLoopClosureCentroidStep"],
                    "passed": passed,
                }
            )
            if not passed:
                measured = row_frames[-1]
                diag = f"diagnostics/row-{measured.row:02d}-frame-{measured.column:02d}.png"
                frame = atlas.crop(
                    (
                        measured.column * width,
                        measured.row * height,
                        (measured.column + 1) * width,
                        (measured.row + 1) * height,
                    )
                )
                draw_diagnostic(frame, measured, manifest, allowed_envelope, output_dir / diag)
                failures.append(
                    finding(
                        measured,
                        "loop-closure",
                        closure,
                        {"maximum": thresholds["maximumLoopClosureCentroidStep"], "firstFrame": 0},
                        template_id,
                        diag,
                    )
                )

    contact_sheet = atlas.copy()
    sheet_draw = ImageDraw.Draw(contact_sheet)
    for measured in measurements:
        x0 = measured.column * width
        y0 = measured.row * height
        color = (0, 220, 80, 255)
        if any(
            failure["row"] == measured.row and failure["column"] == measured.column
            for failure in failures
        ):
            color = (255, 50, 50, 255)
        sheet_draw.rectangle((x0, y0, x0 + width - 1, y0 + height - 1), outline=color, width=2)
    sheet_path = diagnostics_dir / "annotated-atlas.png"
    contact_sheet.save(sheet_path, format="PNG", optimize=False)

    report = {
        "schemaVersion": REPORT_VERSION,
        "status": "passed" if not failures else "failed",
        "sequence": [
            "canvas-and-frame-geometry",
            "alpha-and-frame-separation",
            "clipping",
            "template-registration",
            "baseline-scale-centroid",
            "required-inner-regions-and-permitted-envelope",
            "continuity-phase-order-loop-closure",
            "semantic-review-separate",
        ],
        "atlas": {
            "path": str(atlas_path),
            "format": atlas_format,
            "sha256": sha256_file(atlas_path),
            "width": atlas.width,
            "height": atlas.height,
        },
        "template": {
            "templateId": template_id,
            "templateVersion": manifest["templateVersion"],
            "combinedTemplateSha256": selected.get("provenance", {}).get("combinedTemplateSha256"),
            "thresholds": thresholds,
            "rowQaPolicies": {
                row["state"]: row.get("qaPolicy", {})
                for row in motion["runtimeRows"]
            },
            "activeExpansionZones": active_zones,
            "effectivePermittedEnvelope": allowed_envelope,
        },
        "counts": {
            "measuredFrames": len(measurements),
            "runtimeFrames": sum(row["frameCount"] for row in motion["runtimeRows"]),
            "reservedFrames": len(reserved_cells),
            "failures": len(failures),
            "sequenceChecks": len(sequence_checks),
        },
        "frames": [frame_record(item) for item in measurements],
        "sequenceChecks": sequence_checks,
        "failures": failures,
        "diagnostics": {"annotatedAtlas": "diagnostics/annotated-atlas.png"},
        "semanticReview": {
            "status": "pending",
            "requiredChecks": [
                "identity",
                "expression",
                "trait-fidelity",
                "correct-gait-and-look-directions",
                "motion-quality",
            ],
        },
    }
    report_path = output_dir / "deterministic-qa.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    semantic_path = output_dir / "semantic-review.json"
    if not semantic_path.exists():
        semantic = {
            "schemaVersion": 1,
            "status": "pending",
            "deterministicQaSha256": sha256_file(report_path),
            "reviewer": None,
            "reviewedAt": None,
            "checks": {
                "identity": None,
                "expression": None,
                "traitFidelity": None,
                "correctGaitAndLookDirections": None,
                "motionQuality": None,
            },
            "notes": None,
        }
        semantic_path.write_text(json.dumps(semantic, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--selected-template", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--identity-brief", type=Path)
    args = parser.parse_args()
    try:
        report = run_qa(
            args.atlas.expanduser().resolve(),
            args.selected_template.expanduser().resolve(),
            args.output_dir.expanduser().resolve(),
            args.identity_brief.expanduser().resolve() if args.identity_brief else None,
        )
    except (QaInputError, OSError, KeyError, TypeError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 2
    print(
        json.dumps(
            {
                "ok": report["status"] == "passed",
                "status": report["status"],
                "failures": report["counts"]["failures"],
                "report": str(args.output_dir / "deterministic-qa.json"),
                "semanticReview": str(args.output_dir / "semantic-review.json"),
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
