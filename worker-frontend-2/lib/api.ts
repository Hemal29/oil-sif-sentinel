import axios from "axios";
import type { AnalyzeResponse } from "@/types/analysis";
import type { ImportSummary } from "@/types/import";
import type { Activity, LifeSavingRule, MasterListResponse, Site } from "@/types/master";
import type {
  ReportFilters,
  ReportsListResponse,
  SafetyReport,
} from "@/types/report";
import type {
  CreateReviewPayload,
  PendingReviewsResponse,
} from "@/types/review";

export const TOKEN_KEY = "sif_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5002/api/v1",
});

function storedToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = storedToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handling: expired/invalid sessions return to login.
// Individual pages may still handle 401 first (e.g. to avoid redirect loops
// on the login page itself — callers check `isUnauthorized` instead).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      typeof window !== "undefined" &&
      err?.response?.status === 401 &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login?expired=1";
    }
    return Promise.reject(err);
  }
);

export function isUnauthorized(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 401
  );
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((res) => res.data.data);
}

/* ---------- Reports ---------- */

export function fetchReports(filters: ReportFilters): Promise<ReportsListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.site) params.site = filters.site;
  if (filters.activity?.trim()) params.activity = filters.activity.trim();
  if (filters.reportType) params.reportType = filters.reportType;
  if (filters.status) params.status = filters.status;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortOrder) params.sortOrder = filters.sortOrder;
  return data(api.get("/reports", { params }));
}

export function fetchReportById(id: string): Promise<{ report: SafetyReport }> {
  return data(api.get(`/reports/${id}`));
}

export function uploadReports(file: File): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);
  return data(api.post("/reports/upload", form));
}

/* ---------- Analysis ---------- */

export function analyzeReport(id: string): Promise<AnalyzeResponse> {
  return data(api.post(`/analysis/reports/${id}`));
}

/* ---------- Reviews ---------- */

export function fetchPendingReviews(page = 1, limit = 20): Promise<PendingReviewsResponse> {
  return data(api.get("/reviews/pending", { params: { page, limit } }));
}

export function submitReview(
  payload: CreateReviewPayload
): Promise<{ review: unknown; reportStatus: string }> {
  return data(api.post("/reviews", payload));
}

/* ---------- Master data ---------- */

interface MasterQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function fetchSites(q: MasterQuery = {}): Promise<MasterListResponse<Site>> {
  return data(api.get("/sites", { params: { ...q, limit: q.limit ?? 100 } }));
}

export function fetchActivities(q: MasterQuery = {}): Promise<MasterListResponse<Activity>> {
  return data(api.get("/activities", { params: { ...q, limit: q.limit ?? 100 } }));
}

export function fetchRules(q: MasterQuery = {}): Promise<MasterListResponse<LifeSavingRule>> {
  return data(api.get("/rules", { params: { ...q, limit: q.limit ?? 100 } }));
}

export function fetchRuleById(id: string): Promise<{ rule: LifeSavingRule }> {
  return data(api.get(`/rules/${id}`));
}

export function createSite(payload: {
  name: string;
  code: string;
  location?: string;
  description?: string;
}): Promise<{ site: Site }> {
  return data(api.post("/sites", payload));
}

export function updateSite(id: string, payload: Record<string, string>): Promise<{ site: Site }> {
  return data(api.patch(`/sites/${id}`, payload));
}

export function createActivity(payload: {
  name: string;
  code: string;
  description?: string;
}): Promise<{ activity: Activity }> {
  return data(api.post("/activities", payload));
}

export function updateActivity(
  id: string,
  payload: Record<string, string>
): Promise<{ activity: Activity }> {
  return data(api.patch(`/activities/${id}`, payload));
}

export function createRule(payload: {
  name: string;
  code: string;
  description?: string;
  isPrototype?: boolean;
}): Promise<{ rule: LifeSavingRule }> {
  return data(api.post("/rules", payload));
}

export function updateRule(
  id: string,
  payload: Record<string, string | boolean>
): Promise<{ rule: LifeSavingRule }> {
  return data(api.patch(`/rules/${id}`, payload));
}

/* ---------- Notifications ---------- */
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  reportId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchNotifications(params?: { page?: number; limit?: number }): Promise<{ items: Notification[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  return data(api.get("/notifications", { params }));
}
export function fetchUnreadCount(): Promise<{ count: number }> {
  return data(api.get("/notifications/unread-count"));
}
export function markNotificationRead(id: string): Promise<{ notification: Notification }> {
  return data(api.patch(`/notifications/${id}/read`));
}
export function markAllNotificationsRead(): Promise<void> {
  return data(api.patch("/notifications/read-all")).then(() => undefined);
}
