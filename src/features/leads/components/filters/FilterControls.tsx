/**
 * Shared building blocks for the leads filter sheet.
 *
 * Two control shapes, picked by option count: a wrap-around chip group for
 * short enumerations you want to see at a glance, and a drill-down row for
 * long or fetched lists (agents, communities, nationalities) that would bury
 * the rest of the sheet if inlined.
 *
 * Every target is >= 44pt tall and selection is announced through
 * `accessibilityState`, not colour alone.
 */

import { Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

export interface FilterOption {
  value: string;
  label: string;
}

/** What a control holds: one value (single-select), many (multi), or nothing. */
export type FilterValue = string | string[] | undefined;

/** Normalise either shape to the array the selection checks work against. */
export function toSelection(value: FilterValue): string[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === '' ? [] : [value];
}

export function FilterSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-6">
      <Text className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

interface FilterChipGroupProps {
  options: readonly FilterOption[];
  /** Selected value(s). A string for single-select, an array for multi. */
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  multi?: boolean;
}

/**
 * Toggle chips. Tapping the active chip clears it, so every filter is
 * switchable off without hunting for a "Any"/"All" option.
 */
export function FilterChipGroup({
  options,
  value,
  onChange,
  multi = false,
}: Readonly<FilterChipGroupProps>) {
  const selected = toSelection(value);

  const toggle = (option: string): void => {
    if (multi) {
      const next = selected.includes(option)
        ? selected.filter((v) => v !== option)
        : [...selected, option];
      onChange(next.length > 0 ? next : undefined);
      return;
    }
    onChange(selected.includes(option) ? undefined : option);
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => toggle(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
            className={cn(
              'min-h-11 justify-center rounded-full border px-4',
              active ? 'border-brand bg-brand' : 'border-border bg-card',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-foreground',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface FilterToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** Boolean filter as a full-width pressable row with a check affordance. */
export function FilterToggleRow({
  label,
  description,
  value,
  onChange,
}: Readonly<FilterToggleRowProps>) {
  const brandFg = useThemeColor('--brand-foreground');
  const border = useThemeColor('--border');

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
      className="min-h-11 flex-row items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5"
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-md border',
          value ? 'border-brand bg-brand' : 'bg-transparent',
        )}
        style={value ? undefined : { borderColor: border }}
      >
        {value ? <Icon name="Check" size={14} color={brandFg} /> : null}
      </View>
    </Pressable>
  );
}

interface FilterPickerRowProps {
  label: string;
  /** Human-readable summary of what's picked, or undefined when nothing is. */
  summary?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shown instead of the chevron while the option list is still loading. */
  loading?: boolean;
  onPress: () => void;
}

function rowOpacity(disabled: boolean, pressed: boolean): number {
  if (disabled) return 0.45;
  return pressed ? 0.75 : 1;
}

/** Row that drills into a searchable option list inside the same sheet. */
export function FilterPickerRow({
  label,
  summary,
  placeholder = 'Any',
  disabled = false,
  loading = false,
  onPress,
}: Readonly<FilterPickerRowProps>) {
  const muted = useThemeColor('--muted-foreground');
  const hasValue = Boolean(summary);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`${label}. ${summary ?? placeholder}`}
      style={({ pressed }) => ({ opacity: rowOpacity(disabled, pressed) })}
      className="min-h-11 flex-row items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5"
    >
      <Text className="mr-3 text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-1 flex-row items-center justify-end gap-1.5">
        <Text
          className={cn('text-sm', hasValue ? 'font-semibold text-brand' : 'text-muted-foreground')}
          numberOfLines={1}
        >
          {summary ?? placeholder}
        </Text>
        {loading ? null : <Icon name="ChevronRight" size={16} color={muted} />}
      </View>
    </Pressable>
  );
}
