'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudUpload, CheckCircle, X } from 'lucide-react'

const STLViewer = dynamic(() => import('@/components/STLViewer'), { ssr: false })

type UploadState = 'idle' | 'uploaded' | 'processing'

interface ImplantFormData {
  toothNumber: string
  implantSystem: string
  patientRisk: string[]
  dentistName: string
  clinicName: string
}

const defaultForm: ImplantFormData = {
  toothNumber: '',
  implantSystem: 'Nobel Biocare',
  patientRisk: [],
  dentistName: '',
  clinicName: '',
}

const STATUS_MESSAGES = [
  { icon: '✓', text: 'Arch scan uploaded successfully', delay: 0 },
  { icon: '⟳', text: 'Validating mesh integrity...', delay: 1500 },
  { icon: '⟳', text: 'Detecting scan body in arch scan...', delay: 3000 },
  { icon: '⟳', text: 'Measuring implant angulation...', delay: 4500 },
  { icon: '⟳', text: 'Computing emergence angle...', delay: 6000 },
  { icon: '⟳', text: 'Measuring crown space...', delay: 7500 },
  { icon: '⟳', text: 'Checking mesiodistal clearances...', delay: 9000 },
  { icon: '⟳', text: 'Generating CaseReady report...', delay: 10500 },
]

const DEMO_CASES = [
  {
    label: 'Demo: 35° angle · RED',
    path: '/stl/implant_a_red.stl',
    form: { toothNumber: '36', implantSystem: 'Nobel Biocare', patientRisk: [], dentistName: 'Dr. Ramesh Kumar', clinicName: 'Radiance Dental, Hyderabad' },
  },
  {
    label: 'Demo: 10° angle · GREEN',
    path: '/stl/implant_b_green.stl',
    form: { toothNumber: '14', implantSystem: 'Straumann', patientRisk: [], dentistName: 'Dr. Priya Sharma', clinicName: 'SmilePlus Dental, Pune' },
  },
  {
    label: 'Demo: 25° angle · YELLOW',
    path: '/stl/implant_c_yellow.stl',
    form: { toothNumber: '21', implantSystem: 'Osstem', patientRisk: [], dentistName: 'Dr. Anita Reddy', clinicName: 'Dental Care Centre, Chennai' },
  },
]

const IMPLANT_SYSTEMS = ['Nobel Biocare', 'Straumann', 'Osstem', 'BioHorizons', 'Zimmer Biomet', 'Other']

const TOOTH_GROUPS = [
  { label: 'Upper Right (1x)', teeth: [11,12,13,14,15,16,17,18] },
  { label: 'Upper Left (2x)',  teeth: [21,22,23,24,25,26,27,28] },
  { label: 'Lower Left (3x)',  teeth: [31,32,33,34,35,36,37,38] },
  { label: 'Lower Right (4x)', teeth: [41,42,43,44,45,46,47,48] },
]

const RISK_FLAGS = [
  { value: 'bruxism',    label: 'Bruxism',    note: 'Higher occlusal forces' },
  { value: 'diabetes',   label: 'Diabetes',   note: 'Impaired healing' },
  { value: 'smoker',     label: 'Smoker',     note: 'Osseointegration risk' },
  { value: 'bone_graft', label: 'Bone Graft', note: 'Reduced bone density' },
]

