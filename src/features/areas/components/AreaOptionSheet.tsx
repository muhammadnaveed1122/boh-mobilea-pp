import * as React from 'react';
import { Pressable } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export interface AreaOption {
  readonly value: string;
  readonly label: string;
}

export interface AreaOptionSheetProps {
  readonly title: string;
  readonly options: AreaOption[];
  readonly selectedValue: string;
  readonly onSelect: (value: string) => void;
  readonly sheetRef: React.RefObject<BottomSheetModal | null>;
}

/** Single-select bottom sheet for the City / Property-type filters. */
export function AreaOptionSheet({
  title,
  options,
  selectedValue,
  onSelect,
  sheetRef,
}: AreaOptionSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');

  const renderBackdrop = React.useCallback(
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

  const handleSelect = React.useCallback(
    (value: string) => {
      sheetRef.current?.dismiss();
      onSelect(value);
    },
    [onSelect, sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
      >
        <Text className="pb-2 pt-1 text-center text-base font-semibold text-popover-foreground">
          {title}
        </Text>
        {options.map((opt) => {
          const isSelected = opt.value === selectedValue;
          return (
            <Pressable
              key={opt.value || '__all__'}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelect(opt.value)}
              className={cn(
                'min-h-12 flex-row items-center justify-between rounded-xl px-3 py-2.5 active:bg-muted',
                isSelected && 'bg-brand/10',
              )}
            >
              <Text className="text-base text-popover-foreground">{opt.label}</Text>
              {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
