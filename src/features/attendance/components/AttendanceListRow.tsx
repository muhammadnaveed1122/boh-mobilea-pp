import { View } from 'react-native';
import { format } from 'date-fns';

import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { ATTENDANCE_STRINGS } from '../constants';
import { formatDurationCompact } from '../lib/format-duration';
import type { AttendanceRecord } from '../types';

export interface DayGroup {
  attendanceDate: string;
  sessions: AttendanceRecord[];
  totalDurationSeconds: number;
  hasOpenSession: boolean;
}

export function AttendanceDayRow({ group }: Readonly<{ group: DayGroup }>) {
  const date = new Date(group.attendanceDate);
  // Sessions arrive sorted by checkInAt ASC, so first session = day start,
  // last session = day end. Latest checkOut is on the last session (or null
  // if it is still open).
  const firstCheckIn = group.sessions[0];
  const lastSession = group.sessions.at(-1);
  const startLabel = firstCheckIn ? format(new Date(firstCheckIn.checkInAt), 'h:mm a') : '—';
  const endLabel = lastSession?.checkOutAt
    ? format(new Date(lastSession.checkOutAt), 'h:mm a')
    : '—';

  return (
    <View className="flex-row items-center gap-4 border-b border-border px-4 py-3">
      <View className="w-12">
        <Text className="text-2xl font-semibold">{format(date, 'd')}</Text>
        <Text variant="muted" className="text-xs uppercase">
          {format(date, 'EEE')}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-medium">
          {startLabel} → {endLabel}
        </Text>
        <Text variant="muted" className="text-xs">
          {formatDurationCompact(group.totalDurationSeconds)} • {format(date, 'MMM yyyy')}
        </Text>
      </View>

      {group.hasOpenSession ? (
        <Badge variant="warningSoft">
          <Text>{ATTENDANCE_STRINGS.open}</Text>
        </Badge>
      ) : null}
    </View>
  );
}
