import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { ATTENDANCE_STRINGS } from '../constants';
import type { DateRange } from './AttendanceRangeChips';

const SNAP_POINTS = ['55%'] as const;
const MAX_RANGE_DAYS = 365;

export interface AttendanceRangeSheetHandle {
  open: (current: DateRange | null) => void;
  close: () => void;
}

interface Props {
  onApply: (range: DateRange) => void;
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function clampRangeDays(from: Date, to: Date): boolean {
  const diff = (to.getTime() - from.getTime()) / 86_400_000;
  return diff >= 0 && diff <= MAX_RANGE_DAYS;
}

export const AttendanceRangeSheet = forwardRef<AttendanceRangeSheetHandle, Props>(
  function AttendanceRangeSheet({ onApply }, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const card = useThemeColor('--card');
    const muted = useThemeColor('--muted-foreground');

    const [fromDate, setFromDate] = useState<Date>(new Date());
    const [toDate, setToDate] = useState<Date>(new Date());
    const [showFromPicker, setShowFromPicker] = useState(Platform.OS === 'ios');
    const [showToPicker, setShowToPicker] = useState(Platform.OS === 'ios');
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open: (current) => {
          if (current) {
            setFromDate(new Date(current.dateFrom));
            setToDate(new Date(current.dateTo));
          } else {
            const now = new Date();
            setFromDate(now);
            setToDate(now);
          }
          setError(null);
          setShowFromPicker(Platform.OS === 'ios');
          setShowToPicker(Platform.OS === 'ios');
          sheetRef.current?.snapToIndex(0);
        },
        close: () => sheetRef.current?.close(),
      }),
      [],
    );

    const onFromChange = (_e: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowFromPicker(false);
      if (date) setFromDate(date);
    };
    const onToChange = (_e: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowToPicker(false);
      if (date) setToDate(date);
    };

    const apply = (): void => {
      if (!clampRangeDays(fromDate, toDate)) {
        setError('Range must be between 0 and 365 days, with "From" before "To".');
        return;
      }
      onApply({ dateFrom: toIso(fromDate), dateTo: toIso(toDate) });
      sheetRef.current?.close();
    };

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={SNAP_POINTS as unknown as (string | number)[]}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: card }}
        handleIndicatorStyle={{ backgroundColor: muted }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          <Text variant="subheading" className="mb-4">
            {ATTENDANCE_STRINGS.customRange}
          </Text>

          <View className="mb-4">
            <Text variant="muted" className="mb-2 text-sm">
              {ATTENDANCE_STRINGS.from}
            </Text>
            {Platform.OS === 'android' ? (
              <Pressable
                onPress={() => setShowFromPicker(true)}
                className="rounded-md border border-border bg-card px-3 py-3"
              >
                <Text>{format(fromDate, 'PPP')}</Text>
              </Pressable>
            ) : null}
            {showFromPicker ? (
              <DateTimePicker
                value={fromDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onFromChange}
                maximumDate={new Date()}
              />
            ) : null}
          </View>

          <View className="mb-4">
            <Text variant="muted" className="mb-2 text-sm">
              {ATTENDANCE_STRINGS.to}
            </Text>
            {Platform.OS === 'android' ? (
              <Pressable
                onPress={() => setShowToPicker(true)}
                className="rounded-md border border-border bg-card px-3 py-3"
              >
                <Text>{format(toDate, 'PPP')}</Text>
              </Pressable>
            ) : null}
            {showToPicker ? (
              <DateTimePicker
                value={toDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onToChange}
                maximumDate={new Date()}
              />
            ) : null}
          </View>

          {error ? <Text className="mb-3 text-sm text-destructive">{error}</Text> : null}

          <View className="mt-2 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={() => sheetRef.current?.close()}>
              <Text>{ATTENDANCE_STRINGS.cancel}</Text>
            </Button>
            <Button variant="default" className="flex-1" onPress={apply}>
              <Text>{ATTENDANCE_STRINGS.apply}</Text>
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
