from http.server import BaseHTTPRequestHandler
import json
import uuid
from datetime import datetime
import cgi
import io
import tempfile
import os

import trimesh
import numpy as np


def validate_scan_quality(mesh):
    issues = []

    is_watertight = bool(mesh.is_watertight)
    is_consistent = bool(mesh.is_winding_consistent)

    if not is_watertight:
        issues.append("Mesh has open boundaries — scan may be incomplete")
    if not is_consistent:
        issues.append("Inconsistent face normals — mesh orientation unreliable")

    vertex_count = len(mesh.vertices)
    face_count = len(mesh.faces)

    if vertex_count < 5000:
        issues.append(f"Low vertex count ({vertex_count}) — scan resolution may be insufficient")
    if vertex_count > 500000:
        issues.append(f"Very high vertex count ({vertex_count}) — consider decimating")

    face_areas = mesh.area_faces
    degenerate_count = int(np.sum(face_areas < 1e-6))
    degenerate_ratio = degenerate_count / max(len(face_areas), 1)
    if degenerate_ratio > 0.02:
        issues.append(f"High degenerate face ratio ({degenerate_ratio:.1%})")

    bounds = mesh.bounds
    dimensions = bounds[1] - bounds[0]
    for i, axis in enumerate(['X', 'Y', 'Z']):
        if dimensions[i] < 2.0:
            issues.append(f"{axis}-dimension unusually small ({dimensions[i]:.1f}mm) — check scale")
        if dimensions[i] > 30.0:
            issues.append(f"{axis}-dimension unusually large ({dimensions[i]:.1f}mm) — full arch?")

    quality_score = max(0, 100 - len(issues) * 20)
    usable = len(issues) < 3

    return {
        "quality_score": quality_score,
        "is_watertight": is_watertight,
        "is_winding_consistent": is_consistent,
        "vertex_count": vertex_count,
        "face_count": face_count,
        "degenerate_face_ratio": round(float(degenerate_ratio), 4),
        "dimensions": {
            "x": round(float(dimensions[0]), 2),
            "y": round(float(dimensions[1]), 2),
            "z": round(float(dimensions[2]), 2)
        },
        "issues": issues,
        "usable": usable
    }


def detect_undercuts(mesh):
    face_normals = mesh.face_normals
    face_centers = mesh.triangles_center

    bounds = mesh.bounds
    zmin = bounds[0][2]
    zmax = bounds[1][2]
    height = zmax - zmin
    zmid = zmin + height * 0.5

    lower_faces = face_centers[:, 2] < zmid
    upward_normals = face_normals[:, 2] > 0.3
    undercut_faces = lower_faces & upward_normals
    undercut_face_ratio = float(np.sum(undercut_faces)) / max(len(face_normals), 1)

    x_range = np.linspace(bounds[0][0], bounds[1][0], 15)
    y_range = np.linspace(bounds[0][1], bounds[1][1], 15)
    xx, yy = np.meshgrid(x_range, y_range)

    ray_origins = np.column_stack([
        xx.flatten(),
        yy.flatten(),
        np.full(225, zmax + 5)
    ])
    ray_directions = np.tile([0, 0, -1], (225, 1))

    try:
        locations, index_ray, index_tri = mesh.ray.intersects_location(
            ray_origins=ray_origins,
            ray_directions=ray_directions
        )

        rays_with_multiple_hits = 0
        for ray_idx in range(225):
            hits_this_ray = np.sum(index_ray == ray_idx)
            if hits_this_ray > 1:
                rays_with_multiple_hits += 1

        multi_hit_ratio = float(rays_with_multiple_hits) / 225
    except Exception:
        multi_hit_ratio = 0.0

    undercut_detected = (undercut_face_ratio > 0.05) or (multi_hit_ratio > 0.08)

    if multi_hit_ratio > 0.20:
        severity = "severe"
    elif multi_hit_ratio > 0.08 or undercut_face_ratio > 0.05:
        severity = "moderate"
    else:
        severity = "none"

    return {
        "undercut_detected": undercut_detected,
        "severity": severity,
        "undercut_face_ratio": round(undercut_face_ratio, 4),
        "multi_hit_ratio": round(multi_hit_ratio, 4)
    }


