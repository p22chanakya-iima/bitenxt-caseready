'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AnalysisReport, StatusColor } from '@/lib/types'

const DEMO_REPORT: AnalysisReport = {
  caseId: 'BN-2026-DEMO',
  toothNumber: '36',
  caseType: 'implant_crown',
  zirconiaGrade: '3Y',
  patientRisk: ['bruxism'],
  dentistName: 'Dr. Ramesh Kumar',
  clinicName: 'Radiance Dental, Hyderabad',
  timestamp: '2026-03-13T10:00:00.000Z',
  scanInfo: {
    vertexCount: 45231,
    faceCount: 90462,
    dimensionsMm: { x: 8.2, y: 9.1, z: 6.4 },
  },
  measurements: {
    scanQuality: {
      qualityScore: 87,
      isWatertight: true,
      isWindingConsistent: true,
      vertexCount: 45231,
      faceCount: 90462,
      degenerateFaceRatio: 0.003,
      issues: [],
      usable: true,
    },
    undercut: {
      undercutDetected: true,
      severity: 'moderate',
      undercutFaceRatio: 0.073,
      multiHitRatio: 0.124,
    },
    taper: {
      meanTaperDeg: 3.1,
      stdTaperDeg: 1.2,
      distribution: { under4: 58.3, ideal4to8: 38.1, over8: 3.6 },
      axialFaceCount: 12400,
    },
    margin: {
      marginDetected: true,
      marginRegularityScore: 0.71,
      marginZVariationMm: 0.18,
      marginVertexCount: 892,
    },
    occlusalClearance: {
      clearanceMeasurable: false,
    },
  },
  scores: {
    scanQuality: {
      status: 'GREEN',
      note: 'Mesh integrity verified. 45,231 vertices, watertight.',
    },
    undercut: {
      status: 'RED',
      note: 'Moderate undercut detected. Multi-hit ratio: 12.4%. Crown cannot seat.',
    },
    taper: {
      status: 'RED',
      note: '58.3% of axial faces below 4° minimum. Mean taper 3.1°.',
    },
    margin: {
      status: 'GREEN',
      note: 'Regularity score 0.71. Margin line detected cleanly.',
    },
    occlusalClearance: {
      status: 'PENDING',
      note: 'Upload opposing arch STL to measure occlusal clearance.',
    },
  },
  overall: 'RED',
  actionText: {
    summary: 'Two critical issues detected. Rescan required before milling.',
    actions: [
      {
        severity: 'RED',
        parameter: 'Undercut Detection',
        text: 'A moderate undercut was detected on the axial wall (multi-hit ratio 12.4%). The crown physically cannot be seated onto this preparation. Re-preparation is required — focus on the gingival third of the axial walls. We will prioritise your rescan with same-day turnaround.',
      },
      {
        severity: 'RED',
        parameter: 'Taper Angle',
        text: '58.3% of axial wall faces fall below the 4° minimum taper angle (mean: 3.1°). Parallel or near-parallel walls will bind the crown during seating. Additional axial reduction with appropriate taper is required. Target 4–8° convergence angle.',
      },
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
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

function CasePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-navy-elevated border border-border-col text-cream-muted text-xs px-3 py-1 rounded-full">
      {children}
    </span>
  )
}

function formatCaseType(ct: string) {
  return ct.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRisk(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch {
    return ts
  }
}

export default function ReportPage() {
  const params = useParams()
  const caseId = params.caseId as string
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (caseId === 'demo') {
      setReport(DEMO_REPORT)
      return
    }
    const stored = localStorage.getItem(`report_${caseId}`)
    if (stored) {
      try {
        setReport(JSON.parse(stored))
      } catch {
        setNotFound(true)
      }
    } else {
      setNotFound(true)
    }
  }, [caseId])

  if (notFound) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-center">
          <p className="text-status-red text-lg font-semibold mb-2">Report Not Found</p>
          <p className="text-cream-muted text-sm mb-6">
            Case ID: {caseId} was not found in storage.
          </p>
          <Link href="/analyse" className="text-accent hover:underline text-sm">
            ← Start a New Analysis
          </Link>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream-muted text-sm">Loading report...</div>
      </div>
    )
  }

  const verdictConfig = {
    RED: {
      icon: '🔴',
      label: 'RESCAN REQUIRED',
      bg: 'bg-red-950/40',
      border: 'border-status-red',
      text: 'text-status-red',
    },
    YELLOW: {
      icon: '🟡',
      label: 'PROCEED WITH MODIFICATION',
      bg: 'bg-yellow-950/40',
      border: 'border-status-yellow',
      text: 'text-status-yellow',
    },
    GREEN: {
      icon: '🟢',
      label: 'CLEARED FOR MILLING',
      bg: 'bg-green-950/40',
      border: 'border-status-green',
      text: 'text-status-green',
    },
    PENDING: {
      icon: '⚪',
      label: 'PENDING',
      bg: 'bg-navy-elevated',
      border: 'border-border-col',
      text: 'text-cream-muted',
    },
  }

  const verdict = verdictConfig[report.overall]
  const m = report.measurements
  const minClearanceMap: Record<string, number> = { '3Y': 1.5, '4Y': 1.2, '5Y': 0.7 }
  let minClear = minClearanceMap[report.zirconiaGrade] ?? 1.5
  if (report.patientRisk.includes('bruxism')) minClear += 0.3

  return (
    <div className="min-h-screen bg-navy text-cream">
      {/* Navbar */}
      <nav className="sticky top-0 z-10 bg-navy/95 backdrop-blur border-b border-border-col px-6 py-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-xl">BiteNxt</span>
          <span className="text-cream font-normal text-xl">CaseReady™</span>
        </div>
        <Link
          href="/analyse"
          className="text-sm text-cream-muted hover:text-cream transition-colors flex items-center gap-1"
        >
          ← New Analysis
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* REPORT HEADER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-cream mb-4">
              CaseReady™ Scan Verification Report
            </h1>
            <div className="flex flex-wrap gap-2">
              <CasePill>Tooth {report.toothNumber}</CasePill>
              <CasePill>{formatCaseType(report.caseType)}</CasePill>
              <CasePill>{report.zirconiaGrade} Zirconia</CasePill>
              {report.patientRisk.map((r) => (
                <CasePill key={r}>{formatRisk(r)}</CasePill>
              ))}
              {report.dentistName && <CasePill>{report.dentistName}</CasePill>}
              {report.clinicName && <CasePill>{report.clinicName}</CasePill>}
            </div>
          </div>
          <div className="lg:text-right">
            <div className="font-mono text-accent text-lg font-semibold">{report.caseId}</div>
            <div className="text-cream-muted text-sm mt-1">{formatTimestamp(report.timestamp)}</div>
            <div className="text-cream-muted text-sm mt-1">BiteNxt Lab Services</div>
            <div className="text-xs text-cream-muted/60 mt-2">
              {report.scanInfo.vertexCount.toLocaleString()} vertices ·{' '}
              {report.scanInfo.faceCount.toLocaleString()} faces ·{' '}
              {report.scanInfo.dimensionsMm.x}×{report.scanInfo.dimensionsMm.y}×
              {report.scanInfo.dimensionsMm.z} mm
            </div>
          </div>
        </div>

        {/* VERDICT BANNER */}
        <div
          className={`${verdict.bg} border ${verdict.border} rounded-xl px-8 py-6 flex items-center gap-5`}
        >
          <span className="text-4xl">{verdict.icon}</span>
          <div>
            <div className={`text-2xl font-bold ${verdict.text}`}>{verdict.label}</div>
            <div className="text-cream-muted mt-1">{report.actionText.summary}</div>
          </div>
        </div>

        {/* PARAMETER TABLE */}
        <div className="bg-navy-light border border-border-col rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-col">
            <h2 className="text-lg font-semibold text-cream">Parameter Analysis</h2>
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
                {/* Scan Quality */}
                <tr className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-cream">Scan Quality</td>
                  <td className="px-4 py-4 text-cream-muted font-mono">
                    {m.scanQuality.qualityScore}/100
                  </td>
                  <td className="px-4 py-4 text-cream-muted">≥ 80</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={report.scores.scanQuality.status} />
                  </td>
                  <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">
                    {report.scores.scanQuality.note}
                  </td>
                </tr>

                {/* Undercut Detection */}
                <tr className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-cream">Undercut Detection</td>
                  <td className="px-4 py-4 text-cream-muted font-mono">
                    {m.undercut.undercutDetected
                      ? `${m.undercut.severity} (${(m.undercut.multiHitRatio * 100).toFixed(1)}%)`
                      : 'None'}
                  </td>
                  <td className="px-4 py-4 text-cream-muted">None</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={report.scores.undercut.status} />
                  </td>
                  <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">
                    {report.scores.undercut.note}
                  </td>
                </tr>

                {/* Taper Angle */}
                <tr className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-cream">Taper Angle</td>
                  <td className="px-4 py-4 text-cream-muted font-mono">
                    {m.taper.meanTaperDeg != null ? `${m.taper.meanTaperDeg}° mean` : 'N/A'}
                  </td>
                  <td className="px-4 py-4 text-cream-muted">4–8°</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={report.scores.taper.status} />
                  </td>
                  <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">
                    {report.scores.taper.note}
                    {m.taper.distribution && (
                      <div className="mt-1 text-xs text-cream-muted/60">
                        &lt;4°: {m.taper.distribution.under4}% · 4–8°:{' '}
                        {m.taper.distribution.ideal4to8}% · &gt;8°: {m.taper.distribution.over8}%
                      </div>
                    )}
                  </td>
                </tr>

                {/* Margin Line */}
                <tr className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-cream">Margin Line</td>
                  <td className="px-4 py-4 text-cream-muted font-mono">
                    {m.margin.marginDetected
                      ? `${m.margin.marginRegularityScore} regularity`
                      : 'Not detected'}
                  </td>
                  <td className="px-4 py-4 text-cream-muted">&gt; 0.70</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={report.scores.margin.status} />
                  </td>
                  <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">
                    {report.scores.margin.note}
                  </td>
                </tr>

                {/* Occlusal Clearance */}
                <tr className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-cream">Occlusal Clearance</td>
                  <td className="px-4 py-4 text-cream-muted font-mono">
                    {m.occlusalClearance.clearanceMeasurable &&
                    m.occlusalClearance.functionalCuspClearanceMm != null
                      ? `${m.occlusalClearance.functionalCuspClearanceMm}mm`
                      : 'Awaiting opposing arch'}
                  </td>
                  <td className="px-4 py-4 text-cream-muted">≥ {minClear.toFixed(1)}mm</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={report.scores.occlusalClearance.status} />
                  </td>
                  <td className="px-4 py-4 text-cream-muted text-xs max-w-xs">
                    {report.scores.occlusalClearance.note}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTION SECTION */}
        {report.actionText.actions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-cream mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-status-red rounded-full" />
              Required Actions
            </h2>
            <div className="space-y-4">
              {report.actionText.actions.map((action, i) => (
                <div
                  key={i}
                  className={`border rounded-xl p-5 ${
                    action.severity === 'RED'
                      ? 'border-status-red/40 bg-red-950/20 border-l-4 border-l-status-red'
                      : 'border-status-yellow/40 bg-yellow-950/20 border-l-4 border-l-status-yellow'
                  }`}
                >
                  <div
                    className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                      action.severity === 'RED' ? 'text-status-red' : 'text-status-yellow'
                    }`}
                  >
                    {action.parameter}
                  </div>
                  <p className="text-cream-muted text-sm leading-relaxed">{action.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DISCLAIMER */}
        <div className="border-t border-border-col pt-6">
          <p className="text-xs text-cream-muted/60 italic leading-relaxed">
            Geometric analysis performed on uploaded STL mesh. Marginal gap is approximated from
            surface curvature. Occlusal clearance requires opposing arch STL. All values are
            geometric proxies — clinical calibration in progress. BiteNxt CaseReady™ Prototype v0.1
          </p>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 no-print pb-10">
          <Link
            href="/analyse"
            className="px-6 py-3 border border-border-col text-cream-muted rounded-lg hover:text-cream hover:border-accent transition-colors text-sm font-medium"
          >
            ← New Analysis
          </Link>
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
