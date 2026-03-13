'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudUpload, CheckCircle, X } from 'lucide-react'
import ParameterForm from '@/components/ParameterForm'
import { CaseInput, AnalysisReport } from '@/lib/types'

const STLViewer = dynamic(() => import('@/components/STLViewer'), { ssr: false })

type UploadState = 'idle' | 'uploaded' | 'processing'

const defaultForm: CaseInput = {
  toothNumber: '',
  caseType: 'natural_crown',
  zirconiaGrade: '3Y',
  patientRisk: [],
  dentistName: '',
  clinicName: '',
}

const STATUS_MESSAGES = [
  { icon: '✓', text: 'Scan uploaded successfully', delay: 0 },
  { icon: '⟳', text: 'Validating mesh integrity...', delay: 1500 },
  { icon: '⟳', text: 'Detecting preparation geometry...', delay: 3000 },
  { icon: '⟳', text: 'Running undercut analysis...', delay: 4500 },
  { icon: '⟳', text: 'Measuring axial wall taper...', delay: 6000 },
  { icon: '⟳', text: 'Detecting margin line...', delay: 7500 },
  { icon: '⟳', text: 'Scoring against clinical parameters...', delay: 9000 },
  { icon: '⟳', text: 'Generating CaseReady report...', delay: 10500 },
]

interface DemoCase {
  label: string
  path: string
  form: CaseInput
}

const DEMO_CASES: DemoCase[] = [
  {
    label: 'Demo: Tooth 36 · Implant · RED',
    path: '/stl/case_a_tooth36_implant.stl',
    form: {
      toothNumber: '36',
      caseType: 'implant_crown',
      zirconiaGrade: '3Y',
      patientRisk: ['bruxism'],
      dentistName: 'Dr. Ramesh Kumar',
      clinicName: 'Radiance Dental, Hyderabad',
    },
  },
  {
    label: 'Demo: Tooth 14 · Natural · GREEN',
    path: '/stl/case_b_tooth14_natural.stl',
    form: {
      toothNumber: '14',
      caseType: 'natural_crown',
      zirconiaGrade: '4Y',
      patientRisk: [],
      dentistName: 'Dr. Priya Sharma',
      clinicName: 'SmilePlus Dental, Pune',
    },
  },
  {
    label: 'Demo: Tooth 21 · Anterior · YELLOW',
    path: '/stl/case_c_tooth21_anterior.stl',
    form: {
      toothNumber: '21',
      caseType: 'natural_crown',
      zirconiaGrade: '5Y',
      patientRisk: [],
      dentistName: 'Dr. Anita Reddy',
      clinicName: 'Dental Care Centre, Chennai',
    },
  },
]

