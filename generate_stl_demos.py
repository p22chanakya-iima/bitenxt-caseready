#!/usr/bin/env python3
"""Generate 3 demo STL files for BiteNxt CaseReady prototype."""
import numpy as np
import trimesh
import os


def create_tooth_prep(
    base_radius,     # radius at margin (bottom)
    top_radius,      # radius at occlusal (top)
    height,          # total height in mm
    n_sides=64,      # polygon count for smooth mesh
    n_layers=30,     # vertical layers
    chamfer_depth=0.4,   # how deep the chamfer groove is (mm)
    chamfer_height=0.3,  # height of chamfer zone
    add_undercut=False,
    undercut_angle=0.3,  # radians of inward fold
    undercut_sector=0.4, # fraction of circumference affected
    taper_noise=0.015,   # organic surface noise amplitude
):
    """
    Creates a realistic tooth preparation mesh.

    The prep has 3 zones (bottom to top):
    1. Margin zone (bottom 15%): chamfer shape — slight outward then sharp inward groove
    2. Axial zone (15-85%): straight tapered walls with slight organic noise
    3. Occlusal zone (top 15%): flattening toward occlusal surface
    """
    vertices = []
    faces = []

    for layer_i in range(n_layers + 1):
        t = layer_i / n_layers  # 0.0 (bottom) to 1.0 (top)
        z = height * t

        # Base radius at this layer (linear taper)
        r_taper = base_radius + (top_radius - base_radius) * t

        # Zone modifiers
        if t < 0.15:
            # Margin zone: chamfer shape
            # At t=0 (base): normal radius
            # At t~0.05: slight outward bulge (tooth surface below margin)
            # At t~0.10: chamfer groove (inward step)
            # At t~0.15: back to taper line
            margin_t = t / 0.15  # 0 to 1 within margin zone
            # Create a subtle S-curve: out then in
            chamfer_offset = chamfer_depth * np.sin(margin_t * np.pi) * np.sin(margin_t * np.pi * 0.5)
            r_mod = r_taper + chamfer_offset * 0.3 - chamfer_depth * margin_t * 0.5
        elif t > 0.85:
            # Occlusal zone: flatten slightly
            occlusal_t = (t - 0.85) / 0.15
            r_mod = r_taper * (1 - occlusal_t * 0.05)
        else:
            r_mod = r_taper

        for j in range(n_sides):
            angle = 2 * np.pi * j / n_sides

            # Organic noise (makes it look real, not perfectly geometric)
            noise = 1 + taper_noise * np.sin(3 * angle + t * 5) * np.cos(2 * angle)
            r_local = r_mod * noise

            # Undercut: buccal side (angles near 0) in lower-mid axial zone
            if add_undercut and 0.2 < t < 0.5:
                # Which sector is affected
                angle_norm = angle / (2 * np.pi)  # 0 to 1
                if angle_norm < undercut_sector or angle_norm > (1 - undercut_sector * 0.3):
                    # Sine envelope for smooth undercut shape
                    depth_t = np.sin(np.pi * (t - 0.2) / 0.3)
                    angle_factor = np.cos(angle_norm * np.pi / undercut_sector) if angle_norm < undercut_sector else 0.3
                    undercut_delta = undercut_angle * r_taper * depth_t * max(0, angle_factor)
                    r_local = r_local - undercut_delta

            x = r_local * np.cos(angle)
            y = r_local * np.sin(angle)
            vertices.append([x, y, z])

    # Side faces (quads split into triangles)
    for i in range(n_layers):
        for j in range(n_sides):
            v0 = i * n_sides + j
            v1 = i * n_sides + (j + 1) % n_sides
            v2 = (i + 1) * n_sides + j
            v3 = (i + 1) * n_sides + (j + 1) % n_sides
            faces.append([v0, v2, v1])
            faces.append([v1, v2, v3])

    # Occlusal cap (top)
    top_center_idx = len(vertices)
    vertices.append([0, 0, height])
    top_ring_start = n_layers * n_sides
    for j in range(n_sides):
        v0 = top_ring_start + j
        v1 = top_ring_start + (j + 1) % n_sides
        faces.append([top_center_idx, v0, v1])

    # Base cap (bottom)
    base_center_idx = len(vertices)
    vertices.append([0, 0, 0])
    for j in range(n_sides):
        v0 = j
        v1 = (j + 1) % n_sides
        faces.append([base_center_idx, v1, v0])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    mesh.fix_normals()
    # Fill any holes
    trimesh.repair.fill_holes(mesh)

    return mesh


