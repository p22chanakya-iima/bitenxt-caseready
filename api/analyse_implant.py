from http.server import BaseHTTPRequestHandler
import json, uuid, io, tempfile, os, cgi
from datetime import datetime

import trimesh
import numpy as np


def validate_scan_quality(mesh):
    issues = []
    if not mesh.is_watertight: issues.append("Mesh has open boundaries")
    if not mesh.is_winding_consistent: issues.append("Inconsistent face normals")
    vc = len(mesh.vertices)
    if vc < 3000: issues.append(f"Low vertex count ({vc})")
    fa = mesh.area_faces
    dr = float(np.sum(fa < 1e-6)) / max(len(fa), 1)
    if dr > 0.02: issues.append(f"High degenerate face ratio ({dr:.1%})")
    bounds = mesh.bounds; dims = bounds[1] - bounds[0]
    for i, ax in enumerate(['X','Y','Z']):
        if dims[i] < 5.0: issues.append(f"{ax} too small ({dims[i]:.1f}mm) — crop to implant region")
    score = max(0, 100 - len(issues) * 20)
    return {"quality_score": score, "issues": issues, "usable": len(issues) < 3,
            "vertex_count": vc, "face_count": len(mesh.faces),
            "dimensions": {"x": round(float(dims[0]),2), "y": round(float(dims[1]),2), "z": round(float(dims[2]),2)}}


def detect_scan_body(mesh):
    """
    Detect the scan body in an arch scan STL.
    A scan body is a geometric cylinder protruding significantly above the gum ridge.

    Algorithm:
    1. Estimate ridge height from the mesh geometry (middle percentile of Z)
    2. Find vertices significantly above the ridge — these are either teeth or scan body
    3. Find the tallest/most cylindrical protrusion — that is the scan body
    4. Fit PCA axis to scan body vertices → implant angulation
    5. Measure mesiodistal space from adjacent protrusions
    """
    vertices = mesh.vertices

    # Step 1: Estimate ridge height
    z_vals = vertices[:, 2]
    z_20 = np.percentile(z_vals, 20)
    z_60 = np.percentile(z_vals, 60)
    ridge_verts = vertices[(z_vals >= z_20) & (z_vals <= z_60)]
    ridge_z = float(np.median(ridge_verts[:, 2]))

    # Protrusion threshold: 3mm above ridge
    protrusion_z = ridge_z + 3.0
    protrusion_mask = z_vals > protrusion_z
    protrusion_verts = vertices[protrusion_mask]

    if len(protrusion_verts) < 20:
        return {"scan_body_detected": False, "error": "No significant protrusion found above ridge",
                "ridge_z": round(ridge_z, 2), "protrusion_vertex_count": len(protrusion_verts)}

    # Step 2: Find the tallest local cluster (scan body is the tallest protrusion)
    # Use the top 15% of vertices as the scan body tip region
    z_85 = np.percentile(z_vals, 85)
    tip_verts = vertices[z_vals > z_85]

    if len(tip_verts) < 10:
        return {"scan_body_detected": False, "error": "Insufficient tip geometry",
                "ridge_z": round(ridge_z, 2), "protrusion_vertex_count": int(np.sum(protrusion_mask))}

    # Centroid of the tip = approximate scan body XY center
    sb_centroid = np.mean(tip_verts[:, :2], axis=0)

    # Step 3: Collect all scan body vertices (within 7mm of centroid, above ridge+1mm)
    xy_dist = np.sqrt((vertices[:,0] - sb_centroid[0])**2 + (vertices[:,1] - sb_centroid[1])**2)
    sb_mask = (xy_dist < 7.0) & (z_vals > (ridge_z + 1.0))
    sb_verts = vertices[sb_mask]

    if len(sb_verts) < 20:
        return {"scan_body_detected": False, "error": "Scan body region too sparse",
                "ridge_z": round(ridge_z, 2), "protrusion_vertex_count": int(np.sum(protrusion_mask))}

    # Step 4: Fit principal axis using SVD (PCA on scan body vertices)
    sb_center = np.mean(sb_verts, axis=0)
    sb_centered = sb_verts - sb_center
    try:
        _, _, vt = np.linalg.svd(sb_centered, full_matrices=False)
        principal_axis = vt[0]
    except Exception:
        return {"scan_body_detected": False, "error": "SVD failed on scan body vertices"}

    # Ensure axis points upward
    if principal_axis[2] < 0:
        principal_axis = -principal_axis

    # Step 5: Angulation from vertical
    angulation = float(np.degrees(np.arccos(np.clip(principal_axis[2], -1, 1))))

    # Step 6: Scan body height above ridge
    sb_height = float(np.max(sb_verts[:, 2])) - (ridge_z + 3.0)

    # Step 7: Mesiodistal space — find adjacent teeth protrusions
    # Adjacent teeth are clusters of protrusion vertices NOT in the scan body region
    adj_mask = protrusion_mask & (xy_dist > 7.0)
    adj_verts = vertices[adj_mask]

    mesial_mm = None
    distal_mm = None

    if len(adj_verts) > 10:
        # Use XY distance from scan body centroid as proxy for mesiodistal space
        adj_xy_dist = np.sqrt((adj_verts[:,0] - sb_centroid[0])**2 + (adj_verts[:,1] - sb_centroid[1])**2)
        if len(adj_xy_dist) > 0:
            # Split into mesial/distal by X coordinate
            mesial_adj = adj_verts[adj_verts[:, 0] < sb_centroid[0]]
            distal_adj = adj_verts[adj_verts[:, 0] > sb_centroid[0]]

            if len(mesial_adj) > 5:
                m_dist = np.sqrt((mesial_adj[:,0]-sb_centroid[0])**2 + (mesial_adj[:,1]-sb_centroid[1])**2)
                mesial_mm = round(max(0.0, float(np.min(m_dist)) - 2.75), 1)

            if len(distal_adj) > 5:
                d_dist = np.sqrt((distal_adj[:,0]-sb_centroid[0])**2 + (distal_adj[:,1]-sb_centroid[1])**2)
                distal_mm = round(max(0.0, float(np.min(d_dist)) - 2.75), 1)

    return {
        "scan_body_detected": True,
        "angulation_deg": round(angulation, 1),
        "scan_body_axis": [round(float(x), 4) for x in principal_axis],
        "scan_body_centroid_xy": [round(float(x), 2) for x in sb_centroid],
        "height_above_ridge_mm": round(max(0.0, sb_height), 1),
        "ridge_z": round(ridge_z, 2),
        "mesial_space_mm": mesial_mm,
        "distal_space_mm": distal_mm,
        "protrusion_vertex_count": int(np.sum(sb_mask))
    }


