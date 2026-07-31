#!/usr/bin/env python3
"""Prepare a validated Maker bundle for delegated hatch-pet generation."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from select_template import select_template
from validate_bundle import (
    BundleValidationError,
    TRAITS,
    extract_bundle,
    load_bundle,
    sha256_bytes,
    write_json,
)


ADAPTER_VERSION = 1
PROMPT_VERSION = 1
POLICY_VERSION = 1
STYLE_SETTINGS = {"preset": "auto", "notes": "Preserve the authoritative Maker identity and selected family motion grammar."}


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def prepare_import(bundle_path: Path, output_dir: Path) -> dict[str, Any]:
    bundle = load_bundle(bundle_path)
    target = output_dir.expanduser().resolve()
    if target.exists() and any(target.iterdir()):
        raise BundleValidationError(
            "Output directory is not empty. Use a new local run directory; resume is provenance-aware and must not overwrite arbitrary files."
        )
    target.mkdir(parents=True, exist_ok=True)
    input_dir = target / "input"
    extract_bundle(bundle, input_dir)
    selected = select_template(
        bundle.request["templateFamily"],
        bundle.request["templateVersion"],
    )
    identity = build_identity_brief(bundle.request, selected)
    provenance = build_provenance(bundle, selected, identity)
    handoff = build_hatch_handoff(bundle.request, selected, identity, provenance)
    run_state = build_run_state(bundle.request, selected, provenance)

    write_json(target / "bundle-validation.json", bundle.summary)
    write_json(target / "selected-template.json", selected)
    write_json(target / "identity-brief.json", identity)
    (target / "identity-brief.md").write_text(identity_markdown(identity), encoding="utf-8")
    write_json(target / "hatch-pet-handoff.json", handoff)
    write_json(target / "provenance.json", provenance)
    write_json(target / "run-state.json", run_state)
    return {
        "ok": True,
        "stage": "prepared",
        "templateId": selected["templateId"],
        "inputFingerprint": provenance["inputFingerprint"],
        "outputs": {
            "avatar": "input/avatar.png",
            "request": "input/request.json",
            "identityBrief": "identity-brief.json",
            "identityBriefMarkdown": "identity-brief.md",
            "selectedTemplate": "selected-template.json",
            "hatchPetHandoff": "hatch-pet-handoff.json",
            "provenance": "provenance.json",
            "runState": "run-state.json",
        },
    }


def build_identity_brief(request: dict[str, Any], selected: dict[str, Any]) -> dict[str, Any]:
    traits = []
    for trait_name in TRAITS:
        value = request["traits"][trait_name]
        traits.append(
            {
                "category": trait_name,
                "assetId": value["assetId"],
                "label": value.get("label"),
                "policy": trait_policy(trait_name, value["assetId"]),
                "evidence": "maker-sidecar",
            }
        )
    pet = request.get("pet", {})
    return {
        "schemaVersion": 1,
        "templateId": selected["templateId"],
        "family": request["templateFamily"],
        "sourceNftNumber": request.get("sourceNftNumber"),
        "petName": pet.get("name"),
        "personality": pet.get("personality"),
        "canonicalImage": "input/avatar.png",
        "traits": traits,
        "bodyCompletion": request["bodyCompletion"],
        "omittedMaterial": ["background", "friend", "overlay"],
        "adaptations": {
            "shirtText": "Preserve shirt color/material/layout but convert readable text to an unreadable motif."
        },
        "fullBodyInstruction": (
            "Use the composited 1024x1024 Maker PNG and bodyCompletion object as authoritative full-body identity. "
            "Do not invent legs, bottoms, footwear, colors, or absent traits."
        ),
        "motionInstruction": (
            f"Follow {selected['templateId']} proportions, landmarks, permitted envelopes, expansion zones, "
            "family motion grammar, standard row meanings, and clockwise look contract."
        ),
    }


def trait_policy(trait_name: str, asset_id: str) -> str:
    if asset_id == "none":
        return "preserve-explicit-absence"
    if trait_name == "hair":
        return "preserve-with-hair-expansion-zone"
    if trait_name == "shirt":
        return "preserve-with-unreadable-text-adaptation"
    return "preserve"


def build_provenance(
    bundle: Any,
    selected: dict[str, Any],
    identity: dict[str, Any],
) -> dict[str, Any]:
    relevant = {
        "imageSha256": bundle.summary["imageSha256"],
        "traits": bundle.request["traits"],
        "traitPolicy": bundle.request["traitPolicy"],
        "bodyCompletion": bundle.request["bodyCompletion"],
        "templateFamily": bundle.request["templateFamily"],
        "templateVersion": bundle.request["templateVersion"],
        "adapterVersion": ADAPTER_VERSION,
        "promptVersion": PROMPT_VERSION,
        "policyVersion": POLICY_VERSION,
        "styleSettings": STYLE_SETTINGS,
    }
    return {
        "schemaVersion": 1,
        "adapterSkill": "remilia-maker-pet-import",
        "adapterVersion": ADAPTER_VERSION,
        "promptVersion": PROMPT_VERSION,
        "policyVersion": POLICY_VERSION,
        "bundleSha256": bundle.summary["bundleSha256"],
        "requestSha256": bundle.summary["requestSha256"],
        "imageSha256": bundle.summary["imageSha256"],
        "templateId": selected["templateId"],
        "templateSha256": selected["provenance"]["combinedTemplateSha256"],
        "identityBriefSha256": canonical_hash(identity),
        "styleSettings": STYLE_SETTINGS,
        "inputFingerprint": canonical_hash(relevant),
        "cacheKeyContract": (
            "sha256(canonical-json(imageSha256, traits, traitPolicy, bodyCompletion, "
            "templateFamily, templateVersion, adapterVersion, promptVersion, policyVersion, styleSettings))"
        ),
        "localDataPolicy": {
            "scope": "user-selected-run-directory",
            "rawBundleCached": False,
            "requestSidecarCached": False,
            "canonicalInputImageCached": False,
            "finalValidatedAtlasCache": "user-selected-local-directory-only",
            "publishAllowed": False,
            "publishPolicy": "The adapter never infers publication permission from a Pets Maker bundle.",
        },
    }


def build_hatch_handoff(
    request: dict[str, Any],
    selected: dict[str, Any],
    identity: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any]:
    motion = selected["motionProfile"]
    return {
        "schemaVersion": 1,
        "delegateSkill": "hatch-pet",
        "mode": "maker-template-v1",
        "referenceImage": "input/avatar.png",
        "identityBrief": "identity-brief.json",
        "selectedTemplate": "selected-template.json",
        "templateId": selected["templateId"],
        "petName": identity.get("petName"),
        "description": identity.get("personality") or f"A {request['templateFamily']} Maker custom pet.",
        "styleSettings": STYLE_SETTINGS,
        "runtimeRows": [
            {
                "index": row["index"],
                "state": row["state"],
                "frameCount": row["frameCount"],
                "poseGuide": row["poseGuide"],
            }
            for row in motion["runtimeRows"]
        ],
        "cardinalLookAnchors": motion["cardinalLookAnchors"],
        "delegationBoundary": {
            "adapterOwns": [
                "bundle validation",
                "template selection",
                "full-body identity translation",
                "Maker-template preparation and provenance",
            ],
            "hatchPetOwns": [
                "visual generation",
                "row extraction",
                "v2 atlas assembly",
                "deterministic atlas validation",
                "semantic visual QA",
                "final pet packaging",
            ],
        },
        "inputFingerprint": provenance["inputFingerprint"],
    }


def build_run_state(
    request: dict[str, Any],
    selected: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "stage": "prepared",
        "templateId": selected["templateId"],
        "inputFingerprint": provenance["inputFingerprint"],
        "rows": [
            {
                "index": row["index"],
                "state": row["state"],
                "status": "pending",
                "contentSha256": None,
            }
            for row in selected["motionProfile"]["runtimeRows"]
        ],
        "semanticReview": {
            "status": "pending",
            "artifact": None,
        },
        "deterministicQa": {
            "status": "pending",
            "artifact": "qa/deterministic-qa.json",
        },
    }


def identity_markdown(identity: dict[str, Any]) -> str:
    lines = [
        f"# {identity.get('petName') or identity['templateId']} identity brief",
        "",
        f"- Template: `{identity['templateId']}`",
        f"- Canonical image: `{identity['canonicalImage']}`",
    ]
    if identity.get("personality"):
        lines.append(f"- Personality: {identity['personality']}")
    lines.extend(["", "## Authoritative traits", ""])
    for trait in identity["traits"]:
        label = f" ({trait['label']})" if trait.get("label") else ""
        lines.append(
            f"- {trait['category']}: `{trait['assetId']}`{label}; policy `{trait['policy']}`"
        )
    completion = identity["bodyCompletion"]
    lines.extend(
        [
            "",
            "## Authoritative body completion",
            "",
            f"- Leg coverage: `{completion['legCoverage']}`",
            f"- Leg color: `{completion['legColorVariant']}`",
            (
                "- Bottom: "
                f"`{completion['bottom']['assetId']}` v{completion['bottom']['assetVersion']}, "
                f"color `{completion['bottom']['colorVariant']}`"
            ),
            (
                "- Footwear: "
                f"`{completion['footwear']['assetId']}` v{completion['footwear']['assetVersion']}, "
                f"color `{completion['footwear']['colorVariant']}`"
            ),
            "",
            "## Generation boundaries",
            "",
            f"- {identity['fullBodyInstruction']}",
            f"- {identity['motionInstruction']}",
            "- Omit background, friend, and overlay material.",
            f"- {identity['adaptations']['shirtText']}",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = prepare_import(args.bundle, args.output_dir)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (BundleValidationError, OSError, json.JSONDecodeError, KeyError) as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
