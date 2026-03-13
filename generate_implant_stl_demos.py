#!/usr/bin/env python3
"""Generate 3 demo arch scan STL files with embedded scan bodies at different angulations."""
import numpy as np
import trimesh
import os


def create_arch_scan_with_scan_body(
    scan_body_angle_deg=15.0,
    scan_body_height=10.0,
    scan_body_radius=2.75,
    arch_length=25.0,
    arch_width=10.0,
    arch_height=6.0,
    n_arch_x=40,
    n_arch_y=20,
    add_adjacent_teeth=True,
):
    """
    Creates a synthetic partial arch scan with an implant scan body.

    The arch:
    - A curved ridge surface (gum tissue) — the base of the scan
    - Two adjacent tooth stumps on mesial and distal sides
    - A cylindrical scan body at the specified angulation
    """
    vertices = []
    faces = []

    # ── 1. Gum ridge surface (curved base) ──────────────────────────────────
    # Creates a smooth ridge — wider at base, narrowing toward the top
    xs = np.linspace(-arch_length/2, arch_length/2, n_arch_x)
    ys = np.linspace(-arch_width/2, arch_width/2, n_arch_y)

    ridge_verts = []
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            # Arch curvature in Z — ridge rises slightly in the middle
            z_curve = arch_height * (1.0 - (x/(arch_length/2))**2 * 0.3)
            # Ridge cross-section shape — higher in center (labial/buccal aspect)
            z_cross = z_curve * np.exp(-0.5 * (y / (arch_width * 0.4))**2)
            ridge_verts.append([x, y, z_cross])

    ridge_verts = np.array(ridge_verts)
    base_v_idx = len(vertices)
    vertices.extend(ridge_verts.tolist())

    # Ridge surface faces (grid quads → triangles)
    for i in range(n_arch_x - 1):
        for j in range(n_arch_y - 1):
            v00 = base_v_idx + i * n_arch_y + j
            v10 = base_v_idx + (i+1) * n_arch_y + j
            v01 = base_v_idx + i * n_arch_y + (j+1)
            v11 = base_v_idx + (i+1) * n_arch_y + (j+1)
            faces.append([v00, v10, v01])
            faces.append([v10, v11, v01])

    # ── 2. Adjacent teeth (simplified tooth shapes) ──────────────────────────
    if add_adjacent_teeth:
        tooth_positions = [(-9.5, 0), (9.5, 0)]  # mesial and distal
        tooth_height = 10.0
        tooth_radius = 3.5
        n_tooth_sides = 32
        n_tooth_layers = 20

        for (tx, ty) in tooth_positions:
            base_z = arch_height * (1.0 - (tx/(arch_length/2))**2 * 0.3) * np.exp(-0.5*(ty/(arch_width*0.4))**2)
            t_base_idx = len(vertices)

            for li in range(n_tooth_layers + 1):
                t = li / n_tooth_layers
                z = base_z + tooth_height * t
                # Tooth tapers toward top (crown shape)
                r = tooth_radius * (1.0 - t * 0.35)
                for si in range(n_tooth_sides):
                    angle = 2 * np.pi * si / n_tooth_sides
                    # Organic noise
                    noise = 1 + 0.03 * np.sin(3*angle) * np.cos(2*np.pi*t)
                    vertices.append([tx + r*noise*np.cos(angle), ty + r*noise*np.sin(angle), z])

            # Tooth side faces
            for li in range(n_tooth_layers):
                for si in range(n_tooth_sides):
                    v0 = t_base_idx + li*n_tooth_sides + si
                    v1 = t_base_idx + li*n_tooth_sides + (si+1)%n_tooth_sides
                    v2 = t_base_idx + (li+1)*n_tooth_sides + si
                    v3 = t_base_idx + (li+1)*n_tooth_sides + (si+1)%n_tooth_sides
                    faces.append([v0, v2, v1]); faces.append([v1, v2, v3])

            # Tooth top cap
            top_idx = len(vertices)
            top_ring_z = base_z + tooth_height
            vertices.append([tx, ty, top_ring_z])
            ring_start = t_base_idx + n_tooth_layers * n_tooth_sides
            for si in range(n_tooth_sides):
                v0 = ring_start + si; v1 = ring_start + (si+1)%n_tooth_sides
                faces.append([top_idx, v0, v1])

    # ── 3. Scan body (angled cylinder) ───────────────────────────────────────
    # The scan body sits at the center of the arch, angled at scan_body_angle_deg
    # from vertical, tilted toward the buccal (positive Y) side

    n_sb_sides = 48
    n_sb_layers = 25

    # Base of scan body (at ridge level)
    sb_base_z = arch_height  # top of the ridge at center
    sb_base_xy = np.array([0.0, 0.0])

    # Scan body axis direction (angled from vertical)
    angle_rad = np.radians(scan_body_angle_deg)
    # Tilt in the X-Z plane (mesial-distal angulation is most common)
    sb_axis = np.array([np.sin(angle_rad), 0.0, np.cos(angle_rad)])

    # Create orthogonal basis for the cylinder
    # Up vector is sb_axis; we need two perpendicular vectors
    if abs(sb_axis[0]) < 0.9:
        u = np.cross(sb_axis, [1, 0, 0])
    else:
        u = np.cross(sb_axis, [0, 1, 0])
    u = u / np.linalg.norm(u)
    v = np.cross(sb_axis, u)
    v = v / np.linalg.norm(v)

    sb_base_idx = len(vertices)

    for li in range(n_sb_layers + 1):
        t = li / n_sb_layers
        # Position along the scan body axis
        center = np.array([sb_base_xy[0], sb_base_xy[1], sb_base_z]) + sb_axis * (scan_body_height * t)
        # Slight taper toward top (scan bodies are slightly tapered)
        r = scan_body_radius * (1.0 - t * 0.1)

        for si in range(n_sb_sides):
            angle = 2 * np.pi * si / n_sb_sides
            # Point on cylinder surface
            pt = center + r * (np.cos(angle) * u + np.sin(angle) * v)
            vertices.append(pt.tolist())

    # Scan body side faces
    for li in range(n_sb_layers):
        for si in range(n_sb_sides):
            v0 = sb_base_idx + li*n_sb_sides + si
            v1 = sb_base_idx + li*n_sb_sides + (si+1)%n_sb_sides
            v2 = sb_base_idx + (li+1)*n_sb_sides + si
            v3 = sb_base_idx + (li+1)*n_sb_sides + (si+1)%n_sb_sides
            faces.append([v0, v2, v1]); faces.append([v1, v2, v3])

    # Scan body top cap (flat hexagonal tip — characteristic of scan bodies)
    tip_center_idx = len(vertices)
    tip_pos = np.array([sb_base_xy[0], sb_base_xy[1], sb_base_z]) + sb_axis * scan_body_height
    vertices.append(tip_pos.tolist())
    tip_ring_start = sb_base_idx + n_sb_layers * n_sb_sides
    for si in range(n_sb_sides):
        v0 = tip_ring_start + si; v1 = tip_ring_start + (si+1)%n_sb_sides
        faces.append([tip_center_idx, v0, v1])

    # Scan body base cap
    base_center_idx = len(vertices)
    base_pos = np.array([sb_base_xy[0], sb_base_xy[1], sb_base_z])
    vertices.append(base_pos.tolist())
    for si in range(n_sb_sides):
        v0 = sb_base_idx + si; v1 = sb_base_idx + (si+1)%n_sb_sides
        faces.append([base_center_idx, v1, v0])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    mesh.fix_normals()
    trimesh.repair.fill_holes(mesh)
    return mesh


