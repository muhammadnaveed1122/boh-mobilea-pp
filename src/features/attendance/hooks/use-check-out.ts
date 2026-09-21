import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkOut } from '../services';
import type { AttendanceRecord } from '../types';
import { attendanceKeys } from './keys';

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation<AttendanceRecord, Error, void>({
    mutationFn: checkOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all }).catch(() => {});
    },
  });
}