def measure_taper_angle(mesh):
    face_normals = mesh.face_normals
    face_centers = mesh.triangles_center

    bounds = mesh.bounds
    zmin = bounds[0][2]
    height = bounds[1][2] - zmin

    lower_z = zmin + height * 0.15
    upper_z = zmin + height * 0.85

    axial_zone = (face_centers[:, 2] > lower_z) & (face_centers[:, 2] < upper_z)
    mostly_horizontal = np.abs(face_normals[:, 2]) < 0.5
    axial_faces = axial_zone & mostly_horizontal

    if np.sum(axial_faces) < 10:
        return {
            "mean_taper_deg": None,
            "std_taper_deg": None,
            "distribution": {"under_4": 0, "ideal_4_to_8": 0, "over_8": 0},
            "axial_face_count": 0,
            "error": "Insufficient axial faces detected"
        }

    axial_normals = face_normals[axial_faces]
    z_components = np.abs(axial_normals[:, 2])
    xy_magnitudes = np.sqrt(axial_normals[:, 0]**2 + axial_normals[:, 1]**2)
    xy_magnitudes = np.maximum(xy_magnitudes, 1e-10)

    taper_angles = np.degrees(np.arctan2(z_components, xy_magnitudes))

    mean_taper = float(np.mean(taper_angles))
    std_taper = float(np.std(taper_angles))

    return {
        "mean_taper_deg": round(mean_taper, 2),
        "std_taper_deg": round(std_taper, 2),
        "distribution": {
            "under_4": round(float(np.mean(taper_angles < 4)) * 100, 1),
            "ideal_4_to_8": round(float(np.mean((taper_angles >= 4) & (taper_angles <= 8))) * 100, 1),
            "over_8": round(float(np.mean(taper_angles > 8)) * 100, 1)
        },
        "axial_face_count": int(np.sum(axial_faces))
    }


def detect_margin_line(mesh):
    try:
        vertex_curvature = trimesh.curvature.discrete_mean_curvature_measure(
            mesh, mesh.vertices, radius=0.5
        )
    except Exception:
        return {
            "margin_detected": False,
            "margin_regularity_score": None,
            "margin_z_variation_mm": None,
            "margin_vertex_count": 0
        }

    abs_curvature = np.abs(vertex_curvature)

    bounds = mesh.bounds
    zmin = bounds[0][2]
    height = bounds[1][2] - zmin
    margin_z_threshold = zmin + height * 0.30

    margin_zone_mask = mesh.vertices[:, 2] < margin_z_threshold

    if np.sum(margin_zone_mask) < 10:
        return {"margin_detected": False, "margin_vertex_count": 0}

    margin_curvature_vals = abs_curvature[margin_zone_mask]
    threshold = np.percentile(margin_curvature_vals, 85)

    margin_vertex_mask = margin_zone_mask & (abs_curvature > threshold)
    margin_vertices = mesh.vertices[margin_vertex_mask]

    if len(margin_vertices) < 10:
        return {"margin_detected": False, "margin_vertex_count": len(margin_vertices)}

    centroid_xy = np.mean(margin_vertices[:, :2], axis=0)
    radial_distances = np.sqrt(
        (margin_vertices[:, 0] - centroid_xy[0])**2 +
        (margin_vertices[:, 1] - centroid_xy[1])**2
    )

    margin_regularity_score = 1.0 / (1.0 + float(np.std(radial_distances)))
    margin_z_variation = float(np.std(margin_vertices[:, 2]))

    return {
        "margin_detected": True,
        "margin_regularity_score": round(margin_regularity_score, 3),
        "margin_z_variation_mm": round(margin_z_variation, 3),
        "margin_vertex_count": int(np.sum(margin_vertex_mask))
    }


