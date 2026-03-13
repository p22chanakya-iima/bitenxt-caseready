export type CaseType = 'natural_crown' | 'implant_crown' | 'bridge'
export type ZirconiaGrade = '3Y' | '4Y' | '5Y'
export type RiskFlag = 'bruxism' | 'diabetes' | 'smoker' | 'bone_graft'
export type StatusColor = 'GREEN' | 'YELLOW' | 'RED' | 'PENDING'
export type ImplantSystem = 'Nobel Biocare' | 'Straumann' | 'Osstem' | 'BioHorizons' | 'Zimmer Biomet' | 'Other'

export interface CaseInput {
  toothNumber: string
  caseType: CaseType
  zirconiaGrade: ZirconiaGrade
  patientRisk: RiskFlag[]
  dentistName: string
  clinicName: string
}

export interface ParameterScore {
  status: StatusColor
  note: string
}

export interface ActionItem {
  severity: 'RED' | 'YELLOW'
  parameter: string
  text: string
}

export interface AnalysisReport {
  caseId: string
  toothNumber: string
  caseType: CaseType
  zirconiaGrade: ZirconiaGrade
  patientRisk: RiskFlag[]
  dentistName: string
  clinicName: string
  timestamp: string
  scanInfo: {
    vertexCount: number
    faceCount: number
    dimensionsMm: { x: number; y: number; z: number }
  }
  measurements: {
    scanQuality: {
      qualityScore: number
      isWatertight: boolean
      isWindingConsistent: boolean
      vertexCount: number
      faceCount: number
      degenerateFaceRatio: number
      issues: string[]
      usable: boolean
    }
    undercut: {
      undercutDetected: boolean
      severity: 'none' | 'moderate' | 'severe'
      undercutFaceRatio: number
      multiHitRatio: number
    }
    taper: {
      meanTaperDeg: number
      stdTaperDeg: number
      distribution: { under4: number; ideal4to8: number; over8: number }
      axialFaceCount: number
    }
    margin: {
      marginDetected: boolean
      marginRegularityScore: number
      marginZVariationMm: number
      marginVertexCount: number
    }
    occlusalClearance: {
      clearanceMeasurable: boolean
      minClearanceMm?: number
      meanClearanceMm?: number
      functionalCuspClearanceMm?: number
    }
  }
  scores: {
    scanQuality: ParameterScore
    undercut: ParameterScore
    taper: ParameterScore
    margin: ParameterScore
    occlusalClearance: ParameterScore
  }
  overall: StatusColor
  actionText: {
    summary: string
    actions: ActionItem[]
  }
}

// ── Implant analysis types ────────────────────────────────────────────────────

export interface ImplantCaseInput {
  toothNumber: string
  implantSystem: ImplantSystem | string
  patientRisk: string[]
  dentistName: string
  clinicName: string
}

export interface ImplantParameterScore {
  status: StatusColor
  note: string
}

export interface ImplantReport {
  caseId: string
  toothNumber: string
  implantSystem: string
  patientRisk: string[]
  dentistName: string
  clinicName: string
  timestamp: string
  scanInfo: {
    vertexCount: number
    faceCount: number
    dimensionsMm: { x: number; y: number; z: number }
  }
  measurements: {
    scanQuality: { qualityScore: number; issues: string[]; usable: boolean; vertexCount: number }
    scanBody: {
      detected: boolean
      angulationDeg: number | null
      heightAboveRidgeMm: number | null
      protrustionVertexCount: number
      error?: string
    }
    angulation: { angulationDeg: number | null; emergenceAngleDeg: number | null }
    mesiodistalSpace: { mesialMm: number | null; distalMm: number | null }
    verticalSpace: { measurable: boolean; platformToOpposingMm?: number }
  }
  scores: {
    scanQuality: ImplantParameterScore
    scanBodyDetection: ImplantParameterScore
    implantAngulation: ImplantParameterScore
    emergenceAngle: ImplantParameterScore
    mesiodistalSpace: ImplantParameterScore
    verticalSpace: ImplantParameterScore
  }
  overall: StatusColor
  actionText: {
    summary: string
    actions: ActionItem[]
  }
}