output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'stl')
os.makedirs(output_dir, exist_ok=True)

# Taper geometry: top_radius = base_radius - tan(target_degrees) * height
# This ensures face normals on axial walls measure exactly the target angle.
# Dentistry convention: taper angle = half-angle of each axial wall from insertion axis.
# Ideal: 4-8 degrees per wall. Scoring: <2 or >12 = RED, 2-12 = YELLOW, 4-8 = GREEN.

# -- CASE A: Tooth 14 Natural Crown -> RED -------------------------------------------
# Upper premolar. Near-parallel walls (2 deg taper) + buccal undercut.
# top_radius = 4.5 - tan(2deg)*5.5 = 4.5 - 0.0349*5.5 = 4.308
print("Generating Case A: Tooth 14 Natural Crown (RED)...")
mesh_a = create_tooth_prep(
    base_radius=4.5,
    top_radius=4.308,   # tan(2deg)*5.5 = 0.192mm reduction -> 2deg taper -> RED
    height=5.5,
    n_sides=80,
    n_layers=80,
    chamfer_depth=0.25,
    add_undercut=True,
    undercut_angle=0.75,  # aggressive undercut to ensure detection above threshold
    undercut_sector=0.40,
    taper_noise=0.008,
)
path_a = os.path.join(output_dir, 'case_a_tooth14_natural.stl')
mesh_a.export(path_a)
print(f"  Done: {path_a}  ({len(mesh_a.vertices)} verts, {len(mesh_a.faces)} faces)")

# -- CASE B: Tooth 21 Natural Crown -> GREEN -----------------------------------------
# Upper central incisor. Ideal 6 deg taper, no undercuts, smooth margin.
# top_radius = 4.0 - tan(6deg)*5.0 = 4.0 - 0.1051*5.0 = 3.474
print("Generating Case B: Tooth 21 Natural Crown (GREEN)...")
mesh_b = create_tooth_prep(
    base_radius=4.0,
    top_radius=3.474,   # tan(6deg)*5.0 = 0.526mm reduction -> 6deg taper -> GREEN
    height=5.0,
    n_sides=80,
    n_layers=80,
    chamfer_depth=0.20,
    add_undercut=False,
    taper_noise=0.004,  # minimal noise - ideal clean scan
)
path_b = os.path.join(output_dir, 'case_b_tooth21_natural.stl')
mesh_b.export(path_b)
print(f"  Done: {path_b}  ({len(mesh_b.vertices)} verts, {len(mesh_b.faces)} faces)")

# -- CASE C: Tooth 36 Natural Crown -> YELLOW ----------------------------------------
# Lower molar. Over-tapered (10 deg) - common error on posterior teeth.
# top_radius = 5.5 - tan(10deg)*6.0 = 5.5 - 0.1763*6.0 = 4.442
print("Generating Case C: Tooth 36 Natural Crown (YELLOW)...")
mesh_c = create_tooth_prep(
    base_radius=5.5,
    top_radius=4.442,   # tan(10deg)*6.0 = 1.058mm reduction -> 10deg taper -> YELLOW
    height=6.0,
    n_sides=80,
    n_layers=80,
    chamfer_depth=0.25,
    add_undercut=False,
    taper_noise=0.006,
)
path_c = os.path.join(output_dir, 'case_c_tooth36_natural.stl')
mesh_c.export(path_c)
print(f"  Done: {path_c}  ({len(mesh_c.vertices)} verts, {len(mesh_c.faces)} faces)")

print("\n-------------------------------------------------")
print("All 3 demo STL files generated (natural crown preps):")
print("  Case A (RED):    Tooth 14 - undercut + low taper")
print("  Case B (GREEN):  Tooth 21 - ideal geometry")
print("  Case C (YELLOW): Tooth 36 - over-tapered axial walls")
print("-------------------------------------------------")
print("\nNOTE: Implant crown cases require scan body detection")
print("(Phase 2). Natural crown analysis only in this prototype.")
