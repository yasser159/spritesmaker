#!/usr/bin/env python3
"""Generate realistic top-down aircraft/vessel sprites using HF Inference API (FLUX.1-schnell).
Includes QC pipeline: orientation detection, symmetry check, coverage check, auto-retry."""
import sys
import json
import requests
import os
from pathlib import Path
from io import BytesIO
from PIL import Image
import numpy as np

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
API_URL = f"https://router.huggingface.co/hf-inference/models/{MODEL_ID}"
MAX_RETRIES = 3
QC_MIN_SCORE = 60  # out of 100


def get_token():
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    cache = Path.home() / ".cache" / "huggingface" / "token"
    if cache.exists():
        return cache.read_text().strip()
    raise RuntimeError("No HF token found. Set HF_TOKEN or run `huggingface-cli login`.")


# ── Prompt Engineering ────────────────────────────────────────────────────────

def build_prompt(specs, attempt=0):
    """Build a highly specific prompt. Varies slightly per retry attempt."""
    category = specs.get("category", "narrowbody")
    name = specs.get("name", "aircraft")
    engines = specs.get("engines", 2)
    engine_type = specs.get("engineType", "jet")
    wingspan = specs.get("wingspan", 30)
    length = specs.get("length", 35)

    # Stronger prompt with explicit constraints
    core = (
        f"Technical blueprint-style top-down plan view of a {name}. "
        f"Perfectly vertical bird's-eye camera angle, exactly 90 degrees looking straight down. "
        f"Aircraft nose MUST point toward the top of the image. "
        f"Perfect bilateral left-right symmetry along the vertical centerline. "
        f"Dark gray aircraft ({hex_color(attempt)}) on a solid pure white #FFFFFF background. "
        f"No perspective distortion, no 3D angle, no tilt, no rotation. "
        f"Sharp clean outline, no blur, no shadows, no ground, no text, no labels. "
        f"Aircraft perfectly centered in frame. "
        f"Technical illustration style, flat shading."
    )

    details = {
        "helicopter": f" Helicopter with {engines} engines. Circular main rotor disc visible from above, elongated fuselage, narrow tail boom extending downward in image, small tail rotor at bottom.",
        "fighter": f" Military fighter jet with {engines} engine{'s' if engines > 1 else ''}. Swept or delta wing planform, narrow pointed fuselage, exhaust nozzle{'s' if engines > 1 else ''} at bottom of image.",
        "narrowbody": f" Single-aisle commercial jet airliner, {engines} turbofan engine pods mounted under swept wings, conventional horizontal tailplane at bottom of image. Wingspan {wingspan}m, length {length}m.",
        "widebody": f" Twin-aisle wide-body commercial jet, {engines} large turbofan engines under swept wings, wide oval fuselage cross-section. Wingspan {wingspan}m, length {length}m.",
        "regional": f" Small regional jet, {engines} engines {'mounted on rear fuselage near tail' if engines == 2 else 'under wings'}, T-tail horizontal stabilizer. Compact airframe.",
        "turboprop": f" Twin turboprop commuter aircraft, {engines} propeller engines on high-mounted straight wings, visible prop discs, T-tail. Wingspan {wingspan}m.",
        "light-piston": f" Small single-engine general aviation aircraft like a Cessna. High-mounted straight rectangular wings, single propeller at nose (top of image), fixed landing gear, simple conventional tail.",
        "bizjet": f" Business jet / private jet, {engines} engines mounted on rear fuselage flanking the tail, swept low wings, T-tail, sleek narrow fuselage. Length {length}m.",
        "vessel": f" {specs.get('vesselType', 'cargo')} ship viewed from directly above. Pointed bow at top, flat stern at bottom. Hull outline with deck details. White vessel on white background with dark outline.",
    }

    return core + details.get(category, "")


def hex_color(attempt):
    """Slightly vary the gray per attempt so AI doesn't get stuck."""
    grays = ["#7B8794", "#6B7280", "#8B949E"]
    return grays[attempt % len(grays)]


# ── Background Removal ────────────────────────────────────────────────────────

