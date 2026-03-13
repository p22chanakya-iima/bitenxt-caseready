#!/usr/bin/env python3
"""Generate 3 demo STL files for BiteNxt CaseReady prototype."""
import numpy as np
import trimesh
import os


def create_tooth_prep_mesh(
    base_radius, top_radius, height,
    n_sides=32, subdivisions=3,
    add_undercut=False, undercut_depth=0.3,
    add_asymmetry=False
):
    """Create a realistic tooth preparation mesh (truncated cone with variations)."""
    vertices = []
    faces = []

    # Create layers from bottom to top
    n_layers = 20
    for i in range(n_layers + 1):
        t = i / n_layers
        z = height * t
        r = base_radius + (top_radius - base_radius) * t

        # Add slight organic irregularity
        for j in range(n_sides):
            angle = 2 * np.pi * j / n_sides
            noise = 1 + 0.02 * np.sin(3 * angle) * np.cos(2 * np.pi * t)

            # Bake in undercut in lower-mid zone on mesial side (angle near 0)
            if add_undercut and 0.2 < t < 0.45:
                if -0.5 < np.cos(angle) < 0.3:
                    undercut_factor = undercut_depth * np.sin(np.pi * (t - 0.2) / 0.25)
                    r_local = r * noise - undercut_factor * r
                else:
                    r_local = r * noise
            elif add_asymmetry and t > 0.7:
                r_local = r * noise * (1 + 0.08 * np.cos(angle))
            else:
                r_local = r * noise

            x = r_local * np.cos(angle)
            y = r_local * np.sin(angle)
            vertices.append([x, y, z])

    # Create faces connecting adjacent rings
    for i in range(n_layers):
        for j in range(n_sides):
            v0 = i * n_sides + j
            v1 = i * n_sides + (j + 1) % n_sides
            v2 = (i + 1) * n_sides + j
            v3 = (i + 1) * n_sides + (j + 1) % n_sides
            faces.append([v0, v1, v2])
            faces.append([v1, v3, v2])

    # Add occlusal surface (top cap)
    center_top = len(vertices)
    vertices.append([0, 0, height])
    top_ring_start = n_layers * n_sides
    for j in range(n_sides):
        v0 = top_ring_start + j
        v1 = top_ring_start + (j + 1) % n_sides
        faces.append([v0, center_top, v1])

    # Add base cap (bottom)
    center_bottom = len(vertices)
    vertices.append([0, 0, 0])
    for j in range(n_sides):
        v0 = j
        v1 = (j + 1) % n_sides
        faces.append([v1, center_bottom, v0])

    verts = np.array(vertices)
    fcs = np.array(faces)

    mesh = trimesh.Trimesh(vertices=verts, faces=fcs)
    mesh.fix_normals()

    return mesh


output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'stl')
os.makedirs(output_dir, exist_ok=True)

# Case A: Tooth 36 Implant - RED (undercut + low taper)
print("Generating Case A: Tooth 36 Implant (RED)...")
mesh_a = create_tooth_prep_mesh(
    base_radius=5.2, top_radius=3.8, height=6.0,
    n_sides=48, add_undercut=True, undercut_depth=0.35
)
mesh_a.export(os.path.join(output_dir, 'case_a_tooth36_implant.stl'))
print(f"  Vertices: {len(mesh_a.vertices)}, Faces: {len(mesh_a.faces)}")

# Case B: Tooth 14 Natural - GREEN (clean, ideal taper)
print("Generating Case B: Tooth 14 Natural (GREEN)...")
mesh_b = create_tooth_prep_mesh(
    base_radius=4.2, top_radius=2.8, height=5.5,
    n_sides=48, add_undercut=False
)
mesh_b.export(os.path.join(output_dir, 'case_b_tooth14_natural.stl'))
print(f"  Vertices: {len(mesh_b.vertices)}, Faces: {len(mesh_b.faces)}")

# Case C: Tooth 21 Anterior - YELLOW (slight asymmetry, borderline)
print("Generating Case C: Tooth 21 Anterior (YELLOW)...")
mesh_c = create_tooth_prep_mesh(
    base_radius=3.6, top_radius=2.0, height=5.0,
    n_sides=48, add_asymmetry=True
)
mesh_c.export(os.path.join(output_dir, 'case_c_tooth21_anterior.stl'))
print(f"  Vertices: {len(mesh_c.vertices)}, Faces: {len(mesh_c.faces)}")

print("\nAll demo STL files generated in public/stl/")
print("Case A (RED):    case_a_tooth36_implant.stl")
print("Case B (GREEN):  case_b_tooth14_natural.stl")
print("Case C (YELLOW): case_c_tooth21_anterior.stl")
