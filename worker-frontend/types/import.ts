export interface ImportRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportSummary {
  totalRows: number;
  imported: number;
  failed: number;
  batchId: string;
  errors: ImportRowError[];
  errorsTruncated: boolean;
  additionalErrors: number;
  message: string;
}
