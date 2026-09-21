/**
 * PrioritySelector — tap a priority pill to change a lead's priority via a
 * bottom sheet. Mirrors web's `PriorityDropdown`: selecting an option fires
 * the PATCH immediately (no note, no confirm step).
 *
 * Self-contained: owns its `useUpdateLead` mutation so it can drop straight
 * onto a lead card or into the detail edit view.
 */

import * as React from 'react';
import { Alert, Keyboard, Platform, Pressable } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown } from 'lucide-react-native';
import { useThemeColor } from '@theme';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useUpdateLead } from '../../hooks/use-update-lead';
import {
  type BadgeTone,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_FILTERS,
  PRIORITY_LABEL,
  type LeadPriority,
} from '../../types';

function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function selectionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

export interface PrioritySelectorProps {
  readonly leadId: string;
  readonly value: string | null | undefined;
  readonly disabled?: boolean;
}

export function PrioritySelector({ leadId, value, disabled = false }: PrioritySelectorProps) {
  const modalRef = React.useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);

  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');
  const toneColors: Record<BadgeTone, string> = {
    successSoft: useThemeColor('--success'),
    infoSoft: useThemeColor('--info'),
    warningSoft: useThemeColor('--warning'),
    destructiveSoft: useThemeColor('--destructive'),
    mutedSoft: useThemeColor('--muted-foreground'),
  };

  const { mutate } = useUpdateLead(leadId);

  const present = React.useCallback(() => {
    if (disabled) return;
    Keyboard.dismiss();
    lightHaptic();
    modalRef.current?.present();
  }, [disabled]);

  const onSelect = React.useCallback(
    (next: LeadPriority) => {
      selectionHaptic();
      modalRef.current?.dismiss();
      if (next === value) return;
      mutate(
        { priority: next },
        {
          onError: () =>
            Alert.alert('Update failed', 'Could not change the lead priority. Please try again.'),
        },
      );
    },
    [mutate, value],
  );

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

  const current = value ? (value as LeadPriority) : null;
  const currentTone: BadgeTone | null = current ? PRIORITY_BADGE_VARIANT[current] : null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change lead priority"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={present}
        hitSlop={6}
        className={cn('active:opacity-70', disabled && 'opacity-50')}
      >
        <Badge variant={currentTone ?? 'mutedSoft'} className="gap-1">
          <Text>{current && currentTone ? PRIORITY_LABEL[current] : 'Set priority'}</Text>
          {disabled ? null : (
            <ChevronDown size={13} color={toneColors[currentTone ?? 'mutedSoft']} />
          )}
        </Badge>
      </Pressable>

      <BottomSheetModal
        ref={modalRef}
        enablePanDownToClose
        enableDynamicSizing
        onChange={(index) => setOpen(index >= 0)}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: sheetBg }}
        handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
          <Text className="pb-2 pt-1 text-center text-base font-semibold text-popover-foreground">
            Set Priority
          </Text>

          {PRIORITY_FILTERS.map((priority) => {
            const isSelected = current === priority;
            return (
              <Pressable
                key={priority}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(priority)}
                className={cn(
                  'min-h-12 flex-row items-center justify-between rounded-xl px-3 py-2.5 active:bg-muted',
                  isSelected && 'bg-brand/10',
                )}
              >
                <Badge variant={PRIORITY_BADGE_VARIANT[priority]}>
                  <Text>{PRIORITY_LABEL[priority]}</Text>
                </Badge>
                {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
