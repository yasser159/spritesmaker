"""
Render a 3D model as a top-down sprite PNG using Blender.

Usage:
    blender --background --python src/blender-render.py -- \
        --model path/to/model.glb --output output/B738.png --size 128

Adapted from flight-tracker/tools/render_sprites.py for standalone
single-model use in the SpriteMaker pipeline.
"""

import bpy
import os
import sys
import math
import json
import argparse
import tempfile

import mathutils


# ---------------------------------------------------------------------------
# CLI argument parsing (handles Blender's -- separator)
# ---------------------------------------------------------------------------

def parse_args():
    """Parse script args after Blender's '--' separator."""
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(
        description="Render a 3D model as a top-down sprite PNG.",
    )
    parser.add_argument("--model", required=True, help="Path to the input 3D model (.glb, .gltf, .obj, .fbx)")
    parser.add_argument("--output", required=True, help="Path for the output PNG sprite")
    parser.add_argument("--size", type=int, default=128, help="Sprite resolution in pixels (default: 128)")
    parser.add_argument("--no-orient", action="store_true", help="Skip nose-north orientation correction")
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------

def clear_scene():
    """Remove all default objects and orphan data blocks."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def setup_scene(size):
    """Configure Cycles for a transparent-background RGBA PNG render."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"


def setup_camera():
    """Create an orthographic camera looking straight down from z=10."""
    bpy.ops.object.camera_add(location=(0, 0, 10))
    cam = bpy.context.object
    cam.name = "TopDownCamera"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0  # adjusted later by auto_frame
    cam.rotation_euler = (0, 0, 0)  # looking straight down (-Z)
    bpy.context.scene.camera = cam
    return cam


def setup_lighting():
    """Add key + fill SUN lights for even top-down illumination."""
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
    sun = bpy.context.object
    sun.data.energy = 3.0
    sun.rotation_euler = (0, 0, 0)

    bpy.ops.object.light_add(type="SUN", location=(2, 2, 8))
    fill = bpy.context.object
    fill.data.energy = 1.5
    fill.rotation_euler = (math.radians(20), math.radians(20), 0)


# ---------------------------------------------------------------------------
# Model import
# ---------------------------------------------------------------------------

def import_model(filepath):
    """Import a GLB/GLTF/OBJ/FBX model and return a list of imported objects."""
    before = {obj.as_pointer() for obj in bpy.context.scene.objects}
    ext = os.path.splitext(filepath)[1].lower()

    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=filepath)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=filepath)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=filepath)
    else:
        raise ValueError(f"Unsupported model format: {ext}")

    imported = [
        obj
        for obj in bpy.context.scene.objects
        if obj.as_pointer() not in before and obj.type not in {"CAMERA", "LIGHT"}
    ]
    return imported


# ---------------------------------------------------------------------------
# 3D Geometry — vertex-level analysis for proper orientation
# ---------------------------------------------------------------------------

def collect_world_vertices(mesh_objects):
    """Collect all world-space vertices from mesh objects."""
    verts = []
    for obj in mesh_objects:
        mesh = obj.data
        for v in mesh.vertices:
            world_co = obj.matrix_world @ v.co
            verts.append((world_co.x, world_co.y, world_co.z))
    return verts


def compute_3d_bounds(verts):
    """Compute axis-aligned bounding box from vertex list."""
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    return {
        "min_x": min(xs), "max_x": max(xs),
        "min_y": min(ys), "max_y": max(ys),
        "min_z": min(zs), "max_z": max(zs),
        "cx": (min(xs) + max(xs)) / 2,
        "cy": (min(ys) + max(ys)) / 2,
        "cz": (min(zs) + max(zs)) / 2,
        "sx": max(xs) - min(xs),
        "sy": max(ys) - min(ys),
        "sz": max(zs) - min(zs),
    }