export default function ImplantAnalysePage() {
  const router = useRouter()
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [archFile, setArchFile] = useState<File | null>(null)
  const [opposingFile, setOpposingFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<ImplantFormData>(defaultForm)
  const [isDragOver, setIsDragOver] = useState(false)
  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const archInputRef = useRef<HTMLInputElement>(null)
  const opposingInputRef = useRef<HTMLInputElement>(null)
  const processingStartRef = useRef<number>(0)

  const canSubmit = archFile !== null && formData.toothNumber !== ''

  const handleArchFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) { alert('Please upload a .stl file'); return }
    setArchFile(file)
    setUploadState('uploaded')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleArchFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDemoCase = async (demo: typeof DEMO_CASES[0]) => {
    try {
      const res = await fetch(demo.path)
      if (!res.ok) throw new Error('Demo file not found')
      const blob = await res.blob()
      const file = new File([blob], demo.path.split('/').pop()!, { type: 'application/octet-stream' })
      setArchFile(file)
      setFormData(demo.form)
      setUploadState('uploaded')
    } catch {
      alert('Demo STL not found. Run python generate_implant_stl_demos.py first.')
    }
  }

  const handleAnalyse = async () => {
    if (!archFile) return
    setErrorMessage(null)
    setUploadState('processing')
    setVisibleMessages([])
    processingStartRef.current = Date.now()
    STATUS_MESSAGES.forEach((msg, i) => setTimeout(() => setVisibleMessages(p => [...p, i]), msg.delay))

    const fd = new FormData()
    fd.append('arch_stl', archFile)
    if (opposingFile) fd.append('opposing_stl', opposingFile)
    fd.append('tooth_number', formData.toothNumber)
    fd.append('implant_system', formData.implantSystem)
    fd.append('patient_risk', JSON.stringify(formData.patientRisk))
    fd.append('dentist_name', formData.dentistName)
    fd.append('clinic_name', formData.clinicName)

    try {
      const response = await fetch('/api/analyse_implant', { method: 'POST', body: fd })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Analysis failed')
      const elapsed = Date.now() - processingStartRef.current
      setTimeout(() => {
        localStorage.setItem(`implant_report_${result.caseId}`, JSON.stringify(result))
        router.push(`/report/implant/${result.caseId}`)
      }, Math.max(0, 8000 - elapsed))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected error')
      setUploadState('uploaded')
    }
  }

  // PROCESSING STATE
  if (uploadState === 'processing') {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-accent text-sm font-semibold mb-2">BiteNxt CaseReady™ — Implant</div>
            <h2 className="text-2xl font-semibold text-cream mb-1">Analysing your arch scan...</h2>
            <p className="text-cream-muted text-sm">Detecting scan body and measuring implant parameters</p>
          </div>
          <div className="w-full bg-navy-elevated rounded-full h-1.5 mb-8 overflow-hidden">
            <motion.div className="h-full bg-accent rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 10, ease: 'linear' }} />
          </div>
          <div className="space-y-3">
            {STATUS_MESSAGES.map((msg, i) => (
              <AnimatePresence key={i}>
                {visibleMessages.includes(i) && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-sm">
                    <span className={`text-base ${msg.icon === '✓' ? 'text-status-green' : 'text-accent'}`}>{msg.icon}</span>
                    <span className={msg.icon === '✓' ? 'text-status-green' : 'text-cream-muted'}>{msg.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // IDLE STATE
  if (uploadState === 'idle') {
    return (
      <div className="min-h-screen bg-navy">
        <nav className="border-b border-border-col px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-accent font-bold text-xl">BiteNxt</span>
            <span className="text-cream font-normal text-xl">CaseReady™</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/analyse/prep" className="text-sm text-cream-muted hover:text-cream transition-colors">Crown Prep Check</Link>
            <Link href="/report/demo-implant" className="text-sm text-cream-muted hover:text-cream transition-colors">Sample Report →</Link>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="mb-8 text-center">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 rounded-full mb-4">
              Implant Scan Analysis
            </span>
            <h1 className="text-3xl font-semibold text-cream mb-3">Check Your Implant Arch Scan</h1>
            <p className="text-cream-muted text-sm leading-relaxed max-w-lg mx-auto">
              Upload your full arch IOS scan with the scan body attached. We detect the implant position, measure angulation, emergence angle, and available crown space.
            </p>
          </div>

          {/* Clinical context box */}
          <div className="bg-navy-light border border-border-col rounded-xl p-5 mb-6">
            <p className="text-xs text-cream-muted/80 leading-relaxed">
              <span className="text-cream font-medium">What this checks:</span> The scan body geometry in your arch STL reveals the implant&apos;s 3D position. We measure angulation from vertical (ideal ≤15°, max 30°), emergence angle (max 30° or peri-implant bone loss risk), vertical crown space (min 7mm from platform to opposing), and mesiodistal clearance (min 1.5mm to adjacent teeth).
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => archInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl min-h-64 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver ? 'border-accent bg-accent/10' : 'border-border-col bg-navy-light hover:border-accent/60'
            }`}
          >
            <input ref={archInputRef} type="file" accept=".stl" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) handleArchFile(f) }} />
            <CloudUpload className={`w-12 h-12 mb-4 ${isDragOver ? 'text-accent' : 'text-cream-muted'}`} />
            <p className="text-cream font-medium mb-1">Drop your arch scan STL here</p>
            <p className="text-cream-muted text-sm">Full or partial arch with scan body attached · .stl only</p>
          </div>

          {/* Opposing arch */}
          <div className="mt-4">
            <button type="button" onClick={() => opposingInputRef.current?.click()}
              className="w-full border border-dashed border-border-col rounded-lg py-3 px-4 text-sm text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-left">
              <input ref={opposingInputRef} type="file" accept=".stl" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) setOpposingFile(f) }} />
              {opposingFile ? `✓ Opposing arch: ${opposingFile.name}` : '+ Opposing arch STL (optional — enables vertical crown space measurement)'}
            </button>
          </div>

          {/* Demo cases */}
          <div className="mt-8">
            <p className="text-xs text-cream-muted uppercase tracking-wider font-semibold mb-3 text-center">Or try a demo case</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEMO_CASES.map(demo => (
                <button key={demo.path} type="button" onClick={() => loadDemoCase(demo)}
                  className="border border-border-col rounded-lg py-2.5 px-3 text-xs text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-center">
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // UPLOADED STATE
  return (
    <div className="min-h-screen bg-navy flex flex-col">
      <nav className="border-b border-border-col px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-accent font-bold text-xl">BiteNxt</span>
          <span className="text-cream font-normal text-xl">CaseReady™</span>
        </Link>
        <button onClick={() => { setArchFile(null); setOpposingFile(null); setFormData(defaultForm); setUploadState('idle') }}
          className="text-sm text-cream-muted hover:text-cream transition-colors flex items-center gap-1">
          <X className="w-4 h-4" /> Start Over
        </button>
      </nav>

      {errorMessage && (
        <div className="bg-status-red/20 border-b border-status-red px-6 py-3 text-status-red text-sm">
          Error: {errorMessage}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: 3D Viewer */}
        <div className="lg:w-3/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-status-green" />
            <span className="text-sm text-cream font-medium">{archFile?.name}</span>
            <span className="text-xs text-cream-muted">({archFile ? (archFile.size/1024).toFixed(0) : 0} KB)</span>
            <span className="ml-auto text-xs px-2 py-0.5 bg-accent/20 text-accent border border-accent/30 rounded-full">Arch Scan</span>
          </div>
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <STLViewer file={archFile} />
          </div>
          <button type="button" onClick={() => opposingInputRef.current?.click()}
            className="w-full border border-dashed border-border-col rounded-lg py-2.5 px-4 text-sm text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-left">
            <input ref={opposingInputRef} type="file" accept=".stl" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) setOpposingFile(f) }} />
            {opposingFile ? `✓ Opposing arch: ${opposingFile.name}` : '+ Opposing arch STL (optional — enables vertical space measurement)'}
          </button>
        </div>

        {/* Right: Form */}
        <div className="lg:w-2/5 border-t lg:border-t-0 lg:border-l border-border-col flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <h2 className="text-lg font-semibold text-cream">Implant Context</h2>

            {/* Tooth number */}
            <div>
              <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">Implant Position (FDI)</label>
              <div className="relative">
                <select value={formData.toothNumber} onChange={e => setFormData(p => ({...p, toothNumber: e.target.value}))}
                  className="w-full bg-navy-elevated border border-border-col text-cream rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent appearance-none cursor-pointer">
                  <option value="">Select tooth position</option>
                  {TOOTH_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.teeth.map(t => <option key={t} value={String(t)}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-cream-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Implant system */}
            <div>
              <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">Implant System</label>
              <div className="grid grid-cols-2 gap-2">
                {IMPLANT_SYSTEMS.map(sys => (
                  <button key={sys} type="button" onClick={() => setFormData(p => ({...p, implantSystem: sys}))}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      formData.implantSystem === sys ? 'border-accent bg-navy-elevated text-cream' : 'border-border-col bg-navy text-cream-muted hover:border-accent/50'
                    }`}>{sys}</button>
                ))}
              </div>
            </div>

            {/* Patient risk */}
            <div>
              <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">Patient Risk Factors</label>
              <div className="space-y-2">
                {RISK_FLAGS.map(rf => {
                  const checked = formData.patientRisk.includes(rf.value)
                  return (
                    <label key={rf.value} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => setFormData(p => ({...p, patientRisk: checked ? p.patientRisk.filter(r=>r!==rf.value) : [...p.patientRisk, rf.value]}))}
                        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all ${checked ? 'bg-accent border-accent' : 'border-border-col bg-navy-elevated group-hover:border-accent/60'}`}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div onClick={() => setFormData(p => ({...p, patientRisk: checked ? p.patientRisk.filter(r=>r!==rf.value) : [...p.patientRisk, rf.value]}))}>
                        <span className="text-sm text-cream">{rf.label}</span>
                        <span className="text-xs text-cream-muted ml-2">({rf.note})</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Dentist / Clinic */}
            <div>
              <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">Dentist Name</label>
              <input type="text" value={formData.dentistName} onChange={e => setFormData(p=>({...p,dentistName:e.target.value}))} placeholder="Dr. Name"
                className="w-full bg-navy-elevated border border-border-col text-cream rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent placeholder:text-cream-muted" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">Clinic Name</label>
              <input type="text" value={formData.clinicName} onChange={e => setFormData(p=>({...p,clinicName:e.target.value}))} placeholder="Clinic / Hospital Name"
                className="w-full bg-navy-elevated border border-border-col text-cream rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent placeholder:text-cream-muted" />
            </div>
          </div>

          {/* Submit */}
          <div className="p-6 border-t border-border-col flex-shrink-0">
            <button onClick={handleAnalyse} disabled={!canSubmit}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${canSubmit ? 'bg-accent text-white hover:bg-accent/90 cursor-pointer' : 'bg-navy-elevated text-cream-muted cursor-not-allowed'}`}>
              Run Implant Check →
            </button>
            {!canSubmit && <p className="text-xs text-cream-muted text-center mt-2">Select implant tooth position to continue</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
