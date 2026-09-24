import { api } from "./api";
import type {
  ActivityAnalytic,
  DashboardDistributions,
  DashboardOverview,
  DashboardTrend,
  PendingReview,
  RangeParams,
  RecentReport,
  RuleAnalytic,
  SiteAnalytic,
  TopCount,
} from "@/types/dashboard";

async function get<T>(url: string, params: RangeParams & { limit?: number }): Promise<T> {
  const res = await api.get(url, { params });
  return res.data.data as T;
}

export const fetchOverview = (p: RangeParams) => get<DashboardOverview>("/dashboard/overview", p);
export const fetchTrends = (p: RangeParams) => get<DashboardTrend>("/dashboard/trends", p);
export const fetchDistributions = (p: RangeParams) =>
  get<DashboardDistributions>("/dashboard/distributions", p);
export const fetchSites = (p: RangeParams) =>
  get<{ items: SiteAnalytic[] }>("/dashboard/sites", p).then((d) => d.items);
export const fetchActivities = (p: RangeParams) =>
  get<{ items: ActivityAnalytic[] }>("/dashboard/activities", p).then((d) => d.items);
export const fetchRules = (p: RangeParams) =>
  get<{ items: RuleAnalytic[] }>("/dashboard/life-saving-rules", p).then((d) => d.items);
export const fetchRecentReports = (p: RangeParams, limit = 10) =>
  get<{ items: RecentReport[] }>("/dashboard/recent-reports", { ...p, limit }).then((d) => d.items);
export const fetchPendingReviews = (p: RangeParams, limit = 20) =>
  get<{ items: PendingReview[]; total: number }>("/dashboard/pending-reviews", { ...p, limit });
export const fetchPrecursorRules = (p: RangeParams) =>
  get<{ items: TopCount[] }>("/dashboard/precursor-rules", p).then((d) => d.items);
export const fetchBarriers = (p: RangeParams) =>
  get<{ items: TopCount[] }>("/dashboard/barriers", p).then((d) => d.items);
export const fetchEnergies = (p: RangeParams) =>
  get<{ items: TopCount[] }>("/dashboard/energies", p).then((d) => d.items);