def pca_3d(verts):
    """
    PCA on 3D vertices. Returns three principal axes sorted by eigenvalue (largest first).
    Each axis is a (vx, vy, vz) unit vector.
    """
    n = len(verts)
    if n < 10:
        return [(1, 0, 0), (0, 1, 0), (0, 0, 1)]

    mx = sum(v[0] for v in verts) / n
    my = sum(v[1] for v in verts) / n
    mz = sum(v[2] for v in verts) / n

    # Covariance matrix (3x3)
    cxx = cyy = czz = cxy = cxz = cyz = 0.0
    for v in verts:
        dx, dy, dz = v[0] - mx, v[1] - my, v[2] - mz
        cxx += dx * dx
        cyy += dy * dy
        czz += dz * dz
        cxy += dx * dy
        cxz += dx * dz
        cyz += dy * dz
    cxx /= n; cyy /= n; czz /= n; cxy /= n; cxz /= n; cyz /= n

    # Use mathutils.Matrix for eigendecomposition
    cov = mathutils.Matrix(((cxx, cxy, cxz), (cxy, cyy, cyz), (cxz, cyz, czz)))

    # Power iteration to find principal eigenvector (largest eigenvalue)
    def power_iter(mat, num_iter=50):
        v = mathutils.Vector((0.577, 0.577, 0.577))
        for _ in range(num_iter):
            v = mat @ v
            v.normalize()
        eigenvalue = (mat @ v).length
        return v, eigenvalue

    # First principal axis
    axis1, ev1 = power_iter(cov)

    # Deflate: remove first component
    m2 = cov - mathutils.Matrix((
        (ev1 * axis1.x * axis1.x, ev1 * axis1.x * axis1.y, ev1 * axis1.x * axis1.z),
        (ev1 * axis1.y * axis1.x, ev1 * axis1.y * axis1.y, ev1 * axis1.y * axis1.z),
        (ev1 * axis1.z * axis1.x, ev1 * axis1.z * axis1.y, ev1 * axis1.z * axis1.z),
    ))

    # Second principal axis
    axis2, ev2 = power_iter(m2)

    # Third is cross product
    axis3 = axis1.cross(axis2)
    axis3.normalize()

    return [
        (axis1, ev1),
        (axis2, ev2),
        (axis3, 0),
    ]


def identify_axes(mesh_objects):
    """
    Identify which 3D axes correspond to fuselage (longest), wings (widest), and vertical (thinnest).
    Returns rotation to align: fuselage→Y, wings→X, vertical→Z.

    For aircraft: fuselage is the longest extent, wings are the widest perpendicular extent,
    and the vertical (height) is the thinnest.
    """
    verts = collect_world_vertices(mesh_objects)
    if len(verts) < 10:
        return None

    bounds = compute_3d_bounds(verts)
    axes = pca_3d(verts)

    # The first principal axis (highest variance) is ambiguous for aircraft:
    # - If wingspan > fuselage length, axis1 = wings direction
    # - If fuselage > wingspan, axis1 = fuselage direction
    # Solution: project onto XY plane and check which axis is "longer" vs "wider"

    # Use bounding box dimensions to identify axes
    dims = [(bounds["sx"], "X"), (bounds["sy"], "Y"), (bounds["sz"], "Z")]
    dims.sort(key=lambda d: d[0], reverse=True)

    print(f"  [orient] bbox: X={bounds['sx']:.1f} Y={bounds['sy']:.1f} Z={bounds['sz']:.1f}")
    print(f"  [orient] sorted: {dims[0][1]}={dims[0][0]:.1f} (longest), {dims[1][1]}={dims[1][0]:.1f} (mid), {dims[2][1]}={dims[2][0]:.1f} (thin)")

    # For aircraft:
    # - Longest or second-longest axis in XY plane = fuselage
    # - The other XY axis = wings
    # - Thinnest axis = vertical (height)
    # The "vertical" of the aircraft body is the thinnest dimension

    # Find which world axis is "up" (thinnest extent = aircraft height)
    thin_axis = dims[2][1]  # thinnest = vertical
    # The two larger axes are in the planform plane (fuselage + wings)

    # For top-down rendering we need: thin_axis → Z (camera looks down Z)
    # Then in the remaining two axes, fuselage → Y (nose-up), wings → X

    return {
        "thin": thin_axis,
        "dims": {d[1]: d[0] for d in dims},
        "bounds": bounds,
        "longest": dims[0][1],
        "mid": dims[1][1],
    }


