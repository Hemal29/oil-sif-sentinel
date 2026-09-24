import type { AIAnalysis, SafetyReport } from "./report";

export type HseDecision = "CONFIRMED" | "REJECTED" | "NEEDS_MORE_INFO";

export type ReasonCode =
  | "VALID_PRECURSOR"
  | "FALSE_POSITIVE"
  | "INSUFFICIENT_INFORMATION"
  | "OTHER";

export const HSE_DECISIONS: HseDecision[] = ["CONFIRMED", "REJECTED", "NEEDS_MORE_INFO"];

export const REASON_CODES: ReasonCode[] = [
  "VALID_PRECURSOR",
  "FALSE_POSITIVE",
  "INSUFFICIENT_INFORMATION",
  "OTHER",
];

export interface Review {
  id: string;
  reportId: string;
  reviewerId: string;
  aiPrediction: unknown | null;
  hseDecision: HseDecision | null;
  comment: string | null;
  reasonCode: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewPayload {
  reportId: string;
  hseDecision: HseDecision;
  comment?: string;
  reasonCode?: ReasonCode;
}

/** Item from GET /api/v1/reviews/pending — a Report with site + AI analysis. */
export type PendingReviewItem = SafetyReport & {
  aiAnalysis: AIAnalysis | null;
};

export interface PendingReviewsResponse {
  items: PendingReviewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