export default function AnalysePage() {
  const router = useRouter()
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [prepFile, setPrepFile] = useState<File | null>(null)
  const [opposingFile, setOpposingFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<CaseInput>(defaultForm)
  const [isDragOver, setIsDragOver] = useState(false)
  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const prepInputRef = useRef<HTMLInputElement>(null)
  const opposingInputRef = useRef<HTMLInputElement>(null)
  const processingStartRef = useRef<number>(0)

  const canSubmit =
    prepFile !== null &&
    formData.toothNumber !== '' &&
    formData.caseType !== undefined &&
    formData.zirconiaGrade !== undefined

  const handlePrepFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      alert('Please upload a .stl file')
      return
    }
    setPrepFile(file)
    setUploadState('uploaded')
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handlePrepFile(file)
    },
    []
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const loadDemoCase = async (demo: DemoCase) => {
    try {
      const res = await fetch(demo.path)
      if (!res.ok) throw new Error('Demo file not found')
      const blob = await res.blob()
      const filename = demo.path.split('/').pop() || 'demo.stl'
      const file = new File([blob], filename, { type: 'application/octet-stream' })
      setPrepFile(file)
      setFormData(demo.form)
      setUploadState('uploaded')
    } catch {
      alert('Demo STL not found. Run python generate_stl_demos.py first.')
    }
  }

  const runProcessingMessages = () => {
    STATUS_MESSAGES.forEach((msg, i) => {
      setTimeout(() => {
        setVisibleMessages((prev) => [...prev, i])
      }, msg.delay)
    })
  }

  const handleAnalyse = async () => {
    if (!prepFile) return
    setErrorMessage(null)
    setUploadState('processing')
    setVisibleMessages([])
    processingStartRef.current = Date.now()
    runProcessingMessages()

    const fd = new FormData()
    fd.append('prep_stl', prepFile)
    if (opposingFile) fd.append('opposing_stl', opposingFile)
    fd.append('tooth_number', formData.toothNumber)
    fd.append('case_type', formData.caseType)
    fd.append('zirconia_grade', formData.zirconiaGrade)
    fd.append('patient_risk', JSON.stringify(formData.patientRisk))
    fd.append('dentist_name', formData.dentistName)
    fd.append('clinic_name', formData.clinicName)

    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        body: fd,
      })

      const result: AnalysisReport = await response.json()

      if (!response.ok) {
        throw new Error((result as unknown as { error: string }).error || 'Analysis failed')
      }

      // Ensure at least 8 seconds of animation
      const elapsed = Date.now() - processingStartRef.current
      const remaining = Math.max(0, 8000 - elapsed)

      setTimeout(() => {
        localStorage.setItem(`report_${result.caseId}`, JSON.stringify(result))
        router.push(`/report/${result.caseId}`)
      }, remaining)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMessage(message)
      setUploadState('uploaded')
    }
  }

  // PROCESSING STATE
  if (uploadState === 'processing') {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-accent text-sm font-semibold mb-2">BiteNxt CaseReady™</div>
            <h2 className="text-2xl font-semibold text-cream mb-1">
              Analysing your preparation scan...
            </h2>
            <p className="text-cream-muted text-sm">This typically takes 10–30 seconds</p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-navy-elevated rounded-full h-1.5 mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 10, ease: 'linear' }}
            />
          </div>

          {/* Status messages */}
          <div className="space-y-3">
            {STATUS_MESSAGES.map((msg, i) => (
              <AnimatePresence key={i}>
                {visibleMessages.includes(i) && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={`text-base ${
                        msg.icon === '✓' ? 'text-status-green' : 'text-accent'
                      }`}
                    >
                      {msg.icon}
                    </span>
                    <span
                      className={
                        msg.icon === '✓' ? 'text-status-green' : 'text-cream-muted'
                      }
                    >
                      {msg.text}
                    </span>
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
        {/* Navbar */}
        <nav className="border-b border-border-col px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-accent font-bold text-xl">BiteNxt</span>
            <span className="text-cream font-normal text-xl">CaseReady™</span>
          </Link>
          <Link href="/report/demo" className="text-sm text-cream-muted hover:text-cream transition-colors">
            View Sample Report →
          </Link>
        </nav>

        <div className="max-w-2xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-semibold text-cream mb-8 text-center">New Case Analysis</h1>

          {/* Main drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => prepInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl min-h-64 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-accent bg-accent/10'
                : 'border-border-col bg-navy-light hover:border-accent/60 hover:bg-navy-elevated/50'
            }`}
          >
            <input
              ref={prepInputRef}
              type="file"
              accept=".stl"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePrepFile(file)
              }}
            />
            <CloudUpload
              className={`w-12 h-12 mb-4 ${isDragOver ? 'text-accent' : 'text-cream-muted'}`}
            />
            <p className="text-cream font-medium mb-1">Drop your preparation STL file here</p>
            <p className="text-cream-muted text-sm">or click to browse · .stl files only</p>
          </div>

          {/* Opposing arch */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => opposingInputRef.current?.click()}
              className="w-full border border-dashed border-border-col rounded-lg py-3 px-4 text-sm text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-left"
            >
              <input
                ref={opposingInputRef}
                type="file"
                accept=".stl"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setOpposingFile(file)
                }}
              />
              {opposingFile
                ? `✓ Opposing arch: ${opposingFile.name}`
                : '+ Opposing arch STL (optional — enables occlusal clearance measurement)'}
            </button>
          </div>

          {/* Demo cases */}
          <div className="mt-8">
            <p className="text-xs text-cream-muted uppercase tracking-wider font-semibold mb-3 text-center">
              Or try a demo case
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEMO_CASES.map((demo) => (
                <button
                  key={demo.path}
                  type="button"
                  onClick={() => loadDemoCase(demo)}
                  className="border border-border-col rounded-lg py-2.5 px-3 text-xs text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-center"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // UPLOADED STATE — two column viewer + form
  return (
    <div className="min-h-screen bg-navy flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border-col px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-accent font-bold text-xl">BiteNxt</span>
          <span className="text-cream font-normal text-xl">CaseReady™</span>
        </Link>
        <button
          onClick={() => {
            setPrepFile(null)
            setOpposingFile(null)
            setFormData(defaultForm)
            setUploadState('idle')
            setErrorMessage(null)
          }}
          className="text-sm text-cream-muted hover:text-cream transition-colors flex items-center gap-1"
        >
          <X className="w-4 h-4" /> Start Over
        </button>
      </nav>

      {errorMessage && (
        <div className="bg-status-red/20 border-b border-status-red px-6 py-3 text-status-red text-sm">
          Error: {errorMessage}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: 3D Viewer (60%) */}
        <div className="lg:w-3/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-status-green" />
            <span className="text-sm text-cream font-medium">{prepFile?.name}</span>
            <span className="text-xs text-cream-muted">
              ({prepFile ? (prepFile.size / 1024).toFixed(0) : 0} KB)
            </span>
            <button
              onClick={() => prepInputRef.current?.click()}
              className="ml-auto text-xs text-cream-muted hover:text-accent transition-colors"
            >
              Change file
            </button>
            <input
              ref={prepInputRef}
              type="file"
              accept=".stl"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePrepFile(file)
              }}
            />
          </div>
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <STLViewer file={prepFile} />
          </div>
          {/* Opposing arch upload in uploaded state */}
          <div>
            <button
              type="button"
              onClick={() => opposingInputRef.current?.click()}
              className="w-full border border-dashed border-border-col rounded-lg py-2.5 px-4 text-sm text-cream-muted hover:text-cream hover:border-accent/60 transition-colors text-left"
            >
              <input
                ref={opposingInputRef}
                type="file"
                accept=".stl"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setOpposingFile(file)
                }}
              />
              {opposingFile
                ? `✓ Opposing arch: ${opposingFile.name}`
                : '+ Opposing arch STL (optional — enables occlusal clearance measurement)'}
            </button>
          </div>
        </div>

        {/* Right: Form (40%) */}
        <div className="lg:w-2/5 border-t lg:border-t-0 lg:border-l border-border-col flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-cream mb-6">Clinical Context</h2>
            <ParameterForm value={formData} onChange={setFormData} />
          </div>

          {/* Submit button */}
          <div className="p-6 border-t border-border-col flex-shrink-0">
            <button
              onClick={handleAnalyse}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                canSubmit
                  ? 'bg-accent text-white hover:bg-accent/90 cursor-pointer'
                  : 'bg-navy-elevated text-cream-muted cursor-not-allowed'
              }`}
            >
              Run Scan Check →
            </button>
            {!canSubmit && (
              <p className="text-xs text-cream-muted text-center mt-2">
                Select tooth number, case type, and zirconia grade to continue
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
