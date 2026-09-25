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

export interface RegisterWorkerPayload {
  name: string;
  employeeId: string;
  email: string;
  mobile?: string;
  password: string;
}

export function registerWorker(payload: RegisterWorkerPayload): Promise<{ user: { id: string; name: string; email: string; employeeId?: string | null; mobile?: string | null; role: string } }> {
  return data(api.post("/worker/auth/register", payload));
}

export interface WorkerProfile {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  mobile: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchWorkerProfile(): Promise<{ user: WorkerProfile }> {
  return data(api.get("/worker/profile"));
}

export function updateWorkerProfile(payload: { name?: string; mobile?: string }): Promise<{ user: WorkerProfile }> {
  return data(api.patch("/worker/profile", payload));
}

export function changeWorkerPassword(payload: { currentPassword: string; newPassword: string; confirmPassword?: string }): Promise<{ user: WorkerProfile }> {
  return data(api.patch("/worker/profile/password", payload));
}

export interface WorkerDraft {
  id: string;
  userId: string;
  reportType: ReportType | null;
  siteId: string | null;
  activity: string | null;
  equipment: string | null;
  description: string | null;
  date: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createDraft(payload: Partial<WorkerDraft>): Promise<{ draft: WorkerDraft }> {
  return data(api.post("/worker/drafts", payload));
}
export function listDrafts(params?: { page?: number; limit?: number }): Promise<{ items: WorkerDraft[]; pagination: Pagination }> {
  return data(api.get("/worker/drafts", { params }));
}
export function getDraft(id: string): Promise<{ draft: WorkerDraft }> {
  return data(api.get(`/worker/drafts/${id}`));
}
export function updateDraft(id: string, payload: Partial<WorkerDraft>): Promise<{ draft: WorkerDraft }> {
  return data(api.patch(`/worker/drafts/${id}`, payload));
}
export function deleteDraft(id: string): Promise<void> {
  return data(api.delete(`/worker/drafts/${id}`)).then(() => undefined);
}
export function submitDraft(id: string): Promise<{ report: SafetyReport }> {
  return data(api.post(`/worker/drafts/${id}/submit`));
}

/* ---------- Activity history (W9.6, read-only, worker-safe) ---------- */

export interface AuditEventItem {
  id: string;
  eventType: string;
  actorType: "USER" | "HSE" | "AI" | "SYSTEM";
  actor: { id: string; name: string; role: string } | null;
  description: string;
  previousStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function fetchMyReportAudit(
  id: string,
  params?: { page?: number; limit?: number }
): Promise<{ items: AuditEventItem[]; pagination: Pagination }> {
  return data(api.get(`/reports/${id}/audit`, { params }));
}
