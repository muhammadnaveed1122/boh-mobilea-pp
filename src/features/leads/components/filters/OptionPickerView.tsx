/**
 * Drill-down option list rendered *inside* the filter sheet rather than as a
 * stacked modal — one surface, one dismiss, and the user never loses the
 * filters they already set.
 *
 * Handles both single- and multi-select, and filters locally on a search box
 * once the list is long enough to need one. A sticky Apply bar returns to the
 * sheet root; single-select also returns straight after the pick.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { toSelection, type FilterOption, type FilterValue } from './FilterControls';

/** Above this many options the list gets a search box. */
const SEARCHABLE_THRESHOLD = 8;

interface OptionPickerViewProps {
  title: string;
  options: readonly FilterOption[];
  /** Selected value(s) — string for single-select, array for multi. */
  value: FilterValue;
  multi?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  onChange: (next: FilterValue) => void;
  onBack: () => void;
}

export function OptionPickerView({
  title,
  options,
  value,
  multi = false,
  loading = false,
  emptyLabel = 'No options available.',
  onChange,
  onBack,
}: Readonly<OptionPickerViewProps>) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const muted = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');
  // `BottomSheetTextInput` takes a style, not a className.
  const foreground = useThemeColor('--foreground');

  const selected = toSelection(value);
  const searchable = options.length > SEARCHABLE_THRESHOLD;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, query]);

  const toggle = (option: string): void => {
    if (multi) {
      const next = selected.includes(option)
        ? selected.filter((v) => v !== option)
        : [...selected, option];
      onChange(next.length > 0 ? next : undefined);
      return;
    }
    // Single-select picks and closes — the extra "done" tap buys nothing.
    onChange(selected.includes(option) ? undefined : option);
    onBack();
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 border-b border-border px-4 pb-3">
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to filters"
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ChevronLeft" size={22} />
        </Pressable>
        <Text className="flex-1 text-base font-bold text-foreground">{title}</Text>
        {multi && selected.length > 0 ? (
          <Pressable
            onPress={() => onChange(undefined)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${title}`}
            className="min-h-11 justify-center px-1"
          >
            <Text className="text-sm font-semibold text-brand">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {searchable ? (
        <View className="px-4 pt-3">
          <View className="flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
            <Icon name="Search" size={16} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${title.toLowerCase()}…`}
              placeholderTextColor={muted}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={`Search ${title}`}
              style={{ flex: 1, height: 44, color: foreground }}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={10}
                accessibilityLabel="Clear search"
              >
                <Icon name="X" size={14} color={muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator color={brand} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item: FilterOption) => item.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-muted-foreground">
                {query.length > 0 ? 'No matches.' : emptyLabel}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: FilterOption }) => {
            const active = selected.includes(item.value);
            return (
              <Pressable
                onPress={() => toggle(item.value)}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={multi ? { checked: active } : { selected: active }}
                accessibilityLabel={item.label}
                style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                className="min-h-11 flex-row items-center justify-between border-b border-border/60 py-3"
              >
                <Text
                  className={`flex-1 pr-3 text-sm ${active ? 'font-semibold text-foreground' : 'text-foreground'}`}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {active ? <Icon name="Check" size={18} color={brand} /> : null}
              </Pressable>
            );
          }}
        />
      )}

      {/* Confirm bar: a multi-select has no natural end, so the back chevron
          alone left users guessing whether their picks had registered. */}
      <View
        className="border-t border-border bg-background px-5 pt-3"
        style={{ paddingBottom: 12 + insets.bottom }}
      >
        <Button onPress={onBack} accessibilityLabel={`Apply ${title}`}>
          <Text>{selected.length > 0 ? `Apply (${selected.length})` : 'Apply'}</Text>
        </Button>
      </View>
    </View>
  );
}
