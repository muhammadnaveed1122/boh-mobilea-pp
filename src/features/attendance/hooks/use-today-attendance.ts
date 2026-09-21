import { useQuery } from '@tanstack/react-query';
import { getTodayAttendance } from '../services';
import type { TodayAttendanceResponse } from '../types';
import { attendanceKeys } from './keys';

export function useTodayAttendance() {
  return useQuery<TodayAttendanceResponse, Error>({
    queryKey: attendanceKeys.today(),
    queryFn: getTodayAttendance,
    staleTime: 60_000,
  });
}