def measure_vertical_space(prep_mesh, opposing_mesh, sb_result):
    """Measure distance from implant platform to opposing arch."""
    if not sb_result.get("scan_body_detected"):
        return {"measurable": False, "error": "Scan body not detected"}
    try:
        # Platform is at the base of scan body (ridge_z level)
        ridge_z = sb_result["ridge_z"]
        centroid_xy = sb_result["scan_body_centroid_xy"]

        # Platform slightly above ridge = implant platform
        platform_z = ridge_z + 0.5

        # Get topmost point of opposing arch near the implant XY position
        opp_verts = opposing_mesh.vertices
        xy_dist = np.sqrt((opp_verts[:,0] - centroid_xy[0])**2 + (opp_verts[:,1] - centroid_xy[1])**2)
        nearby_mask = xy_dist < 10.0

        if np.sum(nearby_mask) < 5:
            return {"measurable": False, "error": "No opposing arch geometry near implant site"}

        nearby_opp = opp_verts[nearby_mask]
        # The bottom of the opposing arch near this tooth = closest to the implant
        opp_min_z = float(np.min(nearby_opp[:, 2]))

        vertical_space = opp_min_z - platform_z

        return {
            "measurable": True,
            "platform_to_opposing_mm": round(max(0.0, vertical_space), 1)
        }
    except Exception as e:
        return {"measurable": False, "error": str(e)}


