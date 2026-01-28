
export enum UserRole {
  COMERCIAL = 'COMERCIAL',
  CARTERA = 'ANALISTA CARTERA',
  DIRECTOR = 'DIRECTOR CARTERA'
}

export type AnalysisStatus = 'PENDIENTE_CARTERA' | 'PENDIENTE_DIRECTOR' | 'ANALIZADO' | 'APROBADO' | 'NEGADO';

export interface CommercialMember {
  name: string;
  email: string;
}

export interface DocumentValidation {
  fileName: string;
  isValid: boolean;
  issue?: string; // e.g., "Vencido (>90 días)", "NIT no coincide"
  detectedDate?: string;
}

export interface ValidationResult {
  overallValid: boolean;
  results: DocumentValidation[];
  summary: string;
  rawData?: any; // Stores the full structured JSON from the AI analysis
}

export interface FinancialIndicators {
  // Liquidez
  razonCorriente: number;
  pruebaAcida: number;
  knt: number;
  
  // Endeudamiento
  endeudamientoGlobal: number;
  endeudamientoLP: number;
  endeudamientoCP: number;
  solvencia: number;
  apalancamientoFinanciero: number; // NEW
  cargaFinanciera: number; // NEW
  
  // Rentabilidad
  margenBruto: number; // NEW
  margenOperacional: number;
  margenNeto: number;
  margenContribucion: number; // NEW
  roa: number;
  roe: number;
  
  // Operación
  ebit: number;
  ebitda: number;
  puntoEquilibrio: number; // NEW
  rotacionActivos: number; // NEW
  diasCartera: number;
  diasInventario: number;
  cicloOperacional: number;

  // Riesgo
  zAltman: number;
  riesgoInsolvencia: number;
  deterioroPatrimonial: boolean;
}

export interface CupoVariables {
  v1_datacredito_avg: number;
  v1_weighted: number;
  v2_otorga: number;
  v3_informa_max: number;
  v3_weighted: number;
  v4_utilidad_mensual: number;
  v5_referencias_avg: number;
  v6_ebitda_monthly: number;
}

export interface CupoAnalysis {
  variables?: CupoVariables; // To store breakdown if needed
  resultadoPromedio: number; // The calculated suggestion
  cupoConservador?: number; // Optional based on prompt
  cupoLiberal?: number; // Optional based on prompt
  plazoRecomendado: number;
}

export interface CreditAnalysis {
  id: string;
  clientName: string;
  nit: string;
  comercial: CommercialMember;
  
  // New Mandatory Fields
  empresa?: string;
  unidadNegocio?: string;

  date: string;
  status: AnalysisStatus;
  
  // Google Drive Integration
  driveFolderId?: string; // Stores the ID of the folder created in Step 1
  driveFolderUrl?: string; // Stores the full URL to open in new tab

  // Commercial Data Bucket
  commercialFiles: {
    rut?: File | null;
    debidaDiligencia?: File | null; // NEW: Mandatory first step
    estadosFinancieros?: File | null;
    camara?: File | null;
    referenciaComercial?: File | null;
    certificacionBancaria?: File | null;
    declaracionRenta?: File | null;
    extractos?: File | null;
    cedulaRL?: File | null;
    composicion?: File | null;
  };

  // Risk Data Bucket (Cartera)
  riskFiles: {
    datacredito?: File | null;
    informa?: File | null;
  };

  // AI Output (Populated only after Director triggers it)
  aiResult?: {
    verdict: 'APROBADO' | 'NEGADO';
    suggestedCupo: number;
    cupoVariables?: CupoVariables;
    justification: string;
    scoreProbability: number; // 0-1
    financialIndicators: FinancialIndicators;
    financialIndicatorInterpretations?: { [key: string]: string }; // NEW: Interprets specifically
    flags: {
      green: string[];
      red: string[];
    };
  };

  // Validation Result from Commercial Step
  validationResult?: ValidationResult;

  // Enriched Fields for UI
  indicators?: FinancialIndicators;
  cupo?: CupoAnalysis;
  riskLevel?: 'BAJO' | 'MODERADO' | 'ALTO';
  moraProbability?: string;
  flags?: {
    green: string[];
    red: string[];
  };

  // Human Decision
  assignedCupo?: number;
  assignedPlazo?: number; // NEW: Stores the Director's final decision on payment terms
  rejectionReason?: string;

  // Concurrency Control
  lastUpdated?: number; // Timestamp from server to prevent race conditions
}
