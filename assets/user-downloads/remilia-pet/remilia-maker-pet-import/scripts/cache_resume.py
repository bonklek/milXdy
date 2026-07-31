#!/usr/bin/env python3
"""Plan or record provenance-aware local cache/resume for a Maker pet run."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from plan_trait_diff import load_request, plan_diff


CACHE_SCHEMA_VERSION = 1


class CacheError(ValueError):
    """Raised when cache provenance or review state is unsafe."""


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CacheError(f"{label} is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise CacheError(f"{label} must be a JSON object")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def ensure_cache_root(cache_dir: Path) -> Path:
    root = cache_dir.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def cache_entry_dir(cache_root: Path, fingerprint: str) -> Path:
    if len(fingerprint) != 64 or any(character not in "0123456789abcdef" for character in fingerprint):
        raise CacheError("run provenance has an invalid inputFingerprint")
    target = (cache_root / fingerprint).resolve()
    if cache_root not in target.parents:
        raise CacheError("cache fingerprint escaped the selected cache root")
    return target


def validate_cache_entry(
    entry_dir: Path,
    fingerprint: str,
    provenance: dict[str, Any],
) -> tuple[bool, str | None, dict[str, Any] | None]:
    entry_path = entry_dir / "cache-entry.json"
    if not entry_path.is_file():
        return False, "no-exact-entry", None
    try:
        entry = load_json(entry_path, "cache entry")
    except CacheError as exc:
        return False, str(exc), None
    if entry.get("schemaVersion") != CACHE_SCHEMA_VERSION:
        return False, "cache-schema-version-mismatch", entry
    if entry.get("inputFingerprint") != fingerprint:
        return False, "input-fingerprint-mismatch", entry
    if entry.get("templateSha256") != provenance.get("templateSha256"):
        return False, "template-provenance-mismatch", entry
    if entry.get("promptVersion") != provenance.get("promptVersion"):
        return False, "prompt-version-mismatch", entry
    if entry.get("styleSettings") != provenance.get("styleSettings"):
        return False, "style-settings-mismatch", entry
    if entry.get("deterministicQaStatus") != "passed":
        return False, "deterministic-qa-not-passed", entry
    if entry.get("semanticReviewStatus") != "approved":
        return False, "semantic-review-not-approved", entry
    atlas_path = entry_dir / str(entry.get("atlasFile", ""))
    if not atlas_path.is_file():
        return False, "cached-atlas-missing", entry
    if sha256_file(atlas_path) != entry.get("atlasSha256"):
        return False, "cached-atlas-sha256-mismatch", entry
    return True, None, entry


def first_unfinished_row(run_state: dict[str, Any]) -> dict[str, Any] | None:
    rows = run_state.get("rows")
    if not isinstance(rows, list):
        raise CacheError("run-state rows are missing")
    for row in sorted(rows, key=lambda item: item.get("index", 999)):
        if row.get("status") not in {"completed", "validated"}:
            return {
                "index": row.get("index"),
                "state": row.get("state"),
                "status": row.get("status"),
            }
    return None


def plan_resume(
    run_dir: Path,
    cache_dir: Path,
    previous_request: Path | None,
) -> dict[str, Any]:
    run = run_dir.expanduser().resolve()
    provenance = load_json(run / "provenance.json", "run provenance")
    run_state = load_json(run / "run-state.json", "run state")
    fingerprint = provenance.get("inputFingerprint")
    cache_root = ensure_cache_root(cache_dir)
    entry_dir = cache_entry_dir(cache_root, fingerprint)
    exact, rejection, entry = validate_cache_entry(entry_dir, fingerprint, provenance)
    if exact:
        return {
            "schemaVersion": 1,
            "action": "reuse-validated-atlas",
            "reason": "An exact provenance match has passed deterministic QA and separate semantic approval.",
            "inputFingerprint": fingerprint,
            "cacheEntry": str(entry_dir / "cache-entry.json"),
            "atlas": str(entry_dir / entry["atlasFile"]),
            "nextRow": None,
            "traitDiff": None,
            "privacy": {"rawBundleCached": False, "cacheRootUserSelected": True},
        }

    unfinished = first_unfinished_row(run_state)
    completed = [
        row.get("index")
        for row in run_state.get("rows", [])
        if row.get("status") in {"completed", "validated"} and row.get("contentSha256")
    ]
    if unfinished and completed:
        return {
            "schemaVersion": 1,
            "action": "resume-interrupted-run",
            "reason": "The local run has provenance-bound completed rows and an unfinished row.",
            "inputFingerprint": fingerprint,
            "cacheEntryRejection": rejection,
            "completedRows": completed,
            "nextRow": unfinished,
            "traitDiff": None,
            "privacy": {"rawBundleCached": False, "cacheRootUserSelected": True},
        }

    diff = None
    if previous_request:
        diff = plan_diff(
            load_request(previous_request.expanduser().resolve(), "previous"),
            load_request(run / "input" / "request.json", "current"),
        )
    return {
        "schemaVersion": 1,
        "action": diff["action"] if diff else "generate-all-rows",
        "reason": diff["reason"] if diff else "No reusable exact cache entry or completed row was found.",
        "inputFingerprint": fingerprint,
        "cacheEntryRejection": rejection,
        "completedRows": completed,
        "nextRow": unfinished,
        "traitDiff": diff,
        "privacy": {"rawBundleCached": False, "cacheRootUserSelected": True},
    }


def store_cache(
    run_dir: Path,
    atlas_path: Path,
    cache_dir: Path,
) -> dict[str, Any]:
    run = run_dir.expanduser().resolve()
    atlas = atlas_path.expanduser().resolve()
    provenance = load_json(run / "provenance.json", "run provenance")
    deterministic = load_json(run / "qa" / "deterministic-qa.json", "deterministic QA")
    semantic = load_json(run / "qa" / "semantic-review.json", "semantic review")
    if deterministic.get("status") != "passed":
        raise CacheError("deterministic QA must pass before storing a cache entry")
    if semantic.get("status") != "approved":
        raise CacheError("semantic review must be separately approved before storing a cache entry")
    deterministic_hash = sha256_file(run / "qa" / "deterministic-qa.json")
    if semantic.get("deterministicQaSha256") != deterministic_hash:
        raise CacheError("semantic review is not bound to the current deterministic QA report")
    deterministic_atlas_hash = deterministic.get("atlas", {}).get("sha256")
    atlas_hash = sha256_file(atlas)
    if deterministic_atlas_hash != atlas_hash:
        raise CacheError("atlas does not match the artifact measured by deterministic QA")

    cache_root = ensure_cache_root(cache_dir)
    fingerprint = provenance.get("inputFingerprint")
    entry_dir = cache_entry_dir(cache_root, fingerprint)
    entry_path = entry_dir / "cache-entry.json"
    atlas_name = f"validated-atlas{atlas.suffix.lower() or '.png'}"
    cached_atlas = entry_dir / atlas_name
    entry = {
        "schemaVersion": CACHE_SCHEMA_VERSION,
        "inputFingerprint": fingerprint,
        "imageSha256": provenance.get("imageSha256"),
        "templateId": provenance.get("templateId"),
        "templateSha256": provenance.get("templateSha256"),
        "adapterVersion": provenance.get("adapterVersion"),
        "promptVersion": provenance.get("promptVersion"),
        "policyVersion": provenance.get("policyVersion"),
        "styleSettings": provenance.get("styleSettings"),
        "deterministicQaStatus": "passed",
        "deterministicQaSha256": deterministic_hash,
        "semanticReviewStatus": "approved",
        "semanticReviewSha256": sha256_file(run / "qa" / "semantic-review.json"),
        "atlasFile": atlas_name,
        "atlasSha256": atlas_hash,
        "privacy": {
            "rawBundleCached": False,
            "requestSidecarCached": False,
            "canonicalInputImageCached": False,
            "finalValidatedAtlasCached": True,
        },
    }
    if entry_path.exists():
        existing = load_json(entry_path, "existing cache entry")
        if existing != entry or not cached_atlas.is_file() or sha256_file(cached_atlas) != atlas_hash:
            raise CacheError("an incompatible cache entry already exists for this fingerprint")
        return {
            "schemaVersion": 1,
            "status": "already-stored",
            "cacheEntry": str(entry_path),
            "atlas": str(cached_atlas),
            "atlasSha256": atlas_hash,
        }
    entry_dir.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(atlas, cached_atlas)
    entry_path.write_text(json.dumps(entry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        "schemaVersion": 1,
        "status": "stored",
        "cacheEntry": str(entry_path),
        "atlas": str(cached_atlas),
        "atlasSha256": atlas_hash,
    }


def write_result(result: dict[str, Any], output: Path | None) -> None:
    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding="utf-8")
    print(encoded, end="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    plan = subparsers.add_parser("plan", help="Plan exact reuse or interrupted-run resume.")
    plan.add_argument("--run-dir", type=Path, required=True)
    plan.add_argument("--cache-dir", type=Path, required=True)
    plan.add_argument("--previous-request", type=Path)
    plan.add_argument("--json-out", type=Path)
    store = subparsers.add_parser("store", help="Store a fully validated final atlas.")
    store.add_argument("--run-dir", type=Path, required=True)
    store.add_argument("--atlas", type=Path, required=True)
    store.add_argument("--cache-dir", type=Path, required=True)
    store.add_argument("--json-out", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "plan":
            result = plan_resume(args.run_dir, args.cache_dir, args.previous_request)
        else:
            result = store_cache(args.run_dir, args.atlas, args.cache_dir)
        write_result(result, args.json_out)
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(f"ERROR: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
