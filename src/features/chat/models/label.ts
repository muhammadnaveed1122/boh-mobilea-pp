export interface ChatLabel {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

/** One row in the bulk-save payload. New labels omit `id`. */
export interface SaveLabelItem {
  id?: string;
  name: string;
  color: string;
}

export const LABEL_PRESET_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#a855f7',
  '#1e293b',
] as const;
