import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkIn } from '../services';
import type { AttendanceRecord } from '../types';
import { attendanceKeys } from './keys';

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation<AttendanceRecord, Error, void>({
    mutationFn: checkIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all }).catch(() => {});
    },
  });
}
