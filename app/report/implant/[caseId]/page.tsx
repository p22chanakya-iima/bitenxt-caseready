'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type StatusColor = 'GREEN' | 'YELLOW' | 'RED' | 'PENDING'

interface ImplantReport {
  caseId: string
  toothNumber: string
  implantSystem: string
  patientRisk: string[]
  dentistName: string
  clinicName: string
  timestamp: string
  scanInfo: { vertexCount: number; faceCount: number; dimensionsMm: { x: number; y: number; z: number } }
  measurements: {
    scanQuality: { qualityScore: number; issues: string[]; usable: boolean; vertexCount: number }
    scanBody: { detected: boolean; angulationDeg: number | null; heightAboveRidgeMm: number | null; protrustionVertexCount: number; error?: string }
    angulation: { angulationDeg: number | null; emergenceAngleDeg: number | null }
    mesiodistalSpace: { mesialMm: number | null; distalMm: number | null }
    verticalSpace: { measurable: boolean; platformToOpposingMm?: number }
  }
  scores: {
    scanQuality: { status: StatusColor; note: string }
    scanBodyDetection: { status: StatusColor; note: string }
    implantAngulation: { status: StatusColor; note: string }
    emergenceAngle: { status: StatusColor; note: string }
    mesiodistalSpace: { status: StatusColor; note: string }
    verticalSpace: { status: StatusColor; note: string }
  }
  overall: StatusColor
  actionText: { summary: string; actions: { severity: 'RED' | 'YELLOW'; parameter: string; text: string }[] }
}

const DEMO_IMPLANT_REPORT: ImplantReport = {
  caseId: 'BN-2026-IMP-DEMO',
  toothNumber: '36',
  implantSystem: 'Nobel Biocare',
  patientRisk: [],
  dentistName: 'Dr. Ramesh Kumar',
  clinicName: 'Radiance Dental, Hyderabad',
  timestamp: '2026-03-14T10:00:00.000Z',
  scanInfo: { vertexCount: 24610, faceCount: 49216, dimensionsMm: { x: 22.4, y: 18.6, z: 15.2 } },
  measurements: {
    scanQuality: { qualityScore: 88, issues: [], usable: true, vertexCount: 24610 },
    scanBody: { detected: true, angulationDeg: 35.2, heightAboveRidgeMm: 9.8, protrustionVertexCount: 842 },
    angulation: { angulationDeg: 35.2, emergenceAngleDeg: 35.2 },
    mesiodistalSpace: { mesialMm: 2.1, distalMm: 1.8 },
    verticalSpace: { measurable: false },
  },
  scores: {
    scanQuality: { status: 'GREEN', note: 'Arch scan integrity verified. 24,610 vertices.' },
    scanBodyDetection: { status: 'GREEN', note: 'Scan body detected. 842 protrusion vertices. Height 9.8mm above ridge.' },
    implantAngulation: { status: 'RED', note: 'Implant angulation 35.2° exceeds 30° maximum. Peri-implant bone loss risk.' },
    emergenceAngle: { status: 'RED', note: 'Emergence angle 35.2° exceeds 30° maximum recommended for tissue health.' },
    mesiodistalSpace: { status: 'GREEN', note: 'Mesial 2.1mm · Distal 1.8mm — both above 1.5mm minimum.' },
    verticalSpace: { status: 'PENDING', note: 'Upload opposing arch STL to measure vertical crown space.' },
  },
  overall: 'RED',
  actionText: {
    summary: 'Critical implant angulation issue detected. Clinical review required before crown design.',
    actions: [
      { severity: 'RED', parameter: 'Implant Angulation', text: 'The implant is angulated at 35.2° from vertical, exceeding the 30° maximum. At this angulation, the emergence profile cannot be designed within safe limits without risking peri-implant bone loss and soft tissue recession. Options: (a) surgical correction of implant position before proceeding, or (b) consultation with the placing surgeon regarding a custom angulated abutment — note that this only partially compensates above 25°.' },
      { severity: 'RED', parameter: 'Emergence Angle', text: 'The emergence angle of 35.2° exceeds the 30° threshold linked to increased marginal bone loss in peer-reviewed literature (Chu & Tarnow, 2012; Su et al., 2010). Even with an angulated abutment, the crown emergence from tissue will be overly concave or convex, creating a hygiene trap or excessive pressure on crestal bone.' },
    ],
  },
}