def align_model_for_topdown(imported, mesh_objects):
    """
    Rotate the model so that:
    1. Thinnest PCA axis (aircraft height) → Z (camera looks down Z)
    2. Longest PCA axis (fuselage) → Y (nose up in image)
    3. Mid PCA axis (wings) → X
    4. Nose detection: narrower end of fuselage axis points +Y

    Uses 3D vertex PCA — works for ANY model orientation, not just axis-aligned.
    """
    verts = collect_world_vertices(mesh_objects)
    if len(verts) < 10:
        return None

    bounds = compute_3d_bounds(verts)
    cx, cy, cz = bounds["cx"], bounds["cy"], bounds["cz"]

    # PCA gives us three axes sorted by variance (largest = most spread)
    axes = pca_3d(verts)
    axis1_vec, ev1 = axes[0]  # longest spread
    axis2_vec, ev2 = axes[1]  # second spread
    axis3_vec, ev3 = axes[2]  # thinnest spread (height)

    print(f"  [orient] PCA eigenvalues: {ev1:.1f}, {ev2:.1f}, {ev3:.1f}")
    print(f"  [orient] axis1 (longest): ({axis1_vec.x:.3f}, {axis1_vec.y:.3f}, {axis1_vec.z:.3f})")
    print(f"  [orient] axis3 (thin):    ({axis3_vec.x:.3f}, {axis3_vec.y:.3f}, {axis3_vec.z:.3f})")

    # For aircraft: wings are symmetric → PCA axis1 could be fuselage OR wings
    # The fuselage has more vertex density along its length (cockpit, cabin, tail details)
    # Wings are thinner with less vertex density.
    # Heuristic: project vertices onto each axis, measure the DENSITY distribution.
    # The axis with more concentration near center = wings (symmetric, thin)
    # The axis with more spread-out distribution = fuselage

    # Simpler heuristic: after alignment, if X > Y, wings are along X → swap.
    # But first we need to know which PCA axis is "up" (thinnest = height).
    # axis3 (smallest eigenvalue) = height direction.
    # Between axis1 and axis2: the one more perpendicular to gravity (horizontal) = wings
    # The one more along the model's forward direction = fuselage

    # Since we don't know gravity yet, we'll assign:
    # - axis1 → fuselage candidate (Y), axis2 → wings candidate (X)
    # Then check after rotation: if X > Y, swap them.

    # Ensure right-handed: recompute axis2 = axis3 × axis1
    axis2_corrected = axis3_vec.cross(axis1_vec)
    axis2_corrected.normalize()

    # Build rotation: axis2 → X, axis1 → Y, axis3 → Z
    rot = mathutils.Matrix((
        (axis2_corrected.x, axis1_vec.x, axis3_vec.x),
        (axis2_corrected.y, axis1_vec.y, axis3_vec.y),
        (axis2_corrected.z, axis1_vec.z, axis3_vec.z),
    )).to_4x4()

    # The inverse maps world coords into PCA-aligned coords
    rot_inv = rot.inverted()

    # Apply: translate to origin → rotate to align → translate back
    transform = (
        mathutils.Matrix.Translation((cx, cy, cz))
        @ rot_inv
        @ mathutils.Matrix.Translation((-cx, -cy, -cz))
    )

    for obj in imported:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()

    print(f"  [orient] applied PCA alignment rotation")

    # Now the model should be: fuselage along Y, wings along X, height along Z
    # Verify by checking new bounds
    verts = collect_world_vertices(mesh_objects)
    nb = compute_3d_bounds(verts)
    print(f"  [orient] aligned bbox: X={nb['sx']:.1f} Y={nb['sy']:.1f} Z={nb['sz']:.1f}")

    # After PCA alignment, axis1 (longest) → Y, axis2 → X.
    # For jets: fuselage is longest → Y is fuselage, X is wings ✓
    # For GA (Cessna): wingspan is longest → Y is wings, X is fuselage ✗
    # Fix: if Y > X significantly AND the model looks like wings-along-Y,
    # rotate 90° so fuselage goes along Y.
    # Detection: Y-axis symmetry test — wings are symmetric, fuselage is not.

    # Check Y-axis symmetry: compare +X and -X vertex counts
    mid_x = nb["cx"]
    left = sum(1 for v in verts if v[0] < mid_x)
    right = sum(1 for v in verts if v[0] >= mid_x)
    x_sym = min(left, right) / max(left, right, 1)

    mid_y = nb["cy"]
    top = sum(1 for v in verts if v[1] > mid_y)
    bot = sum(1 for v in verts if v[1] <= mid_y)
    y_sym = min(top, bot) / max(top, bot, 1)

    print(f"  [orient] symmetry: X-axis={x_sym:.2f} Y-axis={y_sym:.2f}")

    # Dorsal/belly check: camera looks down -Z, so +Z side faces camera.
    # The dorsal (top) side of an aircraft has MORE vertex detail (cockpit, windows,
    # wing upper surface, antennas) than the smooth belly (fewer vertices).
    # If belly is facing +Z (toward camera), flip 180° around X to show dorsal side.
    mid_z = nb["cz"]
    plus_z_count = sum(1 for v in verts if v[2] > mid_z)
    minus_z_count = sum(1 for v in verts if v[2] <= mid_z)
    # Also check vertex density in the top 20% vs bottom 20% of Z range
    z_range = nb["max_z"] - nb["min_z"]
    top_20 = sum(1 for v in verts if v[2] > nb["max_z"] - z_range * 0.2)
    bot_20 = sum(1 for v in verts if v[2] < nb["min_z"] + z_range * 0.2)
    print(f"  [orient] Z-split: +Z={plus_z_count} -Z={minus_z_count} (top20%={top_20} bot20%={bot_20})")

    # The side with MORE detail (vertices) is the dorsal side and should face +Z (camera)
    # If -Z has more detail, flip around X axis
    dorsal_is_plus_z = plus_z_count >= minus_z_count
    if not dorsal_is_plus_z:
        print(f"  [orient] belly facing camera — flipping around X to show dorsal side")
        flip_x = (
            mathutils.Matrix.Translation((nb["cx"], nb["cy"], nb["cz"]))
            @ mathutils.Matrix.Rotation(math.radians(180), 4, "X")
            @ mathutils.Matrix.Translation((-nb["cx"], -nb["cy"], -nb["cz"]))
        )
        for obj in imported:
            obj.matrix_world = flip_x @ obj.matrix_world
        bpy.context.view_layer.update()
        verts = collect_world_vertices(mesh_objects)
        nb = compute_3d_bounds(verts)

    # Wings should be along X (high X-symmetry = left-right mirror = wings along X ✓)
    # If Y-symmetry > X-symmetry, wings are along Y → need 90° rotation
    if y_sym > x_sym + 0.02 and nb["sy"] > nb["sx"] * 0.8:
        print(f"  [orient] wings along Y (Y more symmetric), rotating 90° so fuselage→Y")
        rot90 = (
            mathutils.Matrix.Translation((nb["cx"], nb["cy"], 0))
            @ mathutils.Matrix.Rotation(math.radians(90), 4, "Z")
            @ mathutils.Matrix.Translation((-nb["cx"], -nb["cy"], 0))
        )
        for obj in imported:
            obj.matrix_world = rot90 @ obj.matrix_world
        bpy.context.view_layer.update()
        verts = collect_world_vertices(mesh_objects)
        nb = compute_3d_bounds(verts)

    # Detect nose: compare X-spread at the TIPS (10% of Y-extent), not full halves.
    # Nose = tapers to a point (narrow tip). Tail = horizontal stabilizer (wide tip).
    y_min = nb["min_y"]
    y_max = nb["max_y"]
    y_span = y_max - y_min
    tip_depth = y_span * 0.10  # 10% tip strip

    plus_y_tip = [v for v in verts if v[1] > y_max - tip_depth]
    minus_y_tip = [v for v in verts if v[1] < y_min + tip_depth]

    def x_spread(vs):
        if len(vs) < 2: return 0
        xs = [v[0] for v in vs]
        return max(xs) - min(xs)

    sp_plus = x_spread(plus_y_tip)
    sp_minus = x_spread(minus_y_tip)
    n_plus = len(plus_y_tip)
    n_minus = len(minus_y_tip)
    print(f"  [orient] tip check: +Y tip spread={sp_plus:.2f} ({n_plus}v), -Y tip spread={sp_minus:.2f} ({n_minus}v)")

    # Wider tip = tail (horizontal stabilizer). Narrower tip = nose.
    # If +Y tip is wider → tail is at +Y → nose is at -Y → flip 180°
    if sp_plus > sp_minus * 1.3:
        print(f"  [orient] flipping 180° — nose is at -Y")
        rot180 = (
            mathutils.Matrix.Translation((nb["cx"], nb["cy"], 0))
            @ mathutils.Matrix.Rotation(math.radians(180), 4, "Z")
            @ mathutils.Matrix.Translation((-nb["cx"], -nb["cy"], 0))
        )
        for obj in imported:
            obj.matrix_world = rot180 @ obj.matrix_world
        bpy.context.view_layer.update()

    # Final bounds
    verts = collect_world_vertices(mesh_objects)
    fb = compute_3d_bounds(verts)
    return fb["cx"], fb["cy"], fb


