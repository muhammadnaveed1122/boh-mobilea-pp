import { apiClient } from '@/lib/api';
import type {
  AttendanceListQuery,
  AttendanceRecord,
  PaginatedAttendance,
  TodayAttendanceResponse,
} from './types';

const BASE = '/api/v1/agent-attendance';

export async function getTodayAttendance(): Promise<TodayAttendanceResponse> {
  const { data } = await apiClient.get<TodayAttendanceResponse>(`${BASE}/today`);
  return data;
}

export async function getAttendanceList(params: AttendanceListQuery): Promise<PaginatedAttendance> {
  const { data } = await apiClient.get<PaginatedAttendance>(BASE, { params });
  return data;
}

export async function checkIn(): Promise<AttendanceRecord> {
  const { data } = await apiClient.post<AttendanceRecord>(`${BASE}/check-in`, {});
  return data;
}

export async function checkOut(): Promise<AttendanceRecord> {
  const { data } = await apiClient.post<AttendanceRecord>(`${BASE}/check-out`, {});
  return data;
}
