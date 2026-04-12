#!/usr/bin/env python3
"""Generate realistic top-down aircraft/vessel sprites using HF Inference API (FLUX.1-schnell)."""
import sys
import json
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageFilter
import numpy as np

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
API_URL = f"https://router.huggingface.co/hf-inference/models/{MODEL_ID}"


def get_token():
    """Read HF token from cache or env."""
    import os
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    cache = Path.home() / ".cache" / "huggingface" / "token"
    if cache.exists():
        return cache.read_text().strip()
    raise RuntimeError("No HF token found. Set HF_TOKEN or run `huggingface-cli login`.")


def build_prompt(specs):
    """Build an image generation prompt from aircraft/vessel specs."""
    category = specs.get("category", "narrowbody")
    name = specs.get("name", "aircraft")
    engines = specs.get("engines", 2)
    engine_type = specs.get("engineType", "jet")
    wingspan = specs.get("wingspan", 30)
    length = specs.get("length", 35)

    base = (
        f"Top-down orthographic aerial view of a {name}, "
        f"looking straight down from above, "
        f"highly detailed game sprite icon, "
        f"solid dark gray silhouette on pure white background, "
        f"nose pointing up toward top of image, "
        f"clean precise outline, symmetrical, centered, "
        f"no perspective, no shadows, no text, no labels, "
        f"wingspan {wingspan}m, length {length}m"
    )

    details = {
        "helicopter": ", helicopter with visible main rotor disc from above, tail boom extending down, skids visible",
        "fighter": f", military fighter jet, {engines} engine{'s' if engines > 1 else ''}, swept delta wings, pointed nose cone, twin vertical stabilizers",
        "narrowbody": f", narrow-body commercial airliner, {engines} jet engines visible under swept wings, conventional tail",
        "widebody": f", wide-body commercial airliner, {engines} large jet engines under swept wings, wide fuselage",
        "regional": f", regional jet airliner, {engines} engines, smaller swept wings, T-tail",
        "turboprop": f", turboprop commuter aircraft, {engines} propeller engines on straight wings, high wing",
        "light-piston": ", small single-engine Cessna-style aircraft, high straight wings, single nose propeller",
        "bizjet": f", business jet, {engines} rear-mounted engines near tail, swept wings, T-tail, sleek narrow fuselage",
        "vessel": f", {specs.get('vesselType', 'cargo')} ship from above, hull shape, bow at top, deck details visible",
    }

    return base + details.get(category, "")


def remove_background(img):
    """Remove white/light background, make it transparent."""
    arr = np.array(img.convert("RGBA"))
    # Detect near-white pixels (background)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    white_mask = (r > 220) & (g > 220) & (b > 220)
    # Also detect very light gray
    light_mask = (r > 200) & (g > 200) & (b > 200) & (np.abs(r.astype(int) - g.astype(int)) < 15)
    bg_mask = white_mask | light_mask
    arr[bg_mask, 3] = 0  # make transparent
    return Image.fromarray(arr)


def generate(specs, output_path, seed=42):
    """Generate a sprite via HF Inference API."""
    token = get_token()
    prompt = build_prompt(specs)
    print(f"[flux] Prompt: {prompt[:120]}...", flush=True)

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": prompt, "parameters": {"seed": seed}}

    print(f"[flux] Requesting from {MODEL_ID}...", flush=True)
    resp = requests.post(API_URL, headers=headers, json=payload, timeout=120)

    if resp.status_code != 200:
        raise RuntimeError(f"HF API error {resp.status_code}: {resp.text[:200]}")

    img = Image.open(BytesIO(resp.content))
    print(f"[flux] Raw image: {img.size} {img.mode}", flush=True)

    # Post-process
    img = remove_background(img)
    img = img.resize((128, 128), Image.LANCZOS)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    print(f"[flux] Saved: {output_path} ({Path(output_path).stat().st_size} bytes)", flush=True)
    return output_path


def main():
    if len(sys.argv) < 3:
        print("Usage: python generate-ai.py <specs.json> <output.png> [seed]")
        print("Example: python generate-ai.py specs.json output/B738-ai.png 42")
        sys.exit(1)

    specs_path = sys.argv[1]
    output_path = sys.argv[2]
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 42

    with open(specs_path) as f:
        specs = json.load(f)

    generate(specs, output_path, seed=seed)


if __name__ == "__main__":
    main()
