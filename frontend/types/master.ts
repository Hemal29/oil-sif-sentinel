import type { Pagination } from "./report";

export type MasterStatus = "ACTIVE" | "INACTIVE";

export interface Site {
  id: string;
  name: string;
  code: string;
  location: string | null;
  description: string | null;
  status: MasterStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Activity {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: MasterStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface LifeSavingRule {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: MasterStatus;
  isPrototype: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterListResponse<T> {
  items: T[];
  pagination: Pagination;
}