def auto_frame(cam, imported):
    """Align model for top-down view, then frame the camera."""
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects found in imported model")

    result = align_model_for_topdown(imported, mesh_objects)
    if result is None:
        raise RuntimeError("Failed to orient model")

    cx, cy, fb = result

    extent = max(fb["sx"], fb["sy"]) * 1.2  # 20% padding
    cam_z = fb["max_z"] + extent * 0.5

    cam.location = (cx, cy, cam_z)
    cam.data.ortho_scale = extent
    cam.data.clip_end = cam_z * 2 + extent

    print(f"  [camera] pos=({cx:.1f},{cy:.1f},{cam_z:.1f}) ortho={extent:.1f}")

    return cx, cy


# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------

def rotate_objects_around_center(objects, angle_radians, cx, cy):
    """Rotate all objects around an arbitrary XY point using matrix math."""
    rotation = (
        mathutils.Matrix.Translation((cx, cy, 0))
        @ mathutils.Matrix.Rotation(angle_radians, 4, "Z")
        @ mathutils.Matrix.Translation((-cx, -cy, 0))
    )
    for obj in objects:
        obj.matrix_world = rotation @ obj.matrix_world
    bpy.context.view_layer.update()


# ---------------------------------------------------------------------------
# Nose-north validation (inline -- avoids subprocess from inside Blender)
# ---------------------------------------------------------------------------