def measure_occlusal_clearance(prep_mesh, opposing_mesh):
    try:
        prep_bounds = prep_mesh.bounds
        prep_zmax = prep_bounds[1][2]
        prep_height = prep_bounds[1][2] - prep_bounds[0][2]

        occlusal_mask = prep_mesh.vertices[:, 2] > (prep_zmax - prep_height * 0.15)
        occlusal_vertices = prep_mesh.vertices[occlusal_mask]

        if len(occlusal_vertices) == 0:
            return {"clearance_measurable": False}

        closest_points, distances, _ = trimesh.proximity.closest_point(
            opposing_mesh, occlusal_vertices
        )

        min_clearance = float(np.min(distances))
        mean_clearance = float(np.mean(distances))

        opposing_top_mask = opposing_mesh.vertices[:, 2] > np.percentile(
            opposing_mesh.vertices[:, 2], 70
        )
        opposing_cusps = opposing_mesh.vertices[opposing_top_mask]

        prep_center_xy = np.mean(occlusal_vertices[:, :2], axis=0)
        cusp_xy_distances = np.sqrt(
            (opposing_cusps[:, 0] - prep_center_xy[0])**2 +
            (opposing_cusps[:, 1] - prep_center_xy[1])**2
        )
        functional_cusp = opposing_cusps[np.argmin(cusp_xy_distances)]

        cusp_to_occlusal = np.sqrt(
            np.sum((occlusal_vertices - functional_cusp)**2, axis=1)
        )
        functional_cusp_clearance = float(np.min(cusp_to_occlusal))

        return {
            "clearance_measurable": True,
            "min_clearance_mm": round(min_clearance, 2),
            "mean_clearance_mm": round(mean_clearance, 2),
            "functional_cusp_clearance_mm": round(functional_cusp_clearance, 2)
        }
    except Exception as e:
        return {"clearance_measurable": False, "error": str(e)}


