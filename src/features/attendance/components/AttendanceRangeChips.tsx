import { Pressable, ScrollView } from 'react-native';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { ATTENDANCE_STRINGS } from '../constants';

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export type RangePreset = 'this_month' | 'last_month' | 'last_7_days' | 'custom';

interface Props {
  active: RangePreset;
  onSelect: (preset: RangePreset, range: DateRange | null) => void;
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function buildPresetRange(preset: Exclude<RangePreset, 'custom'>): DateRange {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { dateFrom: toIso(startOfMonth(now)), dateTo: toIso(endOfMonth(now)) };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { dateFrom: toIso(startOfMonth(lm)), dateTo: toIso(endOfMonth(lm)) };
    }
    case 'last_7_days':
      return { dateFrom: toIso(subDays(now, 6)), dateTo: toIso(now) };
  }
}

const CHIPS: { preset: RangePreset; label: string }[] = [
  { preset: 'this_month', label: ATTENDANCE_STRINGS.thisMonth },
  { preset: 'last_month', label: ATTENDANCE_STRINGS.lastMonth },
  { preset: 'last_7_days', label: ATTENDANCE_STRINGS.last7Days },
  { preset: 'custom', label: ATTENDANCE_STRINGS.customRange },
];

export function AttendanceRangeChips({ active, onSelect }: Readonly<Props>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      style={{ flexGrow: 0, flexShrink: 0 }}
      className="py-2"
    >
      {CHIPS.map((c) => {
        const isActive = c.preset === active;
        return (
          <Pressable
            key={c.preset}
            onPress={() => {
              if (c.preset === 'custom') onSelect('custom', null);
              else onSelect(c.preset, buildPresetRange(c.preset));
            }}
            className={cn(
              'rounded-full border px-4 py-1.5',
              isActive ? 'border-primary bg-primary' : 'border-border bg-card',
            )}
          >
            <Text className={cn('text-sm font-medium', isActive ? 'text-primary-foreground' : '')}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