def remove_background(img):
    """Remove white background with flood-fill from corners for clean edges."""
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Step 1: Mark clearly white pixels as background
    white = (r > 230) & (g > 230) & (b > 230)
    # Step 2: Mark light gray that's uniform (not part of aircraft shading)
    light_uniform = (r > 210) & (g > 210) & (b > 210) & (np.abs(r.astype(int) - g.astype(int)) < 10) & (np.abs(g.astype(int) - b.astype(int)) < 10)

    # Step 3: Flood-fill from corners to find connected background
    from scipy.ndimage import label, binary_fill_holes
    bg_seed = white | light_uniform
    # Ensure corners are marked as background
    for cy, cx in [(0, 0), (0, w-1), (h-1, 0), (h-1, w-1)]:
        if not bg_seed[cy, cx]:
            bg_seed[max(0, cy-3):cy+4, max(0, cx-3):cx+4] = True

    # Label connected components — the largest one touching corners is background
    labeled, n = label(~bg_seed)  # label non-background regions
    # Background = anything NOT in a labeled foreground region that's connected to corners
    bg_label = labeled[0, 0]  # corner label
    bg_mask = bg_seed.copy()

    # Also remove any isolated white patches inside the aircraft (holes)
    # by only removing white connected to the image border
    border_white = np.zeros_like(white, dtype=bool)
    border_white[0, :] = white[0, :]
    border_white[-1, :] = white[-1, :]
    border_white[:, 0] = white[:, 0]
    border_white[:, -1] = white[:, -1]

    from scipy.ndimage import binary_dilation
    # Grow from border white to find all connected background white
    struct = np.ones((3, 3), dtype=bool)
    connected_bg = binary_dilation(border_white, structure=struct, iterations=max(h, w), mask=white | light_uniform)

    arr[connected_bg, 3] = 0

    # Anti-alias edges: partially transparent border pixels
    from scipy.ndimage import distance_transform_edt
    fg_mask = arr[:, :, 3] > 0
    if fg_mask.any():
        dist = distance_transform_edt(~fg_mask)
        edge = (dist > 0) & (dist < 2)
        arr[edge, 3] = np.clip(255 - (dist[edge] * 128).astype(int), 0, 255).astype(np.uint8)

    return Image.fromarray(arr)


# ── Quality Control ───────────────────────────────────────────────────────────

