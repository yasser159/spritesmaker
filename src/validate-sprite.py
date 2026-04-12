#!/usr/bin/env python3
"""
Validate sprite orientation (nose-north check).

Usage:
    python3 src/validate-sprite.py output/B738.png

Exit code 0 = nose points north, 1 = nose points south
Stdout: JSON with topAlpha, botAlpha, noseNorth
"""
import json
import sys
from pathlib import Path
from PIL import Image

TIP_DEPTH = 8


def nose_direction(path):
    with Image.open(path).convert("RGBA") as img:
        width, height = img.size
        raw = img.load()

        min_x, min_y = width, height
        max_x, max_y = -1, -1

        for y in range(height):
            for x in range(width):
                if raw[x, y][3] <= 0:
                    continue
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y

        if max_x < min_x or max_y < min_y:
            return {"topAlpha": 0, "botAlpha": 0, "noseNorth": True}

        cropped_width = max_x - min_x + 1
        cropped_height = max_y - min_y + 1
        center_left = min_x + int(cropped_width * 0.4)
        center_right = min_x + int(cropped_width * 0.6)
        tip_depth = min(TIP_DEPTH, cropped_height)

        top_alpha = 0
        bot_alpha = 0

        for y in range(min_y, min_y + tip_depth):
            for x in range(center_left, center_right):
                top_alpha += raw[x, y][3]

        for y in range(max_y - tip_depth + 1, max_y + 1):
            for x in range(center_left, center_right):
                bot_alpha += raw[x, y][3]

    return {"topAlpha": top_alpha, "botAlpha": bot_alpha, "noseNorth": top_alpha >= bot_alpha}


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <sprite.png>", file=sys.stderr)
        return 1

    path = Path(sys.argv[1])
    if not path.exists():
        print(json.dumps({"error": "File not found"}))
        return 1

    result = nose_direction(path)
    print(json.dumps(result))
    return 0 if result["noseNorth"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
