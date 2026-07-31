#!/usr/bin/env python3
"""Prepare a deterministic 1024px integration avatar from a rights-cleared v2 atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, UnidentifiedImageError


ATLAS_SIZE = (1536, 2288)
CELL_SIZE = (192, 208)
NEUTRAL_FALLBACK_CELL = (6, 0)
SCALE = 4
AVATAR_SIZE = (1024, 1024)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(atlas_path: Path, output_path: Path) -> dict[str, object]:
    try:
        with Image.open(atlas_path) as opened:
            source_format = opened.format
            atlas = opened.convert("RGBA")
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError(f"could not read source atlas: {exc}") from exc
    if atlas.size != ATLAS_SIZE:
        raise ValueError(f"source atlas must be {ATLAS_SIZE[0]}x{ATLAS_SIZE[1]}")
    column, row = NEUTRAL_FALLBACK_CELL
    left = column * CELL_SIZE[0]
    top = row * CELL_SIZE[1]
    cell = atlas.crop((left, top, left + CELL_SIZE[0], top + CELL_SIZE[1]))
    if cell.getchannel("A").getbbox() is None:
        raise ValueError("reserved neutral-look fallback cell is empty")
    scaled = cell.resize(
        (CELL_SIZE[0] * SCALE, CELL_SIZE[1] * SCALE),
        Image.Resampling.NEAREST,
    )
    avatar = Image.new("RGBA", AVATAR_SIZE, (0, 0, 0, 0))
    avatar.alpha_composite(
        scaled,
        (
            (AVATAR_SIZE[0] - scaled.width) // 2,
            (AVATAR_SIZE[1] - scaled.height) // 2,
        ),
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    avatar.save(output_path, format="PNG", optimize=False, compress_level=9)
    return {
        "schemaVersion": 1,
        "sourceFormat": source_format,
        "sourceAtlasSha256": sha256_file(atlas_path),
        "sourceCell": {
            "row": row,
            "column": column,
            "purpose": "neutral-look-fallback",
        },
        "method": "nearest-neighbor-4x-on-transparent-1024-canvas",
        "avatarSha256": sha256_file(output_path),
        "avatarWidth": avatar.width,
        "avatarHeight": avatar.height,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()
    try:
        result = prepare(
            args.atlas.expanduser().resolve(),
            args.output.expanduser().resolve(),
        )
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1
    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
