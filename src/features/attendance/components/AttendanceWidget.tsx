import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Card, type CardProps } from '@/components/molecules/Card';
import { useAuthStore } from '@/store/auth.store';
import { useThemeColor } from '@theme';
import { ATTENDANCE_STRINGS } from '../constants';
import { useCheckIn } from '../hooks/use-check-in';
import { useCheckOut } from '../hooks/use-check-out';
import { useTodayAttendance } from '../hooks/use-today-attendance';
import { formatDurationCompact } from '../lib/format-duration';
import type { TodayAttendanceResponse } from '../types';
import { AttendanceWidgetSkeleton } from './AttendanceWidgetSkeleton';
import { ElapsedTimer } from './ElapsedTimer';

type WidgetState = 'no_sessions' | 'open' | 'between';

function getState(today: TodayAttendanceResponse): WidgetState {
  if (today.openSession !== null) return 'open';
  if (today.sessions.length > 0) return 'between';
  return 'no_sessions';
}

const VARIANT_BY_STATE: Record<WidgetState, NonNullable<CardProps['variant']>> = {
  no_sessions: 'default',
  open: 'successSoft',
  between: 'mutedSoft',
};

interface SummaryProps {
  today: TodayAttendanceResponse;
  state: WidgetState;
  closedTotalSeconds: number;
}

function WidgetSummary({ today, state, closedTotalSeconds }: Readonly<SummaryProps>) {
  let label: string = ATTENDANCE_STRINGS.attendance;
  let value: React.ReactNode = ATTENDANCE_STRINGS.ready;
  if (state === 'open' && today.openSession) {
    const adjustedStart = new Date(
      new Date(today.openSession.checkInAt).getTime() - closedTotalSeconds * 1000,
    );
    label = `${ATTENDANCE_STRINGS.attendance} · ${ATTENDANCE_STRINGS.open}`;
    value = <ElapsedTimer startAt={adjustedStart} className="text-base font-medium" />;
  } else if (state === 'between') {
    const lastEnd = today.sessions.at(-1)?.checkOutAt;
    label = `${ATTENDANCE_STRINGS.attendance} · ${formatDurationCompact(today.totalDurationSeconds)} today`;
    value = lastEnd ? `Out at ${format(new Date(lastEnd), 'h:mm a')}` : 'Between sessions';
  }
  return (
    <View className="flex-1">
      <Text className="text-xs" variant="muted" numberOfLines={1}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text className="text-base font-medium" numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export function AttendanceWidget() {
  const userType = useAuthStore((s) => s.user?.userType);
  const isAgent = userType === 'agent';
  const query = useTodayAttendance();
  const checkInMut = useCheckIn();
  const checkOutMut = useCheckOut();
  const successColor = useThemeColor('--success');
  const destructiveColor = useThemeColor('--destructive');

  const openDetail = useCallback(() => {
    router.push('/attendance');
  }, []);

  if (!isAgent) return null;
  if (query.isLoading) return <AttendanceWidgetSkeleton />;

  if (query.isError || !query.data) {
    return (
      <Card variant="destructiveSoft">
        <View className="flex-row items-center gap-2 p-3">
          <Icon name="TriangleAlert" size={18} />
          <Text className="flex-1 text-sm">{ATTENDANCE_STRINGS.failedToLoad}</Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              query.refetch().catch(() => {});
            }}
          >
            <Text>{ATTENDANCE_STRINGS.retry}</Text>
          </Button>
        </View>
      </Card>
    );
  }

  const today = query.data;
  const state = getState(today);
  const variant = VARIANT_BY_STATE[state];
  const closedTotalSeconds = today.sessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

  const handleCheckIn = (): void => {
    checkInMut.mutate();
  };
  const handleCheckOut = (): void => {
    checkOutMut.mutate();
  };

  const isOpen = state === 'open';
  let actionLabel: string = ATTENDANCE_STRINGS.checkIn;
  if (isOpen) actionLabel = ATTENDANCE_STRINGS.checkOut;
  else if (state === 'between') actionLabel = ATTENDANCE_STRINGS.checkInAgain;
  const actionTone = isOpen ? 'text-destructive' : 'text-success';
  const actionBg = isOpen
    ? 'bg-destructive/15 border border-destructive/30'
    : 'bg-success/15 border border-success/30';
  const actionIconColor = isOpen ? destructiveColor : successColor;
  const actionIcon = isOpen ? 'LogOut' : 'LogIn';

  return (
    <Pressable onPress={openDetail} accessibilityRole="button" accessibilityLabel="Open attendance">
      <Card variant={variant}>
        <View className="flex-row items-center gap-3 p-3">
          <WidgetSummary today={today} state={state} closedTotalSeconds={closedTotalSeconds} />
          <Button
            variant="ghost"
            size="sm"
            className={actionBg}
            loading={isOpen ? checkOutMut.isPending : checkInMut.isPending}
            onPress={isOpen ? handleCheckOut : handleCheckIn}
          >
            <Icon name={actionIcon} size={16} color={actionIconColor} />
            <Text className={actionTone}>{actionLabel}</Text>
          </Button>
        </View>
      </Card>
    </Pressable>
  );
}
