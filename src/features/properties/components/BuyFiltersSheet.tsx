import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import {
  BATH_MULTI_OPTIONS,
  BEDS_MULTI_OPTIONS,
  PRICE_RANGE_OPTIONS,
  PROPERTY_TYPE_FILTER_OPTIONS,
  STATUS_OPTIONS,
  type FilterOption,
} from '@/features/new-projects/constants/filter-options';
import { useStates } from '@/features/new-projects/hooks/use-states';
import { cn } from '@/lib/utils';
import { tokens } from '@theme/tokens';
import type { BuyFilters, BuyStatus } from '../utils/filter-buy';

interface Props {
  visible: boolean;
  initialFilters: BuyFilters;
  onClose: () => void;
  onApply: (next: BuyFilters) => void;
}

const lightVars = vars(tokens.light);

function SingleSelect({
  options,
  value,
  onChange,
}: Readonly<{
  options: FilterOption[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = (value ?? 'all') === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value === 'all' ? undefined : opt.value)}
            className={cn(
              'rounded-full border px-3 py-1.5',
              active ? 'border-primary bg-primary' : 'border-border bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                active ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MultiSelect({
  options,
  values,
  onChange,
}: Readonly<{ options: FilterOption[]; values: string[]; onChange: (v: string[]) => void }>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = values.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() =>
              onChange(active ? values.filter((v) => v !== opt.value) : [...values, opt.value])
            }
            className={cn(
              'rounded-full border px-3 py-1.5',
              active ? 'border-primary bg-primary' : 'border-border bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                active ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

export function BuyFiltersSheet({ visible, initialFilters, onClose, onApply }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BuyFilters>(initialFilters);
  const { data: states = [] } = useStates();

  // City filter matches the card location text, so use the city name as the value.
  const cityOptions: FilterOption[] = [
    { value: 'all', label: 'All States' },
    ...states.map((s) => ({ value: s.city, label: s.city })),
  ];

  const reset = () => setDraft({ search: initialFilters.search, status: 'all' });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-background" style={[lightVars, { paddingTop: insets.top }]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="X" size={22} />
          </Pressable>
          <Text className="text-base font-semibold text-foreground">Filters</Text>
          <Pressable onPress={reset} hitSlop={8}>
            <Text className="text-sm font-medium text-primary">Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Availability">
            <SingleSelect
              options={STATUS_OPTIONS}
              value={draft.status ?? 'all'}
              onChange={(v) => setDraft({ ...draft, status: (v as BuyStatus) ?? 'all' })}
            />
          </Section>
          <Section title="Property Type">
            <SingleSelect
              options={PROPERTY_TYPE_FILTER_OPTIONS}
              value={draft.propertyType ?? 'all'}
              onChange={(v) => setDraft({ ...draft, propertyType: v })}
            />
          </Section>
          <Section title="Bedrooms">
            <MultiSelect
              options={BEDS_MULTI_OPTIONS}
              values={draft.beds ?? []}
              onChange={(v) => setDraft({ ...draft, beds: v })}
            />
          </Section>
          <Section title="Bathrooms">
            <MultiSelect
              options={BATH_MULTI_OPTIONS}
              values={draft.baths ?? []}
              onChange={(v) => setDraft({ ...draft, baths: v })}
            />
          </Section>
          <Section title="State">
            <SingleSelect
              options={cityOptions}
              value={draft.city ?? 'all'}
              onChange={(v) => setDraft({ ...draft, city: v })}
            />
          </Section>
          <Section title="Price">
            <SingleSelect
              options={PRICE_RANGE_OPTIONS}
              value={draft.priceRange ?? 'all'}
              onChange={(v) => setDraft({ ...draft, priceRange: v })}
            />
          </Section>
        </ScrollView>

        <View
          className="border-t border-border bg-background px-5 py-3"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <Button
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          >
            <Text>Apply Filters</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