def validate_nose_north(image_path):
    """Check whether the sprite's nose points north using Blender's image API."""
    TIP_DEPTH = 8

    # Load image via Blender (avoids PIL dependency)
    img = bpy.data.images.load(image_path, check_existing=False)
    width, height = img.size[0], img.size[1]
    pixels = list(img.pixels)  # flat RGBA: [r,g,b,a, r,g,b,a, ...]

    def get_alpha(x, y):
        # Blender stores pixels bottom-to-top, we need top-to-bottom
        flipped_y = height - 1 - y
        idx = (flipped_y * width + x) * 4 + 3  # alpha channel
        return pixels[idx] if 0 <= idx < len(pixels) else 0

    # Find opaque bounding box
    min_x, min_y = width, height
    max_x, max_y = -1, -1
    for y in range(height):
        for x in range(width):
            if get_alpha(x, y) <= 0.01:
                continue
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

    bpy.data.images.remove(img)

    if max_x < min_x or max_y < min_y:
        return True, 0, 0

    cropped_width = max_x - min_x + 1
    cropped_height = max_y - min_y + 1
    center_left = min_x + int(cropped_width * 0.4)
    center_right = min_x + int(cropped_width * 0.6)
    tip_depth = min(TIP_DEPTH, cropped_height)

    top_alpha = 0.0
    bot_alpha = 0.0

    for y in range(min_y, min_y + tip_depth):
        for x in range(center_left, center_right):
            top_alpha += get_alpha(x, y)

    for y in range(max_y - tip_depth + 1, max_y + 1):
        for x in range(center_left, center_right):
            bot_alpha += get_alpha(x, y)

    return top_alpha >= bot_alpha, int(top_alpha * 255), int(bot_alpha * 255)


# ---------------------------------------------------------------------------
# PCA-based fuselage axis alignment
# ---------------------------------------------------------------------------

