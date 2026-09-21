/**
 * ActivityFiltersSheet — bottom sheet for the Activity Log filters.
 *
 * Matches web `ActivityTimelineSection` filter dialog: multi-select activity
 * type (checkboxes) + a From/To date range. Rendered as a bottom-anchored
 * Modal so it reads as a true sheet over the timeline. Reset + Apply footer.
 */

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { format } from 'date-fns';

import { Button } from '@/components/atoms/Button';
import { Checkbox } from '@/components/atoms/Checkbox';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Text } from '@/components/atoms/Text';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';

import type { LeadActionType } from '../../models/lead-activity';

import { ACTIVITY_LABEL_MAP, FILTERABLE_ACTIVITY_TYPES } from './activity-icons';

export interface ActivityFilterDraft {
  actions: LeadActionType[];
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
}

export const EMPTY_ACTIVITY_FILTER: ActivityFilterDraft = { actions: [] };

/** Active-filter count for the search-row badge. */
export function activityFilterCount(f: ActivityFilterDraft): number {
  return f.actions.length + (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0);
}

function parseYmd(s?: string): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

interface CheckRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function CheckRow({ label, checked, onToggle }: Readonly<CheckRowProps>) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-3 rounded-xl px-1 py-2.5 active:opacity-70"
    >
      <View pointerEvents="none">
        <Checkbox checked={checked} onCheckedChange={() => {}} />
      </View>
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

export interface ActivityFiltersSheetProps {
  visible: boolean;
  initial: ActivityFilterDraft;
  onClose: () => void;
  onApply: (next: ActivityFilterDraft) => void;
}

export function ActivityFiltersSheet({
  visible,
  initial,
  onClose,
  onApply,
}: Readonly<ActivityFiltersSheetProps>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<ActivityFilterDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const toggleAction = (action: LeadActionType) =>
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.includes(action)
        ? prev.actions.filter((a) => a !== action)
        : [...prev.actions, action],
    }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl bg-background"
          style={[palette, { paddingBottom: 12 + insets.bottom }]}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between px-5 pb-1 pt-3">
            <Text className="text-base font-semibold text-foreground">Filter Activities</Text>
            <Pressable onPress={() => setDraft(EMPTY_ACTIVITY_FILTER)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand">Clear</Text>
            </Pressable>
          </View>

          <ScrollView
            className="max-h-[60vh]"
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}
            showsVerticalScrollIndicator
          >
            <Text className="mb-1 text-sm font-semibold text-muted-foreground">Activity Type</Text>
            {FILTERABLE_ACTIVITY_TYPES.map((action) => (
              <CheckRow
                key={action}
                label={ACTIVITY_LABEL_MAP[action]}
                checked={draft.actions.includes(action)}
                onToggle={() => toggleAction(action)}
              />
            ))}

            <Text className="mb-2 mt-5 text-sm font-semibold text-muted-foreground">
              Date Range
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <DatePicker
                  value={parseYmd(draft.dateFrom)}
                  maximumDate={parseYmd(draft.dateTo) ?? undefined}
                  onChange={(d) =>
                    setDraft((prev) => ({ ...prev, dateFrom: format(d, 'yyyy-MM-dd') }))
                  }
                  placeholder="Start date"
                />
              </View>
              <Text className="text-sm text-muted-foreground">to</Text>
              <View className="flex-1">
                <DatePicker
                  value={parseYmd(draft.dateTo)}
                  minimumDate={parseYmd(draft.dateFrom) ?? undefined}
                  onChange={(d) =>
                    setDraft((prev) => ({ ...prev, dateTo: format(d, 'yyyy-MM-dd') }))
                  }
                  placeholder="End date"
                />
              </View>
            </View>
          </ScrollView>

          <View className="border-t border-border px-5 pt-3">
            <Button
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            >
              <Text>Apply Filters</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
