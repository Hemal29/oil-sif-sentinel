import type { AIAnalysis, ExtractedEntities, Priority } from "./report";

export type { AIAnalysis, ExtractedEntities, Priority };

export interface AnalyzeResponse {
  analysis: AIAnalysis;
  reportStatus: string;
}

export const PROTOTYPE_DISCLAIMER =
  "Current AI output is prototype/integration scaffolding and is not an official OIL safety methodology.";
