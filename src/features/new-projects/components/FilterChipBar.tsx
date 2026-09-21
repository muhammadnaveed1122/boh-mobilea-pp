import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import {
  BEDS_MULTI_OPTIONS,
  BATH_MULTI_OPTIONS,
  HANDOVER_OPTIONS,
  PRICE_RANGE_OPTIONS,
  getPropertyTypeLabel,
} from '../constants/filter-options';
import type { PublicProjectsFilters, StateOption } from '../types';

interface Chip {
  key: keyof PublicProjectsFilters;
  label: string;
  onRemove: () => void;
  subKey?: string;
}

interface Props {
  filters: PublicProjectsFilters;
  states: StateOption[];
  onChange: (next: PublicProjectsFilters) => void;
}

function findLabel(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function FilterChipBar({ filters, states, onChange }: Readonly<Props>) {
  const fg = useThemeColor('--foreground');
  const chips: Chip[] = [];

  if (filters.status && filters.status !== 'all') {
    chips.push({
      key: 'status',
      label: filters.status === 'Off-Plan' ? 'Off-Plan' : filters.status,
      onRemove: () => onChange({ ...filters, status: 'all' }),
    });
  }
  if (filters.propertyType && filters.propertyType !== 'all') {
    chips.push({
      key: 'propertyType',
      label: getPropertyTypeLabel(filters.propertyType),
      onRemove: () => onChange({ ...filters, propertyType: undefined }),
    });
  }
  for (const b of filters.beds ?? []) {
    chips.push({
      key: 'beds',
      subKey: b,
      label: findLabel(BEDS_MULTI_OPTIONS, b),
      onRemove: () => onChange({ ...filters, beds: (filters.beds ?? []).filter((x) => x !== b) }),
    });
  }
  for (const b of filters.baths ?? []) {
    chips.push({
      key: 'baths',
      subKey: b,
      label: `${findLabel(BATH_MULTI_OPTIONS, b)} Bath`,
      onRemove: () => onChange({ ...filters, baths: (filters.baths ?? []).filter((x) => x !== b) }),
    });
  }
  if (filters.city && filters.city !== 'all') {
    const city = states.find((s) => s.id === filters.city);
    chips.push({
      key: 'city',
      label: city?.city ?? 'City',
      onRemove: () => onChange({ ...filters, city: undefined }),
    });
  }
  if (filters.priceRange && filters.priceRange !== 'all') {
    chips.push({
      key: 'priceRange',
      label: findLabel(PRICE_RANGE_OPTIONS, filters.priceRange),
      onRemove: () => onChange({ ...filters, priceRange: undefined }),
    });
  }
  if (filters.handover && filters.handover !== 'all') {
    chips.push({
      key: 'handover',
      label: findLabel(HANDOVER_OPTIONS, filters.handover),
      onRemove: () => onChange({ ...filters, handover: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="mt-3"
    >
      {chips.map((chip, idx) => (
        <View
          key={`${chip.key}-${chip.subKey ?? idx}`}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5"
        >
          <Text className="text-xs font-medium text-foreground">{chip.label}</Text>
          <Pressable onPress={chip.onRemove} hitSlop={8}>
            <Icon name="X" size={12} color={fg} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
