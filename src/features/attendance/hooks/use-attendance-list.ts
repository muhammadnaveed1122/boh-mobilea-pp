import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAttendanceList } from '../services';
import type { AttendanceListQuery, PaginatedAttendance } from '../types';
import { attendanceKeys } from './keys';

export function useAttendanceList(params: AttendanceListQuery) {
  return useQuery<PaginatedAttendance, Error>({
    queryKey: attendanceKeys.list(params),
    queryFn: () => getAttendanceList(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
