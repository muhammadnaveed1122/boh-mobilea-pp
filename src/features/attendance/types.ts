export interface AttendanceRecord {
  id: string;
  userId: string;
  attendanceDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationSeconds: number | null;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodayAttendanceResponse {
  sessions: AttendanceRecord[];
  openSession: AttendanceRecord | null;
  totalDurationSeconds: number;
}

export interface AttendanceListQuery {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedAttendance {
  items: AttendanceRecord[];
  meta: PaginationMeta;
}
