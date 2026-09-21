import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays } from 'lucide-react-native';
import { format } from 'date-fns';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor } from '@theme';

export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  hasError?: boolean;
  /** date-fns format string for the trigger label. */
  displayFormat?: string;
  /** Sheet header title (iOS). Defaults to the placeholder. */
  title?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  disabled,
  hasError,
  displayFormat = 'PPP',
  title,
}: Readonly<DatePickerProps>) {
  const { colorScheme } = useTheme();
  const muted = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const brand = useThemeColor('--brand');
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const insets = useSafeAreaInsets();

  const sheetRef = useRef<BottomSheetModal>(null);
  // iOS-only working copy — commit on Done, discard on Cancel.
  const [draft, setDraft] = useState<Date>(value ?? maximumDate ?? new Date());

  const fallback = useCallback(() => maximumDate ?? new Date(), [maximumDate]);

  const openAndroid = useCallback(() => {
    DateTimePickerAndroid.open({
      value: value ?? fallback(),
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (_e: DateTimePickerEvent, date?: Date) => {
        // Android fires with type 'set' (confirmed) or 'dismissed' (cancelled).
        if (_e.type === 'set' && date) onChange(date);
      },
    });
  }, [value, fallback, minimumDate, maximumDate, onChange]);

  const openPicker = useCallback(() => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }
    setDraft(value ?? fallback());
    sheetRef.current?.present();
  }, [openAndroid, value, fallback]);

  // Keep the draft in sync if the value changes while the sheet is closed.
  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  const handleDraftChange = useCallback((_e: DateTimePickerEvent, date?: Date) => {
    if (date) setDraft(date);
  }, []);

  const handleCancel = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleDone = useCallback(() => {
    onChange(draft);
    sheetRef.current?.dismiss();
  }, [draft, onChange]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  return (
    <View>
      <Pressable
        disabled={disabled}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={title ?? placeholder}
        accessibilityValue={{ text: value ? format(value, displayFormat) : 'No date selected' }}
        className={cn(
          'h-11 flex-row items-center justify-between rounded-lg border bg-background px-3',
          'active:opacity-70',
          hasError ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50',
        )}
      >
        <Text className={value ? 'text-foreground' : 'text-muted-foreground'} numberOfLines={1}>
          {value ? format(value, displayFormat) : placeholder}
        </Text>
        <CalendarDays size={18} color={value ? foreground : muted} strokeWidth={1.8} />
      </Pressable>

      {Platform.OS === 'ios' ? (
        <BottomSheetModal
          ref={sheetRef}
          enablePanDownToClose
          enableDynamicSizing
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: sheetBg }}
          handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
        >
          <BottomSheetView style={{ paddingBottom: insets.bottom + 12 }}>
            {/* Header: Cancel (ghost) · Title · Done (brand) — each ≥44pt tap area. */}
            <View className="flex-row items-center justify-between border-b border-border px-2 pb-2">
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                className="min-h-11 justify-center rounded-lg px-3 active:opacity-60"
              >
                <Text className="text-base text-muted-foreground">Cancel</Text>
              </Pressable>

              <Text className="text-base font-semibold text-popover-foreground" numberOfLines={1}>
                {title ?? placeholder}
              </Text>

              <Pressable
                onPress={handleDone}
                accessibilityRole="button"
                accessibilityLabel="Confirm date"
                className="min-h-11 justify-center rounded-lg bg-brand px-4 active:opacity-80"
              >
                <Text className="text-base font-semibold text-brand-foreground">Done</Text>
              </Pressable>
            </View>

            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              onChange={handleDraftChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              accentColor={brand}
              themeVariant={colorScheme}
              style={{ alignSelf: 'center' }}
            />
          </BottomSheetView>
        </BottomSheetModal>
      ) : null}
    </View>
  );
}
