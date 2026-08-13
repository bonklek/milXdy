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
    TRAIT_POLICY,
    TRAITS,
    extract_bundle,
    load_bundle,
    reject_duplicate_json_keys,
    sha256_bytes,
    write_json,
)


ADAPTER_VERSION = 2
PROMPT_VERSION = 1
STYLE_SETTINGS = {"preset": "auto", "notes": "Preserve the authoritative Maker identity and selected family motion grammar."}
SKILL_ROOT = Path(__file__).resolve().parents[1]
TRAIT_POLICY_PATH = SKILL_ROOT / "references" / "trait-policies.json"


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
    policy = load_trait_policy_contract()
    identity = build_identity_brief(bundle.request, selected, policy)
    provenance = build_provenance(bundle, selected, identity, policy)
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


def load_trait_policy_contract() -> dict[str, Any]:
    try:
        policy = json.loads(
            TRAIT_POLICY_PATH.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicate_json_keys,
        )
    except (OSError, json.JSONDecodeError) as exc:
        raise BundleValidationError(f"Trait policy contract is invalid: {exc}") from exc
    if not isinstance(policy, dict):
        raise BundleValidationError("Trait policy contract must contain an object.")
    if policy.get("schemaVersion") != 1 or policy.get("policyVersion") != 1:
        raise BundleValidationError("Trait policy schemaVersion and policyVersion must both be 1.")
    if policy.get("requiredTraitKeys") != list(TRAITS):
        raise BundleValidationError("Trait policy requiredTraitKeys do not match the Maker contract.")
    actions = policy.get("identityActions")
    expected_action_keys = set(TRAITS) | {"bodyCompletion"}
    if not isinstance(actions, dict) or set(actions) != expected_action_keys:
        raise BundleValidationError("Trait policy identityActions are incomplete or unsupported.")
    if any(not isinstance(action, str) or not action for action in actions.values()):
        raise BundleValidationError("Trait policy identityActions must be nonempty strings.")
    if policy.get("nonPetTraits") != TRAIT_POLICY:
        raise BundleValidationError("Trait policy nonPetTraits do not match the bundle omission contract.")
    rights = policy.get("rights")
    private_review = rights.get("private-review") if isinstance(rights, dict) else None
    if not isinstance(private_review, dict) or private_review.get("publicationAllowed") is not False:
        raise BundleValidationError("Trait policy must keep private-review publication disabled.")
    return {
        "document": policy,
        "path": "references/trait-policies.json",
        "sha256": hashlib.sha256(TRAIT_POLICY_PATH.read_bytes()).hexdigest(),
    }


def build_identity_brief(
    request: dict[str, Any],
    selected: dict[str, Any],
    policy: dict[str, Any],
) -> dict[str, Any]:
    actions = policy["document"]["identityActions"]
    traits = []
    for trait_name in TRAITS:
        value = request["traits"][trait_name]
        traits.append(
            {
                "category": trait_name,
                "assetId": value["assetId"],
                "label": value.get("label"),
                "policy": trait_policy(actions[trait_name], value["assetId"]),
                "evidence": {
                    "source": "maker-sidecar",
                    "policyPath": policy["path"],
                    "policyVersion": policy["document"]["policyVersion"],
                    "policySha256": policy["sha256"],
                },
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
        "bodyCompletionPolicy": actions["bodyCompletion"],
        "policyContract": {
            "path": policy["path"],
            "schemaVersion": policy["document"]["schemaVersion"],
            "policyVersion": policy["document"]["policyVersion"],
            "sha256": policy["sha256"],
        },
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


def trait_policy(policy_action: str, asset_id: str) -> str:
    if asset_id == "none":
        return "preserve-explicit-absence"
    return policy_action


def build_provenance(
    bundle: Any,
    selected: dict[str, Any],
    identity: dict[str, Any],
    policy: dict[str, Any],
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
        "policyVersion": policy["document"]["policyVersion"],
        "policySha256": policy["sha256"],
        "styleSettings": STYLE_SETTINGS,
    }
    return {
        "schemaVersion": 1,
        "adapterSkill": "remilia-maker-pet-import",
        "adapterVersion": ADAPTER_VERSION,
        "promptVersion": PROMPT_VERSION,
        "policyVersion": policy["document"]["policyVersion"],
        "policyPath": policy["path"],
        "policySha256": policy["sha256"],
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
            "templateFamily, templateVersion, adapterVersion, promptVersion, policyVersion, policySha256, styleSettings))"
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