function StatusBadge({ status }: { status: StatusColor }) {
  const styles: Record<StatusColor, string> = {
    GREEN: 'bg-green-950 text-status-green border border-status-green/30',
    YELLOW: 'bg-yellow-950 text-status-yellow border border-status-yellow/30',
    RED: 'bg-red-950 text-status-red border border-status-red/30',
    PENDING: 'bg-navy text-cream-muted border border-border-col',
  }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>{status}</span>
}

function fmt(ts: string) {
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }) } catch { return ts }
}

export default function ImplantReportPage() {
  const params = useParams()
  const caseId = params.caseId as string
  const [report, setReport] = useState<ImplantReport | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (caseId === 'demo-implant') { setReport(DEMO_IMPLANT_REPORT); return }
    const stored = localStorage.getItem(`implant_report_${caseId}`)
    if (stored) { try { setReport(JSON.parse(stored)) } catch { setNotFound(true) } }
    else setNotFound(true)
  }, [caseId])

  if (notFound) return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="text-center">
        <p className="text-status-red text-lg font-semibold mb-2">Report Not Found</p>
        <Link href="/analyse/implant" className="text-accent hover:underline text-sm">← Start a New Implant Analysis</Link>
      </div>
    </div>
  )

  if (!report) return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="text-cream-muted text-sm">Loading report...</div>
    </div>
  )

  const verdictConfig = {
    RED: { icon: '🔴', label: 'CLINICAL REVIEW REQUIRED', bg: 'bg-red-950/40', border: 'border-status-red', text: 'text-status-red' },
    YELLOW: { icon: '🟡', label: 'PROCEED WITH CAUTION', bg: 'bg-yellow-950/40', border: 'border-status-yellow', text: 'text-status-yellow' },
    GREEN: { icon: '🟢', label: 'CLEARED FOR CROWN DESIGN', bg: 'bg-green-950/40', border: 'border-status-green', text: 'text-status-green' },
    PENDING: { icon: '⚪', label: 'PENDING', bg: 'bg-navy-elevated', border: 'border-border-col', text: 'text-cream-muted' },
  }
  const verdict = verdictConfig[report.overall]
  const m = report.measurements
  const s = report.scores

  const tableRows = [
    { label: 'Scan Quality', measured: `${m.scanQuality.qualityScore}/100`, ideal: '≥ 80', score: s.scanQuality },
    { label: 'Scan Body Detection', measured: m.scanBody.detected ? `Detected · ${m.scanBody.heightAboveRidgeMm}mm height` : 'Not detected', ideal: 'Detected', score: s.scanBodyDetection },
    { label: 'Implant Angulation', measured: m.angulation.angulationDeg != null ? `${m.angulation.angulationDeg}°` : 'N/A', ideal: '≤ 15° ideal · ≤ 30° max', score: s.implantAngulation },
    { label: 'Emergence Angle', measured: m.angulation.emergenceAngleDeg != null ? `${m.angulation.emergenceAngleDeg}°` : 'N/A', ideal: '≤ 25° ideal · ≤ 30° max', score: s.emergenceAngle },
    { label: 'Mesiodistal Space', measured: m.mesiodistalSpace.mesialMm != null ? `M: ${m.mesiodistalSpace.mesialMm}mm · D: ${m.mesiodistalSpace.distalMm}mm` : 'N/A', ideal: '≥ 1.5mm each', score: s.mesiodistalSpace },
    { label: 'Vertical Crown Space', measured: m.verticalSpace.measurable && m.verticalSpace.platformToOpposingMm ? `${m.verticalSpace.platformToOpposingMm}mm` : 'Awaiting opposing arch', ideal: '≥ 7mm', score: s.verticalSpace },
  ]

  return (
    <div className="min-h-screen bg-navy text-cream">
      <nav className="sticky top-0 z-10 bg-navy/95 backdrop-blur border-b border-border-col px-6 py-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-xl">BiteNxt</span>
          <span className="text-cream font-normal text-xl">CaseReady™</span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-accent/20 text-accent border border-accent/30 rounded-full">Implant</span>
        </div>
        <Link href="/analyse/implant" className="text-sm text-cream-muted hover:text-cream transition-colors">← New Analysis</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-cream mb-4">Implant Scan Verification Report</h1>
            <div className="flex flex-wrap gap-2">
              {[`Tooth ${report.toothNumber}`, 'Implant Crown', report.implantSystem, ...report.patientRisk.map(r=>r.charAt(0).toUpperCase()+r.slice(1)), report.dentistName, report.clinicName].filter(Boolean).map((pill,i) => (
                <span key={i} className="inline-block bg-navy-elevated border border-border-col text-cream-muted text-xs px-3 py-1 rounded-full">{pill}</span>
              ))}
            </div>
          </div>
          <div className="lg:text-right">
            <div className="font-mono text-accent text-lg font-semibold">{report.caseId}</div>
            <div className="text-cream-muted text-sm mt-1">{fmt(report.timestamp)}</div>
            <div className="text-cream-muted text-sm mt-1">BiteNxt Lab Services</div>
            <div className="text-xs text-cream-muted/60 mt-2">{report.scanInfo.vertexCount.toLocaleString()} vertices · {report.scanInfo.dimensionsMm.x}×{report.scanInfo.dimensionsMm.y}×{report.scanInfo.dimensionsMm.z} mm</div>
          </div>
        </div>

        {/* Verdict */}
        <div className={`${verdict.bg} border ${verdict.border} rounded-xl px-8 py-6 flex items-center gap-5`}>
          <span className="text-4xl">{verdict.icon}</span>
          <div>
            <div className={`text-2xl font-bold ${verdict.text}`}>{verdict.label}</div>
            <div className="text-cream-muted mt-1">{report.actionText.summary}</div>
          </div>
        </div>

        {/* Parameter table */}
        <div className="bg-navy-light border border-border-col rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-col">
            <h2 className="text-lg font-semibold text-cream">Implant Position Analysis</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-col text-cream-muted text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-3 font-semibold">Parameter</th>
                  <th className="text-left px-4 py-3 font-semibold">Measured</th>
                  <th className="text-left px-4 py-3 font-semibold">Ideal Range</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Clinical Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-col/50">
                {tableRows.map(row => (
                  <tr key={row.label} className="hover:bg-navy-elevated/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-cream">{row.label}</td>
                    <td className="px-4 py-4 text-cream-muted font-mono text-xs">{row.measured}</td>
                    <td className="px-4 py-4 text-cream-muted text-xs">{row.ideal}</td>
                    <td className="px-4 py-4"><StatusBadge status={row.score.status} /></td>
                    <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">{row.score.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        {report.actionText.actions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-cream mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-status-red rounded-full" />
              Required Actions
            </h2>
            <div className="space-y-4">
              {report.actionText.actions.map((action, i) => (
                <div key={i} className={`border rounded-xl p-5 ${action.severity === 'RED' ? 'border-status-red/40 bg-red-950/20 border-l-4 border-l-status-red' : 'border-status-yellow/40 bg-yellow-950/20 border-l-4 border-l-status-yellow'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${action.severity === 'RED' ? 'text-status-red' : 'text-status-yellow'}`}>{action.parameter}</div>
                  <p className="text-cream-muted text-sm leading-relaxed">{action.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="border-t border-border-col pt-6">
          <p className="text-xs text-cream-muted/60 italic leading-relaxed">
            Scan body detection uses PCA-based cylindrical protrusion analysis. Angulation is measured from the detected scan body axis relative to the vertical occlusal plane. Mesiodistal space is estimated from adjacent protrusion geometry. All values are geometric approximations — clinical calibration in progress. BiteNxt CaseReady™ Prototype v0.1
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 no-print pb-10">
          <Link href="/analyse/implant" className="px-6 py-3 border border-border-col text-cream-muted rounded-lg hover:text-cream hover:border-accent transition-colors text-sm font-medium">← New Analysis</Link>
          <button onClick={() => window.print()} className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium">Download PDF</button>
        </div>
      </div>
    </div>
  )
}
