'use client'

import { CaseInput, CaseType, ZirconiaGrade, RiskFlag } from '@/lib/types'

interface ParameterFormProps {
  value: CaseInput
  onChange: (v: CaseInput) => void
}

const toothGroups = [
  {
    label: 'Upper Right (1x)',
    teeth: [11, 12, 13, 14, 15, 16, 17, 18],
  },
  {
    label: 'Upper Left (2x)',
    teeth: [21, 22, 23, 24, 25, 26, 27, 28],
  },
  {
    label: 'Lower Left (3x)',
    teeth: [31, 32, 33, 34, 35, 36, 37, 38],
  },
  {
    label: 'Lower Right (4x)',
    teeth: [41, 42, 43, 44, 45, 46, 47, 48],
  },
]

const caseTypes: { value: CaseType; label: string }[] = [
  { value: 'natural_crown', label: 'Natural Tooth Crown' },
  { value: 'implant_crown', label: 'Implant Crown' },
  { value: 'bridge', label: 'Bridge' },
]

const zirconiaGrades: {
  value: ZirconiaGrade
  label: string
  description: string
}[] = [
  {
    value: '3Y',
    label: '3Y Monolithic',
    description: 'Highest strength · ≥1.5mm clearance',
  },
  {
    value: '4Y',
    label: '4Y High Translucency',
    description: 'Balanced · ≥1.2mm clearance',
  },
  {
    value: '5Y',
    label: '5Y Ultra Translucency',
    description: 'Most aesthetic · ≥0.7mm clearance',
  },
]

const riskFlags: { value: RiskFlag; label: string; note: string }[] = [
  {
    value: 'bruxism',
    label: 'Bruxism',
    note: '+0.3mm clearance buffer',
  },
  { value: 'diabetes', label: 'Diabetes', note: '' },
  { value: 'smoker', label: 'Smoker', note: '' },
  { value: 'bone_graft', label: 'Bone Graft', note: '' },
]

const inputClass =
  'w-full bg-navy-elevated border border-border-col text-cream rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-cream-muted'

const selectClass =
  'w-full bg-navy-elevated border border-border-col text-cream rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer'

export default function ParameterForm({ value, onChange }: ParameterFormProps) {
  const set = (partial: Partial<CaseInput>) => onChange({ ...value, ...partial })

  const toggleRisk = (risk: RiskFlag) => {
    const current = value.patientRisk
    if (current.includes(risk)) {
      set({ patientRisk: current.filter((r) => r !== risk) })
    } else {
      set({ patientRisk: [...current, risk] })
    }
  }

  return (
    <div className="space-y-6">
      {/* TOOTH NUMBER */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Tooth Number (FDI)
        </label>
        <div className="relative">
          <select
            value={value.toothNumber}
            onChange={(e) => set({ toothNumber: e.target.value })}
            className={selectClass}
          >
            <option value="">Select tooth number</option>
            {toothGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.teeth.map((tooth) => (
                  <option key={tooth} value={String(tooth)}>
                    {tooth}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-cream-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* CASE TYPE */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Case Type
        </label>
        <div className="grid grid-cols-1 gap-2">
          {caseTypes.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => set({ caseType: ct.value })}
              className={`text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                value.caseType === ct.value
                  ? 'border-accent bg-navy-elevated text-cream'
                  : 'border-border-col bg-navy text-cream-muted hover:border-accent/50 hover:text-cream'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* ZIRCONIA GRADE */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Zirconia Grade
        </label>
        <div className="grid grid-cols-1 gap-2">
          {zirconiaGrades.map((zg) => (
            <button
              key={zg.value}
              type="button"
              onClick={() => set({ zirconiaGrade: zg.value })}
              className={`text-left px-4 py-3 rounded-lg border transition-all ${
                value.zirconiaGrade === zg.value
                  ? 'border-accent bg-navy-elevated'
                  : 'border-border-col bg-navy hover:border-accent/50'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  value.zirconiaGrade === zg.value ? 'text-cream' : 'text-cream-muted'
                }`}
              >
                {zg.label}
              </div>
              <div className="text-xs text-cream-muted/70 mt-0.5">{zg.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* PATIENT RISK */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Patient Risk Factors
        </label>
        <div className="space-y-2">
          {riskFlags.map((rf) => {
            const checked = value.patientRisk.includes(rf.value)
            return (
              <label
                key={rf.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div
                  onClick={() => toggleRisk(rf.value)}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                    checked
                      ? 'bg-accent border-accent'
                      : 'border-border-col bg-navy-elevated group-hover:border-accent/60'
                  }`}
                >
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div
                  onClick={() => toggleRisk(rf.value)}
                  className="flex-1"
                >
                  <span className="text-sm text-cream">{rf.label}</span>
                  {rf.note && (
                    <span className="text-xs text-cream-muted ml-2">({rf.note})</span>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* DENTIST NAME */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Dentist Name
        </label>
        <input
          type="text"
          value={value.dentistName}
          onChange={(e) => set({ dentistName: e.target.value })}
          placeholder="Dr. Name"
          className={inputClass}
        />
      </div>

      {/* CLINIC NAME */}
      <div>
        <label className="block text-xs font-semibold text-cream-muted uppercase tracking-wider mb-2">
          Clinic Name
        </label>
        <input
          type="text"
          value={value.clinicName}
          onChange={(e) => set({ clinicName: e.target.value })}
          placeholder="Clinic / Hospital Name"
          className={inputClass}
        />
      </div>
    </div>
  )
}