output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'stl')
os.makedirs(output_dir, exist_ok=True)

# Case A: 35° angulation → RED
print("Generating implant_a_red.stl (35° angulation — RED)...")
mesh_a = create_arch_scan_with_scan_body(scan_body_angle_deg=35.0, scan_body_height=10.0)
mesh_a.export(os.path.join(output_dir, 'implant_a_red.stl'))
print(f"  v {len(mesh_a.vertices)} verts, {len(mesh_a.faces)} faces")

# Case B: 10° angulation → GREEN
print("Generating implant_b_green.stl (10° angulation — GREEN)...")
mesh_b = create_arch_scan_with_scan_body(scan_body_angle_deg=10.0, scan_body_height=10.0)
mesh_b.export(os.path.join(output_dir, 'implant_b_green.stl'))
print(f"  v {len(mesh_b.vertices)} verts, {len(mesh_b.faces)} faces")

# Case C: 25° angulation → YELLOW
print("Generating implant_c_yellow.stl (25° angulation — YELLOW)...")
mesh_c = create_arch_scan_with_scan_body(scan_body_angle_deg=25.0, scan_body_height=10.0)
mesh_c.export(os.path.join(output_dir, 'implant_c_yellow.stl'))
print(f"  v {len(mesh_c.vertices)} verts, {len(mesh_c.faces)} faces")

print("\nAll implant demo STLs generated:")
print("  implant_a_red.stl    — 35° angulation (RED)")
print("  implant_b_green.stl  — 10° angulation (GREEN)")
print("  implant_c_yellow.stl — 25° angulation (YELLOW)")
