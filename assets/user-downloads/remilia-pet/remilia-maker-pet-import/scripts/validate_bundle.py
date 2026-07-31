#!/usr/bin/env python3
"""Validate and optionally extract a versioned Remilia Maker pet-request ZIP."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZIP_STORED, BadZipFile, ZipFile


SCHEMA_VERSION = 1
ADAPTER_SKILL = "remilia-maker-pet-import"
FAMILIES = ("milady", "remilio", "bonkler", "kagami")
EXPECTED_ENTRIES = ("avatar.png", "request.json")
TRAITS = ("race", "hair", "eyes", "glasses", "shirt", "earrings")
TRAIT_POLICY = {
    "background": "omit",
    "friend": "omit",
    "overlay": "omit",
    "shirtText": "convert-to-unreadable-motif",
}
LEG_COVERAGE = {"exposed", "partial", "covered"}
LEG_COLORS = {
    "cool-pale",
    "warm-light",
    "warm-medium",
    "brown",
    "deep",
    "fantasy-green",
    "fantasy-blue",
}
APPAREL_COLORS = {"black", "white", "navy", "denim-blue", "khaki", "olive", "pink", "brown"}
BOTTOMS = {
    "maker-bottom-shorts-v1": ("shorts", 1, {"exposed", "partial"}),
    "maker-bottom-cargo-shorts-v1": ("cargo-shorts", 1, {"exposed", "partial"}),
    "maker-bottom-jeans-v1": ("jeans", 1, {"covered"}),
    "maker-bottom-dress-pants-v1": ("dress-pants", 1, {"covered"}),
    "maker-bottom-chinos-v1": ("chinos", 1, {"partial", "covered"}),
}
FOOTWEAR = {
    "maker-footwear-sneakers-v1": ("sneakers", 1),
    "maker-footwear-loafers-v1": ("loafers", 1),
    "maker-footwear-boots-v1": ("boots", 1),
    "maker-footwear-sandals-v1": ("sandals", 1),
}
ASSET_ID = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,79}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
MAX_AVATAR_BYTES = 12 * 1024 * 1024
MAX_REQUEST_BYTES = 256 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 16 * 1024 * 1024


class BundleValidationError(ValueError):
    """Raised when a bundle violates the public import contract."""


@dataclass(frozen=True)
class ValidatedBundle:
    bundle_path: Path
    bundle_bytes: bytes
    avatar_bytes: bytes
    request_bytes: bytes
    request: dict[str, Any]
    summary: dict[str, Any]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_bundle(bundle_path: Path) -> ValidatedBundle:
    path = bundle_path.expanduser().resolve()
    if not path.is_file():
        raise BundleValidationError(f"Bundle not found: {bundle_path}")
    bundle_bytes = path.read_bytes()
    if len(bundle_bytes) > MAX_ARCHIVE_BYTES:
        raise BundleValidationError(f"Bundle exceeds {MAX_ARCHIVE_BYTES} bytes.")
    try:
        with ZipFile(path) as archive:
            infos = archive.infolist()
            validate_entries(infos)
            avatar_bytes = archive.read("avatar.png")
            request_bytes = archive.read("request.json")
    except BadZipFile as exc:
        raise BundleValidationError(f"Bundle is not a readable ZIP: {exc}") from exc
    validate_png(avatar_bytes)
    request = parse_request(request_bytes)
    validate_request(request)
    actual_image_hash = sha256_bytes(avatar_bytes)
    if request["imageSha256"] != actual_image_hash:
        raise BundleValidationError(
            "avatar.png SHA-256 mismatch: "
            f"request.json declares {request['imageSha256']}, actual bytes are {actual_image_hash}."
        )
    request_hash = sha256_bytes(request_bytes)
    summary = {
        "ok": True,
        "schemaVersion": SCHEMA_VERSION,
        "adapterSkill": ADAPTER_SKILL,
        "bundleFile": path.name,
        "bundleSha256": sha256_bytes(bundle_bytes),
        "requestSha256": request_hash,
        "imageSha256": actual_image_hash,
        "templateFamily": request["templateFamily"],
        "templateVersion": request["templateVersion"],
        "templateId": f"{request['templateFamily']}-v{request['templateVersion']}",
        "rightsScope": request["rightsScope"],
        "traitCount": len(request["traits"]),
        "bodyCompletionCatalogVersion": request["bodyCompletion"]["catalogVersion"],
    }
    return ValidatedBundle(path, bundle_bytes, avatar_bytes, request_bytes, request, summary)


def validate_entries(infos: list[Any]) -> None:
    if len(infos) != 2:
        raise BundleValidationError("Bundle must contain exactly avatar.png and request.json.")
    names = [info.filename for info in infos]
    if tuple(names) != EXPECTED_ENTRIES:
        raise BundleValidationError(
            "Bundle entries must be ordered exactly as avatar.png, request.json; "
            f"received {names}."
        )
    if len(set(names)) != len(names):
        raise BundleValidationError("Bundle contains duplicate entry names.")
    total_uncompressed = 0
    for info in infos:
        if info.is_dir() or "/" in info.filename or "\\" in info.filename:
            raise BundleValidationError(f"Unsafe ZIP entry: {info.filename}")
        unix_mode = (info.external_attr >> 16) & 0xFFFF
        if unix_mode and stat.S_ISLNK(unix_mode):
            raise BundleValidationError(f"Symbolic-link ZIP entry is forbidden: {info.filename}")
        if info.flag_bits & 0x1:
            raise BundleValidationError(f"Encrypted ZIP entry is forbidden: {info.filename}")
        if info.compress_type not in {ZIP_STORED, ZIP_DEFLATED}:
            raise BundleValidationError(f"Unsupported ZIP compression for {info.filename}.")
        total_uncompressed += info.file_size
        if info.file_size > 0 and info.compress_size == 0:
            raise BundleValidationError(f"Invalid compressed size for {info.filename}.")
        if info.compress_size > 0 and info.file_size / info.compress_size > 250:
            raise BundleValidationError(f"Suspicious ZIP compression ratio for {info.filename}.")
    if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
        raise BundleValidationError("Bundle expands beyond the local import limit.")
    by_name = {info.filename: info for info in infos}
    if by_name["avatar.png"].file_size > MAX_AVATAR_BYTES:
        raise BundleValidationError("avatar.png exceeds the 12 MB import limit.")
    if by_name["request.json"].file_size > MAX_REQUEST_BYTES:
        raise BundleValidationError("request.json exceeds the 256 KB import limit.")


def validate_png(value: bytes) -> None:
    if len(value) < 24 or value[:8] != b"\x89PNG\r\n\x1a\n":
        raise BundleValidationError("avatar.png is not a PNG.")
    if value[12:16] != b"IHDR":
        raise BundleValidationError("avatar.png is missing its IHDR header.")
    width, height = struct.unpack(">II", value[16:24])
    if (width, height) != (1024, 1024):
        raise BundleValidationError(
            f"avatar.png must be 1024x1024; received {width}x{height}."
        )


def parse_request(value: bytes) -> dict[str, Any]:
    if len(value) > MAX_REQUEST_BYTES:
        raise BundleValidationError("request.json exceeds the 256 KB import limit.")
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BundleValidationError("request.json must be UTF-8.") from exc
    try:
        request = json.loads(text)
    except json.JSONDecodeError as exc:
        raise BundleValidationError(f"request.json is invalid JSON: {exc}") from exc
    if not isinstance(request, dict):
        raise BundleValidationError("request.json must contain an object.")
    return request


def validate_request(request: dict[str, Any]) -> None:
    allowed = {
        "schemaVersion",
        "adapterSkill",
        "templateFamily",
        "templateFamilyOptions",
        "templateVersion",
        "sourceNftNumber",
        "imageSha256",
        "image",
        "traits",
        "traitPolicy",
        "bodyCompletion",
        "rightsScope",
        "generator",
        "pet",
    }
    required = allowed - {"pet", "sourceNftNumber"}
    reject_keys(request, allowed, "request.json")
    require_keys(request, required, "request.json")
    if request["schemaVersion"] != SCHEMA_VERSION:
        raise BundleValidationError(f"Unsupported schemaVersion: {request['schemaVersion']}")
    if request["adapterSkill"] != ADAPTER_SKILL:
        raise BundleValidationError(f"adapterSkill must be {ADAPTER_SKILL}.")
    if request["templateFamily"] not in FAMILIES:
        raise BundleValidationError(f"Unsupported templateFamily: {request['templateFamily']}")
    if request["templateFamilyOptions"] != list(FAMILIES):
        raise BundleValidationError("templateFamilyOptions must declare all four families in contract order.")
    if request["templateVersion"] != 1:
        raise BundleValidationError("Only templateVersion 1 is supported.")
    if "sourceNftNumber" in request:
        ranges = {
            "milady": (0, 9999),
            "remilio": (1, 10000),
            "bonkler": (1, 150),
            "kagami": (1, 3000),
        }
        lower, upper = ranges[request["templateFamily"]]
        value = request["sourceNftNumber"]
        if isinstance(value, bool) or not isinstance(value, int) or not lower <= value <= upper:
            raise BundleValidationError(
                f"sourceNftNumber must be an integer from {lower} to {upper} for {request['templateFamily']}."
            )
    if not isinstance(request["imageSha256"], str) or not SHA256.fullmatch(request["imageSha256"]):
        raise BundleValidationError("imageSha256 must be a lowercase SHA-256 digest.")
    validate_image_record(request["image"])
    validate_traits(request["traits"])
    if request["traitPolicy"] != TRAIT_POLICY:
        raise BundleValidationError(
            "traitPolicy must omit background, friend, and overlay, and convert shirt text."
        )
    validate_body_completion(request["bodyCompletion"])
    if request["rightsScope"] not in {"private-review", "publication-cleared"}:
        raise BundleValidationError("rightsScope must be private-review or publication-cleared.")
    validate_pet(request.get("pet"))
    validate_generator(request["generator"])


def validate_image_record(image: Any) -> None:
    if not isinstance(image, dict):
        raise BundleValidationError("image must be an object.")
    reject_keys(image, {"file", "mediaType", "width", "height"}, "image")
    require_keys(image, {"file", "mediaType", "width", "height"}, "image")
    if image != {
        "file": "avatar.png",
        "mediaType": "image/png",
        "width": 1024,
        "height": 1024,
    }:
        raise BundleValidationError("image must declare the canonical 1024x1024 avatar.png contract.")


def validate_traits(traits: Any) -> None:
    if not isinstance(traits, dict) or set(traits) != set(TRAITS):
        raise BundleValidationError(
            "traits must contain exactly race, hair, eyes, glasses, shirt, and earrings."
        )
    for trait_name in TRAITS:
        trait = traits[trait_name]
        if not isinstance(trait, dict):
            raise BundleValidationError(f"traits.{trait_name} must be an object.")
        reject_keys(trait, {"assetId", "label"}, f"traits.{trait_name}")
        require_keys(trait, {"assetId"}, f"traits.{trait_name}")
        asset_id = trait["assetId"]
        if not isinstance(asset_id, str) or not ASSET_ID.fullmatch(asset_id):
            raise BundleValidationError(
                f"traits.{trait_name}.assetId must be a stable lowercase asset ID; use 'none' explicitly."
            )
        label = trait.get("label")
        if label is not None and (not isinstance(label, str) or len(label) > 120):
            raise BundleValidationError(f"traits.{trait_name}.label must be at most 120 characters.")


def validate_body_completion(completion: Any) -> None:
    if not isinstance(completion, dict):
        raise BundleValidationError("bodyCompletion is required; no lower half may be inferred.")
    allowed = {"catalogVersion", "legCoverage", "legColorVariant", "bottom", "footwear"}
    reject_keys(completion, allowed, "bodyCompletion")
    require_keys(completion, allowed, "bodyCompletion")
    if completion["catalogVersion"] != 1:
        raise BundleValidationError("Only bodyCompletion catalogVersion 1 is supported.")
    if completion["legCoverage"] not in LEG_COVERAGE:
        raise BundleValidationError("bodyCompletion.legCoverage is unsupported.")
    if completion["legColorVariant"] not in LEG_COLORS:
        raise BundleValidationError("bodyCompletion.legColorVariant is unsupported.")
    validate_bottom(completion["bottom"], completion["legCoverage"])
    validate_footwear(completion["footwear"])


def validate_bottom(bottom: Any, leg_coverage: str) -> None:
    validate_body_asset_shape(bottom, "bodyCompletion.bottom")
    asset = BOTTOMS.get(bottom["assetId"])
    if not asset:
        raise BundleValidationError("bodyCompletion.bottom.assetId is not in catalog version 1.")
    category, version, coverage = asset
    if bottom["category"] != category or bottom["assetVersion"] != version:
        raise BundleValidationError("bodyCompletion.bottom category/version does not match its assetId.")
    if leg_coverage not in coverage:
        raise BundleValidationError(
            f"{bottom['assetId']} is incompatible with {leg_coverage} leg coverage."
        )


def validate_footwear(footwear: Any) -> None:
    validate_body_asset_shape(footwear, "bodyCompletion.footwear")
    asset = FOOTWEAR.get(footwear["assetId"])
    if not asset:
        raise BundleValidationError("bodyCompletion.footwear.assetId is not in catalog version 1.")
    category, version = asset
    if footwear["category"] != category or footwear["assetVersion"] != version:
        raise BundleValidationError("bodyCompletion.footwear category/version does not match its assetId.")


def validate_body_asset_shape(asset: Any, label: str) -> None:
    if not isinstance(asset, dict):
        raise BundleValidationError(f"{label} must be an object.")
    required = {"category", "assetId", "assetVersion", "colorVariant"}
    reject_keys(asset, required, label)
    require_keys(asset, required, label)
    if asset["colorVariant"] not in APPAREL_COLORS:
        raise BundleValidationError(f"{label}.colorVariant is unsupported.")


def validate_pet(pet: Any) -> None:
    if pet is None:
        return
    if not isinstance(pet, dict):
        raise BundleValidationError("pet must be an object.")
    reject_keys(pet, {"name", "personality"}, "pet")
    for key, limit in (("name", 80), ("personality", 280)):
        value = pet.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip() or len(value) > limit):
            raise BundleValidationError(f"pet.{key} must be a nonempty string of at most {limit} characters.")


def validate_generator(generator: Any) -> None:
    expected = {
        "id": "tweet-composer-kit",
        "version": "0.2.0-pilot",
        "deterministicCompositeVersion": 1,
    }
    if generator != expected:
        raise BundleValidationError("generator metadata is unsupported or incomplete.")


def reject_keys(value: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise BundleValidationError(f"{label} contains unsupported field(s): {', '.join(unknown)}.")


def require_keys(value: dict[str, Any], required: set[str], label: str) -> None:
    missing = sorted(required - set(value))
    if missing:
        raise BundleValidationError(f"{label} is missing required field(s): {', '.join(missing)}.")


def extract_bundle(bundle: ValidatedBundle, output_dir: Path, force: bool = False) -> None:
    target = output_dir.expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    outputs = {
        target / "avatar.png": bundle.avatar_bytes,
        target / "request.json": bundle.request_bytes,
    }
    existing = [path for path in outputs if path.exists()]
    if existing and not force:
        raise BundleValidationError(
            f"Refusing to overwrite existing extracted input: {', '.join(path.name for path in existing)}."
        )
    for path, value in outputs.items():
        path.write_bytes(value)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--extract-to", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        bundle = load_bundle(args.bundle)
        if args.extract_to:
            extract_bundle(bundle, args.extract_to, force=args.force)
        if args.json_out:
            write_json(args.json_out, bundle.summary)
        print(json.dumps(bundle.summary, indent=2, sort_keys=True))
        return 0
    except (BundleValidationError, OSError) as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
