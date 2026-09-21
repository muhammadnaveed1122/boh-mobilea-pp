import type { AttendanceListQuery } from '../types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (): readonly unknown[] => ['attendance', 'today'] as const,
  list: (params: AttendanceListQuery): readonly unknown[] =>
    ['attendance', 'list', params] as const,
};