def qc_check(img_path):
    """Score a generated sprite on orientation, symmetry, and coverage. Returns (score, details)."""
    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    details = {}
    score = 0

    # 1. Coverage — should be 15-60% of pixels (not too sparse, not too full)
    total = h * w
    filled = (alpha > 30).sum()
    coverage = filled / total * 100
    details["coverage"] = f"{coverage:.1f}%"
    if 12 < coverage < 65:
        score += 25
    elif 8 < coverage < 75:
        score += 15
    else:
        score += 0
        details["coverage_issue"] = "too sparse or too full"

    # 2. Orientation — more content at top-center (nose) than bottom-center
    strip_w = w // 5  # center 20%
    x0, x1 = (w - strip_w) // 2, (w + strip_w) // 2
    top_half = alpha[:h // 2, x0:x1]
    bot_half = alpha[h // 2:, x0:x1]
    top_mass = (top_half > 30).sum()
    bot_mass = (bot_half > 30).sum()
    details["top_mass"] = int(top_mass)
    details["bot_mass"] = int(bot_mass)
    # Aircraft noses are narrow, tails are wide — so we check full width ratio instead
    top_row_mass = (alpha[:h // 3, :] > 30).sum()
    bot_row_mass = (alpha[2 * h // 3:, :] > 30).sum()
    # Nose should have SOME content at the very top
    nose_tip = (alpha[:h // 8, x0:x1] > 30).sum()
    details["nose_tip"] = int(nose_tip)
    if nose_tip > 5:
        score += 25  # nose present at top
    elif nose_tip > 0:
        score += 15
    else:
        details["orientation_issue"] = "no content at nose position"

    # 3. Symmetry — left half should mirror right half in alpha density
    left = (alpha[:, :w // 2] > 30).sum()
    right = (alpha[:, w // 2:] > 30).sum()
    sym_ratio = min(left, right) / max(left, right, 1)
    details["symmetry"] = f"{sym_ratio:.2f}"
    if sym_ratio > 0.85:
        score += 25
    elif sym_ratio > 0.70:
        score += 15
    else:
        details["symmetry_issue"] = f"asymmetric ({sym_ratio:.2f})"

    # 4. No holes — interior shouldn't have transparent gaps
    from scipy.ndimage import binary_fill_holes
    fg = alpha > 30
    filled_fg = binary_fill_holes(fg)
    holes = filled_fg.sum() - fg.sum()
    hole_pct = holes / max(filled, 1) * 100
    details["holes"] = f"{hole_pct:.1f}%"
    if hole_pct < 5:
        score += 25
    elif hole_pct < 15:
        score += 15
    else:
        details["hole_issue"] = f"too many holes ({hole_pct:.1f}%)"

    details["score"] = score
    return score, details


# ── Generation Pipeline ───────────────────────────────────────────────────────

def call_api(prompt, seed, token):
    """Call HF Inference API and return PIL Image."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": prompt, "parameters": {"seed": seed}}
    resp = requests.post(API_URL, headers=headers, json=payload, timeout=120)
    if resp.status_code != 200:
        raise RuntimeError(f"HF API error {resp.status_code}: {resp.text[:200]}")
    return Image.open(BytesIO(resp.content))


def generate(specs, output_path, seed=42):
    """Generate a sprite with QC loop — retries up to MAX_RETRIES times."""
    token = get_token()
    best_score = 0
    best_path = None

    for attempt in range(MAX_RETRIES):
        current_seed = seed + attempt * 7  # vary seed per retry
        prompt = build_prompt(specs, attempt)

        tag = f"[attempt {attempt + 1}/{MAX_RETRIES}]"
        print(f"\n{tag} Generating {specs.get('icao', specs.get('name', '?'))}...", flush=True)
        print(f"  prompt: {prompt[:100]}...", flush=True)
        print(f"  seed: {current_seed}", flush=True)

        try:
            raw = call_api(prompt, current_seed, token)
        except Exception as e:
            print(f"  API error: {e}", flush=True)
            continue

        print(f"  raw: {raw.size} {raw.mode}", flush=True)

        # Post-process
        processed = remove_background(raw)
        processed = processed.resize((128, 128), Image.LANCZOS)

        # Save attempt
        attempt_path = str(output_path).replace(".png", f"_attempt{attempt}.png")
        Path(attempt_path).parent.mkdir(parents=True, exist_ok=True)
        processed.save(attempt_path, "PNG")

        # QC check
        score, details = qc_check(attempt_path)
        print(f"  QC score: {score}/100 {details}", flush=True)

        if score > best_score:
            best_score = score
            best_path = attempt_path

        if score >= QC_MIN_SCORE:
            print(f"  PASS ✓", flush=True)
            break
        else:
            print(f"  FAIL ✗ — retrying with different seed...", flush=True)

    # Copy best attempt to final output
    if best_path:
        import shutil
        final = str(output_path)
        shutil.copy2(best_path, final)
        print(f"\n[result] Best score: {best_score}/100 → {final}", flush=True)

        # Clean up attempt files
        for i in range(MAX_RETRIES):
            p = str(output_path).replace(".png", f"_attempt{i}.png")
            if os.path.exists(p) and p != final:
                os.remove(p)
    else:
        print(f"\n[result] All attempts failed.", flush=True)

    return best_path


def main():
    if len(sys.argv) < 3:
        print("Usage: python generate-ai.py <specs.json> <output.png> [seed]")
        print("       python generate-ai.py --batch <specs1.json> <specs2.json> ...")
        sys.exit(1)

    specs_path = sys.argv[1]
    output_path = sys.argv[2]
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 42

    with open(specs_path) as f:
        specs = json.load(f)

    generate(specs, output_path, seed=seed)


if __name__ == "__main__":
    main()