def score_all(sb, vert_space, patient_risk):
    scores = {}

    # Scan body detection
    if not sb.get("scan_body_detected"):
        scores["scan_body_detection"] = {"status": "RED", "note": f"Scan body not found: {sb.get('error', 'unknown error')}. Ensure scan body is seated and visible in the scan."}
        # Can't score anything else without scan body
        for key in ["implant_angulation", "emergence_angle", "mesiodistal_space"]:
            scores[key] = {"status": "PENDING", "note": "Requires scan body detection."}
        scores["vertical_space"] = {"status": "PENDING", "note": "Requires scan body detection and opposing arch."}
        return scores, "RED", {"summary": "Scan body not detected. Ensure scan body is properly seated and visible in scan.", "actions": [{"severity": "RED", "parameter": "Scan Body Detection", "text": sb.get("error", "Scan body not found in arch scan.")}]}

    scores["scan_body_detection"] = {"status": "GREEN", "note": f"Scan body detected. {sb['protrusion_vertex_count']} protrusion vertices. Height {sb['height_above_ridge_mm']}mm above ridge."}

    # Implant angulation
    ang = sb.get("angulation_deg")
    if ang is None:
        scores["implant_angulation"] = {"status": "PENDING", "note": "Angulation not measured."}
    elif ang <= 15:
        scores["implant_angulation"] = {"status": "GREEN", "note": f"Implant angulation {ang}° — within ideal ≤15° range."}
    elif ang <= 30:
        scores["implant_angulation"] = {"status": "YELLOW", "note": f"Implant angulation {ang}° — within acceptable range but requires angled abutment consideration."}
    else:
        scores["implant_angulation"] = {"status": "RED", "note": f"Implant angulation {ang}° exceeds 30° maximum. Peri-implant bone loss risk."}

    # Emergence angle (approximated as angulation for prototype)
    emerg = ang
    if emerg is None:
        scores["emergence_angle"] = {"status": "PENDING", "note": "Emergence angle not measured."}
    elif emerg <= 25:
        scores["emergence_angle"] = {"status": "GREEN", "note": f"Emergence angle {emerg}° — within safe profile."}
    elif emerg <= 30:
        scores["emergence_angle"] = {"status": "YELLOW", "note": f"Emergence angle {emerg}° — borderline. Crown emergence profile requires careful design."}
    else:
        scores["emergence_angle"] = {"status": "RED", "note": f"Emergence angle {emerg}° exceeds 30° threshold linked to marginal bone loss (Chu & Tarnow, 2012)."}

    # Mesiodistal space
    mesial = sb.get("mesial_space_mm")
    distal = sb.get("distal_space_mm")
    if mesial is None and distal is None:
        scores["mesiodistal_space"] = {"status": "PENDING", "note": "Adjacent teeth not detected in scan. Crop arch to include at least one adjacent tooth on each side."}
    else:
        min_space = min(x for x in [mesial, distal] if x is not None)
        if min_space >= 1.5:
            scores["mesiodistal_space"] = {"status": "GREEN", "note": f"Mesial {mesial}mm · Distal {distal}mm — sufficient space for crown contours."}
        elif min_space >= 1.0:
            scores["mesiodistal_space"] = {"status": "YELLOW", "note": f"Mesial {mesial}mm · Distal {distal}mm — tight. Crown contours will be constrained."}
        else:
            scores["mesiodistal_space"] = {"status": "RED", "note": f"Mesial {mesial}mm · Distal {distal}mm — insufficient space. Crown cannot be designed within acceptable contours."}

    # Vertical space
    if not vert_space.get("measurable"):
        scores["vertical_space"] = {"status": "PENDING", "note": "Upload opposing arch STL to measure vertical crown space."}
    else:
        vs = vert_space["platform_to_opposing_mm"]
        if vs >= 7:
            scores["vertical_space"] = {"status": "GREEN", "note": f"Vertical crown space {vs}mm — sufficient for abutment + crown."}
        elif vs >= 5:
            scores["vertical_space"] = {"status": "YELLOW", "note": f"Vertical crown space {vs}mm (minimum 7mm). May require reduced-profile abutment."}
        else:
            scores["vertical_space"] = {"status": "RED", "note": f"Vertical crown space {vs}mm is critically low (minimum 7mm). Crown cannot be designed without occlusal reduction."}

    # Overall
    all_s = [s["status"] for s in scores.values()]
    overall = "RED" if "RED" in all_s else ("YELLOW" if "YELLOW" in all_s else "GREEN")

    # Actions
    action_map = {
        "scan_body_detection": "Scan body not detected. Ensure scan body is properly seated, clean, and fully visible in the scan. Retake the scan if necessary.",
        "implant_angulation": f"Implant angulation {ang}° requires clinical review. For angulations above 25°, consult with the placing surgeon. An angulated abutment may partially compensate up to 25°. Above 30°, surgical correction should be considered.",
        "emergence_angle": f"Emergence angle {emerg}° is associated with increased marginal bone loss. The crown emergence profile should be designed to minimise outward flare at the tissue level. Consider discussion with the placing surgeon.",
        "mesiodistal_space": "Insufficient mesiodistal space. The adjacent teeth do not provide adequate room for crown contours. Orthodontic space creation or crown size compromise required.",
        "vertical_space": f"Vertical space {vert_space.get('platform_to_opposing_mm', 'N/A')}mm is insufficient. Discuss occlusal adjustment or reduced-profile prosthetic options with the dentist.",
    }

    actions = []
    for param, score_obj in scores.items():
        if score_obj["status"] in ("RED", "YELLOW"):
            actions.append({
                "severity": score_obj["status"],
                "parameter": param.replace("_", " ").title(),
                "text": action_map.get(param, score_obj["note"])
            })

    n_red = sum(1 for s in scores.values() if s["status"] == "RED")
    if overall == "RED":
        summary = f"{n_red} critical {'issue' if n_red==1 else 'issues'} detected. Clinical review required before crown design."
    elif overall == "YELLOW":
        summary = "Borderline parameters detected. Review before proceeding with crown design."
    else:
        summary = "Implant position within acceptable parameters. Proceed with crown design."

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

            environ = {'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type, 'CONTENT_LENGTH': str(content_length)}
            form = cgi.FieldStorage(fp=io.BytesIO(body), environ=environ, keep_blank_values=True)

            tooth_number = form.getvalue('tooth_number', '36')
            implant_system = form.getvalue('implant_system', 'Unknown')
            patient_risk = json.loads(form.getvalue('patient_risk', '[]'))
            dentist_name = form.getvalue('dentist_name', 'Unknown')
            clinic_name = form.getvalue('clinic_name', 'Unknown')

            arch_field = form['arch_stl']
            arch_bytes = arch_field.file.read() if hasattr(arch_field, 'file') else arch_field.value
            with tempfile.NamedTemporaryFile(suffix='.stl', delete=False) as f:
                f.write(arch_bytes); arch_path = f.name
            arch_mesh = trimesh.load(arch_path, force='mesh')
            os.unlink(arch_path)

            opposing_mesh = None
            if 'opposing_stl' in form:
                opp_field = form['opposing_stl']
                opp_bytes = opp_field.file.read() if hasattr(opp_field, 'file') else opp_field.value
                if opp_bytes:
                    with tempfile.NamedTemporaryFile(suffix='.stl', delete=False) as f:
                        f.write(opp_bytes); opp_path = f.name
                    opposing_mesh = trimesh.load(opp_path, force='mesh')
                    os.unlink(opp_path)

            sq = validate_scan_quality(arch_mesh)
            sb = detect_scan_body(arch_mesh)
            vs = measure_vertical_space(arch_mesh, opposing_mesh, sb) if opposing_mesh else {"measurable": False}

            sq_score = {"status": "GREEN" if sq["quality_score"]>=80 else "YELLOW" if sq["quality_score"]>=60 else "RED",
                       "note": f"Scan quality {sq['quality_score']}/100. {sq['vertex_count']:,} vertices." + (f" Issues: {'; '.join(sq['issues'][:2])}" if sq["issues"] else "")}

            scores, overall, action_text = score_all(sb, vs, patient_risk)
            scores["scan_quality"] = sq_score

            if "RED" in [s["status"] for s in scores.values()]:
                overall = "RED"
            elif "YELLOW" in [s["status"] for s in scores.values()]:
                overall = "YELLOW"

            bounds = arch_mesh.bounds; dims = bounds[1] - bounds[0]
            case_id = f"BN-2026-IMP-{str(uuid.uuid4())[:4].upper()}"

            response = {
                "caseId": case_id,
                "toothNumber": tooth_number,
                "implantSystem": implant_system,
                "patientRisk": patient_risk,
                "dentistName": dentist_name,
                "clinicName": clinic_name,
                "timestamp": datetime.now().isoformat(),
                "scanInfo": {
                    "vertexCount": len(arch_mesh.vertices),
                    "faceCount": len(arch_mesh.faces),
                    "dimensionsMm": {"x": round(float(dims[0]),2), "y": round(float(dims[1]),2), "z": round(float(dims[2]),2)}
                },
                "measurements": {
                    "scanQuality": sq,
                    "scanBody": sb,
                    "angulation": {"angulationDeg": sb.get("angulation_deg"), "emergenceAngleDeg": sb.get("angulation_deg")},
                    "mesiodistalSpace": {"mesialMm": sb.get("mesial_space_mm"), "distalMm": sb.get("distal_space_mm")},
                    "verticalSpace": vs
                },
                "scores": scores,
                "overall": overall,
                "actionText": action_text
            }

            resp_bytes = json.dumps(response).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)

        except Exception as e:
            err = json.dumps({"error": str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(err)))
            self.end_headers()
            self.wfile.write(err)
