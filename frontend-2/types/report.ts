export type ReportType = "UNSAFE_ACT" | "UNSAFE_CONDITION" | "NEAR_MISS";
export type ReportStatus = "NEW" | "ANALYZED" | "UNDER_REVIEW" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AnalysisStatus = "PENDING" | "COMPLETED" | "FAILED";
export type SifRoute = "AUTO_CLOSE" | "UNCERTAIN" | "PRIORITY" | "ABSTAIN";
export type SifPotential = "YES" | "NO" | "INSUFFICIENT_INFORMATION";
export type ExtractionStatus = "skipped" | "success" | "repaired" | "failed" | "pending-provider";

export interface ReportSite {
  id: string;
  name: string;
  code: string | null;
}

export interface ReportCreator {
  id: string;
  name: string;
  email: string;
}

export interface ExtractedEntities {
  equipment: string[];
  hazards: string[];
  barriers: string[];
  activities: string[];
}

export interface MatchedRule {
  code: string;
  phrase: string;
}

export interface ClarificationRequest {
  reason: string;
  suggestedQuestions: string[];
}

export interface AIAnalysis {
  id: string;
  reportId: string;
  sifPotential: boolean | string | null;
  confidence: number | null;
  activity: string | null;
  hazard: string | null;
  barrierFailure: string | null;
  consequence: string | null;
  lifeSavingRuleId: string | null;
  priority: Priority | null;
  evidence: string[] | null;
  extractedEntities: ExtractedEntities | null;
  modelName: string | null;
  modelVersion: string | null;
  analysisStatus: AnalysisStatus;
  /** Alias for analysisStatus for list endpoints that return compact `status` */
  status?: AnalysisStatus | null;
  // Phase 7 layered SIF engine (null for legacy/prototype rows).
  schemaVersion?: string | null;
  riskScore?: number | null;
  scoreKind?: string | null;
  route?: SifRoute | null;
  requiresHumanReview?: boolean | null;
  escalatedToExtraction?: boolean | null;
  matchedRules?: MatchedRule[] | null;
  primaryRule?: string | null;
  secondaryRules?: string[] | null;
  hazardEnergy?: string | null;
  eventStatus?: string | null;
  barriersFailed?: string[] | null;
  assets?: string[] | null;
  rationale?: string | null;
  extractionStatus?: ExtractionStatus | null;
  repairAttempts?: number | null;
  failureReason?: string | null;
  clarificationRequest?: ClarificationRequest | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafetyReport {
  id: string;
  reportNumber: string;
  date: string;
  siteId: string;
  location: string | null;
  activity: string;
  reportType: ReportType;
  description: string;
  equipment: string | null;
  language: string;
  sourceFile: string | null;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  site?: ReportSite | null;
  creator?: ReportCreator | null;
  /** AI assessment — compact on list, full on detail. Null = never analyzed (UNANALYZED). Undefined = field not included by endpoint (rare). */
  aiAnalysis?: AIAnalysis | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportsListResponse {
  items: SafetyReport[];
  pagination: Pagination;
}

/** Query params accepted by GET /api/v1/reports (see report.validator.js). */
export interface ReportFilters {
  page?: number;
  limit?: number;
  search?: string;
  /** Site UUID. */
  site?: string;
  activity?: string;
  reportType?: ReportType | "";
  status?: ReportStatus | "";
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "date" | "createdAt" | "reportNumber";
  sortOrder?: "asc" | "desc";
}