def score_all(measurements, tooth_number, case_type, zirconia_grade, patient_risk):
    scores = {}

    # Scan quality
    sq = measurements["scan_quality"]
    if not sq["usable"]:
        scores["scan_quality"] = {"status": "RED", "note": "Scan quality too low for reliable analysis. Please rescan."}
    elif sq["quality_score"] >= 80:
        scores["scan_quality"] = {"status": "GREEN", "note": f"Mesh integrity verified. {sq['vertex_count']:,} vertices. Watertight: {sq['is_watertight']}."}
    elif sq["quality_score"] >= 60:
        scores["scan_quality"] = {"status": "YELLOW", "note": f"Acceptable quality with minor issues: {'; '.join(sq['issues'][:2])}"}
    else:
        scores["scan_quality"] = {"status": "RED", "note": f"Poor scan quality: {'; '.join(sq['issues'][:2])}"}

    # Undercut
    uc = measurements["undercut"]
    if not uc["undercut_detected"]:
        scores["undercut"] = {"status": "GREEN", "note": "No undercuts detected. Crown should seat cleanly."}
    else:
        scores["undercut"] = {"status": "RED", "note": f"{uc['severity'].capitalize()} undercut detected. Multi-hit ratio: {uc['multi_hit_ratio']*100:.1f}%. Crown cannot seat."}

    # Taper
    tp = measurements["taper"]
    if tp.get("mean_taper_deg") is None:
        scores["taper"] = {"status": "YELLOW", "note": "Insufficient axial geometry detected for taper measurement."}
    else:
        dist = tp["distribution"]
        mean_t = tp["mean_taper_deg"]
        if 4 <= mean_t <= 8 and dist["ideal_4_to_8"] > 60:
            scores["taper"] = {"status": "GREEN", "note": f"{mean_t}° mean taper. {dist['ideal_4_to_8']:.0f}% of axial faces in ideal 4–8° zone."}
        elif 2 <= mean_t <= 12:
            scores["taper"] = {"status": "YELLOW", "note": f"{mean_t}° mean taper (ideal: 4–8°). {dist['under_4']:.0f}% of faces under 4°, {dist['over_8']:.0f}% over 8°."}
        else:
            scores["taper"] = {"status": "RED", "note": f"{mean_t}° mean taper is outside acceptable range (2–12°). {dist['under_4']:.0f}% of faces under 4°."}

    # Margin
    mg = measurements["margin"]
    if not mg.get("margin_detected"):
        scores["margin"] = {"status": "YELLOW", "note": "Margin line not clearly detected. Scan may have artifacts in gingival zone."}
    elif mg["margin_regularity_score"] > 0.70:
        scores["margin"] = {"status": "GREEN", "note": f"Regularity score {mg['margin_regularity_score']:.2f}. Margin line detected cleanly."}
    elif mg["margin_regularity_score"] > 0.50:
        scores["margin"] = {"status": "YELLOW", "note": f"Regularity score {mg['margin_regularity_score']:.2f} (target >0.70). Slight margin irregularity noted."}
    else:
        scores["margin"] = {"status": "RED", "note": f"Poor margin regularity ({mg['margin_regularity_score']:.2f}). Significant scan artifact or torn margin."}

    # Occlusal clearance
    oc = measurements["occlusal_clearance"]
    min_clear = {"3Y": 1.5, "4Y": 1.2, "5Y": 0.7}.get(zirconia_grade, 1.5)
    if "bruxism" in patient_risk:
        min_clear += 0.3
    bruxism_note = " (+0.3mm bruxism buffer applied)" if "bruxism" in patient_risk else ""

    if not oc.get("clearance_measurable"):
        scores["occlusal_clearance"] = {"status": "PENDING", "note": "Upload opposing arch STL to measure occlusal clearance."}
    else:
        fc = oc["functional_cusp_clearance_mm"]
        if fc >= min_clear:
            scores["occlusal_clearance"] = {"status": "GREEN", "note": f"Functional cusp clearance {fc:.1f}mm >= {min_clear:.1f}mm minimum{bruxism_note}."}
        elif fc >= min_clear * 0.85:
            scores["occlusal_clearance"] = {"status": "YELLOW", "note": f"Functional cusp clearance {fc:.1f}mm is borderline (minimum {min_clear:.1f}mm{bruxism_note}). Additional reduction recommended."}
        else:
            scores["occlusal_clearance"] = {"status": "RED", "note": f"Functional cusp clearance {fc:.1f}mm is below {min_clear:.1f}mm minimum{bruxism_note}. Inadequate space for {zirconia_grade} zirconia."}

    # Overall
    all_statuses = [s["status"] for s in scores.values()]
    if "RED" in all_statuses:
        overall = "RED"
    elif "YELLOW" in all_statuses:
        overall = "YELLOW"
    else:
        overall = "GREEN"

    # Action text
    actions = []
    action_map = {
        "undercut": "Undercut detected on axial wall. The crown cannot be physically seated. Re-preparation of the affected axial wall is required before rescanning. Focus on eliminating inward geometry in the gingival third. We will prioritise your rescan with same-day turnaround.",
        "taper": f"Taper angle of {measurements['taper'].get('mean_taper_deg', 'N/A')}° requires adjustment. Target 4–8° convergence angle on axial walls. Parallel walls bind the crown during seating. Slightly divergent walls (>8°) reduce retention.",
        "margin": "Margin irregularity detected in the gingival zone. Check for scan artifacts, torn tissue, or preparation chips. A clean, continuous finish line is required for accurate crown adaptation.",
        "occlusal_clearance": f"Occlusal clearance below the {min_clear:.1f}mm minimum for {zirconia_grade} zirconia{bruxism_note}. Options: (a) additional occlusal reduction and rescan, or (b) switch to a zirconia grade requiring less clearance — contact BiteNxt to confirm.",
        "scan_quality": "Scan quality is insufficient for reliable analysis. Please rescan with higher resolution settings or check the scanner tip for contamination."
    }

    for param, score_obj in scores.items():
        if score_obj["status"] in ("RED", "YELLOW"):
            param_label = param.replace("_", " ").title()
            actions.append({
                "severity": score_obj["status"],
                "parameter": param_label,
                "text": action_map.get(param, score_obj["note"])
            })

    if overall == "RED":
        n_red = sum(1 for s in scores.values() if s["status"] == "RED")
        summary = f"{n_red} critical {'issue' if n_red == 1 else 'issues'} detected. Rescan required before milling."
    elif overall == "YELLOW":
        summary = "Borderline parameters detected. Review recommended actions before proceeding."
    else:
        summary = "All parameters within acceptable range. Cleared for milling."

    return scores, overall, {"summary": summary, "actions": actions}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Parse multipart form data
            environ = {
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': content_type,
                'CONTENT_LENGTH': str(content_length),
            }

            fp = io.BytesIO(body)
            form = cgi.FieldStorage(fp=fp, environ=environ, keep_blank_values=True)

            # Extract fields
            tooth_number = form.getvalue('tooth_number', '36')
            case_type = form.getvalue('case_type', 'natural_crown')
            zirconia_grade = form.getvalue('zirconia_grade', '3Y')
            patient_risk_raw = form.getvalue('patient_risk', '[]')
            dentist_name = form.getvalue('dentist_name', 'Unknown')
            clinic_name = form.getvalue('clinic_name', 'Unknown')

            try:
                patient_risk = json.loads(patient_risk_raw)
            except Exception:
                patient_risk = []

            # Load prep STL
            prep_field = form['prep_stl']
            prep_bytes = prep_field.file.read() if hasattr(prep_field, 'file') else prep_field.value

            with tempfile.NamedTemporaryFile(suffix='.stl', delete=False) as f:
                f.write(prep_bytes)
                prep_path = f.name

            prep_mesh = trimesh.load(prep_path, force='mesh')
            os.unlink(prep_path)

            # Load opposing STL if provided
            opposing_mesh = None
            if 'opposing_stl' in form:
                opp_field = form['opposing_stl']
                opp_bytes = opp_field.file.read() if hasattr(opp_field, 'file') else opp_field.value
                if opp_bytes:
                    with tempfile.NamedTemporaryFile(suffix='.stl', delete=False) as f:
                        f.write(opp_bytes)
                        opp_path = f.name
                    opposing_mesh = trimesh.load(opp_path, force='mesh')
                    os.unlink(opp_path)

            # Run algorithms
            sq = validate_scan_quality(prep_mesh)
            uc = detect_undercuts(prep_mesh)
            tp = measure_taper_angle(prep_mesh)
            mg = detect_margin_line(prep_mesh)
            oc = measure_occlusal_clearance(prep_mesh, opposing_mesh) if opposing_mesh else {"clearance_measurable": False}

            measurements = {
                "scan_quality": sq,
                "undercut": uc,
                "taper": tp,
                "margin": mg,
                "occlusal_clearance": oc
            }

            scores, overall, action_text = score_all(
                measurements, tooth_number, case_type, zirconia_grade, patient_risk
            )

            bounds = prep_mesh.bounds
            dims = bounds[1] - bounds[0]

            case_id = f"BN-2026-{str(uuid.uuid4())[:4].upper()}"

            response = {
                "case_id": case_id,
                "tooth_number": tooth_number,
                "case_type": case_type,
                "zirconia_grade": zirconia_grade,
                "patient_risk": patient_risk,
                "dentist_name": dentist_name,
                "clinic_name": clinic_name,
                "timestamp": datetime.now().isoformat(),
                "scan_info": {
                    "vertex_count": len(prep_mesh.vertices),
                    "face_count": len(prep_mesh.faces),
                    "dimensions_mm": {
                        "x": round(float(dims[0]), 2),
                        "y": round(float(dims[1]), 2),
                        "z": round(float(dims[2]), 2)
                    }
                },
                "measurements": measurements,
                "scores": scores,
                "overall": overall,
                "action_text": action_text
            }

            response_bytes = json.dumps(response).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(response_bytes)))
            self.end_headers()
            self.wfile.write(response_bytes)

        except Exception as e:
            error_response = json.dumps({"error": str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
