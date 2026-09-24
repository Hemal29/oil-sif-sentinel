export type DatePreset = "7d" | "30d" | "90d" | "1y" | "all";

export interface RangeParams {
  preset?: DatePreset;
  dateFrom?: string;
  dateTo?: string;
}

export interface DashboardOverview {
  totalReports: number;
  sifPotential: number;
  highPriority: number;
  pendingReviews: number;
  // Phase 7 layered-engine KPIs (older backends may omit them).
  aiAbstained?: number;
  aiUncertain?: number;
  autoClosed?: number;
  priorityReports?: number;
}

export interface TopCount {
  name: string;
  count: number;
}

export type ReportTypeKey = "UNSAFE_ACT" | "UNSAFE_CONDITION" | "NEAR_MISS";
export type PriorityKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DashboardDistributions {
  reportType: Record<ReportTypeKey, number>;
  priority: Record<PriorityKey, number>;
  sif: { sif: number; nonSif: number; unanalyzed: number };
}

export interface TrendPoint {
  date: string;
  totalReports: number;
  sifReports: number;
}

export interface DashboardTrend {
  bucket: "day" | "week" | "month";
  points: TrendPoint[];
}

export interface SiteAnalytic {
  siteId: string;
  siteName: string;
  siteCode: string | null;
  reportCount: number;
  sifCount: number;
  highCriticalCount: number;
}

export interface ActivityAnalytic {
  activity: string;
  reportCount: number;
  sifCount: number;
  highCriticalCount: number;
}

export interface RuleAnalytic {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  isPrototype: boolean;
  reportCount: number;
  sifCount: number;
}

export interface RecentReport {
  analysisId: string;
  reportId: string;
  reportNumber: string;
  date: string;
  siteName: string;
  activity: string;
  reportType: string;
  sifPotential: boolean | null;
  priority: string | null;
  status: string;
}

export interface PendingReview {
  reportId: string;
  reportNumber: string;
  date: string;
  siteName: string;
  activity: string;
  reportType: string;
  sifPotential: boolean | null;
  priority: string | null;
  status: string;
}
