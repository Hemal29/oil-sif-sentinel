import { api } from "./api";
import type { Pagination, ReportStatus, ReportType, SafetyReport } from "@/types/report";

export interface WorkerReview {
  hseDecision: "CONFIRMED" | "REJECTED" | "NEEDS_MORE_INFO" | null;
  comment: string | null;
  reasonCode: string | null;
  reviewedAt: string | null;
}

export interface WorkerReport extends SafetyReport {
  latestReview?: WorkerReview | null;
}

export interface WorkerSummary {
  myReports: number;
  underReview: number;
  needsInformation: number;
  closed: number;
}

export interface CreateWorkerReportPayload {
  date: string;
  siteId: string;
  location?: string;
  activity: string;
  reportType: ReportType;
  description: string;
  equipment?: string;
  language?: string;
}

export interface WorkerReportFilters {
  page?: number;
  limit?: number;
  search?: string;
  site?: string;
  reportType?: ReportType | "";
  status?: ReportStatus | "";
  dateFrom?: string;
  dateTo?: string;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((res) => res.data.data);
}

export function fetchWorkerSummary(): Promise<WorkerSummary> {
  return data(api.get("/worker/summary"));
}

export function fetchMyReports(filters: WorkerReportFilters): Promise<{ items: WorkerReport[]; pagination: Pagination }> {
  const params: Record<string, string | number> = {};
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.site) params.site = filters.site;
  if (filters.reportType) params.reportType = filters.reportType;
  if (filters.status) params.status = filters.status;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  return data(api.get("/worker/reports", { params }));
}

export function fetchMyReport(id: string): Promise<{ report: WorkerReport }> {
  return data(api.get(`/worker/reports/${id}`));
}

export function createWorkerReport(payload: CreateWorkerReportPayload): Promise<{ report: SafetyReport }> {
  return data(api.post("/worker/reports", payload));
}