def detect_fuselage_angle(image_path):
    """
    Use PCA on opaque pixels to find the fuselage axis angle.
    Returns the angle (radians) to rotate CW to make fuselage vertical.
    """
    img = bpy.data.images.load(image_path, check_existing=False)
    width, height = img.size[0], img.size[1]
    pixels = list(img.pixels)

    # Collect opaque pixel coordinates (image space: origin top-left)
    # Use center 40% strip horizontally to weight fuselage over wingtips
    all_coords = []
    for y in range(height):
        for x in range(width):
            flipped_y = height - 1 - y
            idx = (flipped_y * width + x) * 4 + 3
            if idx < len(pixels) and pixels[idx] > 0.05:
                all_coords.append((x, y))

    if len(all_coords) < 20:
        bpy.data.images.remove(img)
        return 0.0

    # Find horizontal center of mass, then keep only center 40% strip for PCA
    mean_x_all = sum(c[0] for c in all_coords) / len(all_coords)
    xs_all = [c[0] for c in all_coords]
    x_spread = max(xs_all) - min(xs_all)
    strip_half = x_spread * 0.2  # 40% center strip
    coords = [(x, y) for x, y in all_coords
              if abs(x - mean_x_all) < strip_half]
    if len(coords) < 20:
        coords = all_coords  # fallback to all pixels

    bpy.data.images.remove(img)

    if len(coords) < 20:
        return 0.0  # too few pixels, skip alignment

    # PCA: compute covariance matrix of pixel positions
    n = len(coords)
    mean_x = sum(c[0] for c in coords) / n
    mean_y = sum(c[1] for c in coords) / n

    cov_xx = sum((c[0] - mean_x) ** 2 for c in coords) / n
    cov_yy = sum((c[1] - mean_y) ** 2 for c in coords) / n
    cov_xy = sum((c[0] - mean_x) * (c[1] - mean_y) for c in coords) / n

    # Eigenvalue decomposition of 2x2 covariance matrix
    # Principal eigenvector direction = fuselage axis
    trace = cov_xx + cov_yy
    det = cov_xx * cov_yy - cov_xy * cov_xy
    discriminant = max(0, (trace / 2) ** 2 - det)
    sqrt_disc = discriminant ** 0.5

    lambda1 = trace / 2 + sqrt_disc  # larger eigenvalue
    lambda2 = trace / 2 - sqrt_disc

    # Eigenvector for lambda1 (principal axis)
    if abs(cov_xy) > 1e-6:
        vx = lambda1 - cov_yy
        vy = cov_xy
    elif cov_xx >= cov_yy:
        vx, vy = 1.0, 0.0
    else:
        vx, vy = 0.0, 1.0

    # Angle of principal axis from vertical (Y-axis = up in image space)
    # atan2(vx, vy) gives angle from Y-axis
    angle = math.atan2(vx, vy)

    # Elongation ratio: if the sprite is roughly square (like a helicopter rotor disc),
    # PCA alignment would be arbitrary — skip it
    elongation = lambda1 / max(lambda2, 1e-6)
    if elongation < 1.5:
        return 0.0  # too circular, don't rotate

    print(f"  [pca] fuselage angle: {math.degrees(angle):.1f}° (elongation: {elongation:.1f})")
    return angle


# ---------------------------------------------------------------------------
# Orientation correction
# ---------------------------------------------------------------------------

def render_png(output_path):
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)


def ensure_nose_north(imported, cx, cy, cam, output_path):
    """
    Post-render validation: log pixel-level nose-north check but DO NOT override
    the 3D vertex-based alignment. The 3D tip analysis is authoritative.
    The pixel check is unreliable for jets (tail stabilizer has similar alpha to nose).
    """
    model_name = os.path.splitext(os.path.basename(output_path))[0].upper()

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        probe_path = tmp.name

    try:
        render_png(probe_path)
        ok, top_a, bot_a = validate_nose_north(probe_path)

        if ok:
            print(f"  [{model_name}] pixel check: nose-north OK (top={top_a} bot={bot_a})")
        else:
            # Log warning but do NOT flip — 3D vertex analysis is more reliable
            print(f"  [{model_name}] pixel check: nose-south (top={top_a} bot={bot_a}) — trusting 3D alignment")

        return {"top": top_a, "bot": bot_a, "pixel_ok": ok}
    finally:
        try:
            os.remove(probe_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)

    clear_scene()
    setup_scene(args.size)
    cam = setup_camera()
    setup_lighting()

    imported = import_model(os.path.abspath(args.model))
    if not imported:
        print(json.dumps({"success": False, "error": "No objects imported from model"}))
        sys.exit(1)

    cx, cy = auto_frame(cam, imported)

    orientation = None
    if not args.no_orient:
        orientation = ensure_nose_north(imported, cx, cy, cam, args.output)
        if orientation is None:
            print(json.dumps({"success": False, "error": "Failed to orient sprite nose-north"}))
            sys.exit(1)

    render_png(os.path.abspath(args.output))

    result = {
        "success": True,
        "output": os.path.abspath(args.output),
        "size": args.size,
        "model": os.path.basename(args.model),
    }
    if orientation:
        result["orientation"] = orientation

    print(json.dumps(result))


if __name__ == "__main__":
    main()
