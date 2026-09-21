import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { useThemeColor } from '@theme';
import { tokens } from '@theme/tokens';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useAreaStates } from '@/features/areas/hooks/use-area-states';
import { cn } from '@/lib/utils';

import { useDevelopers } from '../hooks/use-developers';
import type { ProjectListFilters } from '../services';

interface Option {
  readonly value: string;
  readonly label: string;
}

const ALL = 'all';

const STATUS_OPTIONS: Option[] = [
  { value: ALL, label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Option[] = [
  { value: ALL, label: 'All' },
  { value: 'off_plan', label: 'Off Plan' },
  { value: 'ready', label: 'Ready' },
  { value: 'sold_out', label: 'Sold Out' },
];

const lightVars = vars(tokens.light);

/** Counts the active filters (search excluded — it has its own input). */
function countActive(f: ProjectListFilters): number {
  return [f.status, f.availability, f.stateId, f.developerId].filter(Boolean).length;
}

function SingleSelect({
  options,
  value,
  onChange,
}: Readonly<{
  options: Option[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = (value ?? ALL) === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value === ALL ? undefined : opt.value)}
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

function FiltersSheet({
  visible,
  initialFilters,
  onClose,
  onApply,
}: Readonly<{
  visible: boolean;
  initialFilters: ProjectListFilters;
  onClose: () => void;
  onApply: (next: ProjectListFilters) => void;
}>) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState<ProjectListFilters>(initialFilters);

  // Re-seed the draft each time the sheet opens so it reflects applied filters.
  React.useEffect(() => {
    if (visible) setDraft(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { data: states = [] } = useAreaStates();
  const { data: developers = [] } = useDevelopers();

  const stateOptions: Option[] = [
    { value: ALL, label: 'All' },
    ...states.map((s) => ({ value: s.id, label: s.name })),
  ];
  const developerOptions: Option[] = [
    { value: ALL, label: 'All' },
    ...developers.map((d) => ({ value: d.value, label: d.label })),
  ];

  const reset = () => setDraft({ search: initialFilters.search });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-background" style={[lightVars, { paddingTop: insets.top }]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close filters">
            <Icon name="X" size={22} />
          </Pressable>
          <Text className="text-base font-semibold text-foreground">Filters</Text>
          <Pressable onPress={reset} hitSlop={8} accessibilityLabel="Reset filters">
            <Text className="text-sm font-medium text-primary">Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Status">
            <SingleSelect
              options={STATUS_OPTIONS}
              value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v })}
            />
          </Section>
          <Section title="Type">
            <SingleSelect
              options={TYPE_OPTIONS}
              value={draft.availability}
              onChange={(v) => setDraft({ ...draft, availability: v })}
            />
          </Section>
          <Section title="State">
            <SingleSelect
              options={stateOptions}
              value={draft.stateId}
              onChange={(v) => setDraft({ ...draft, stateId: v })}
            />
          </Section>
          <Section title="Developer">
            <SingleSelect
              options={developerOptions}
              value={draft.developerId}
              onChange={(v) => setDraft({ ...draft, developerId: v })}
            />
          </Section>
        </ScrollView>

        <View
          className="border-t border-border bg-background px-5 py-3"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <Button
            onPress={() => {
              onApply({ ...draft, search: initialFilters.search });
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

/**
 * Project-list search + filters. A rounded search bar (debounced) with a
 * circular filter button (badge = active filter count); tapping the button
 * opens a full-screen sheet holding Status / Type / State / Developer. Read-only.
 */
export function ProjectFilters({
  filters,
  onChange,
}: Readonly<{ filters: ProjectListFilters; onChange: (next: ProjectListFilters) => void }>) {
  const [searchText, setSearchText] = React.useState(filters.search ?? '');
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const mutedFg = useThemeColor('--muted-foreground');
  const brandFg = useThemeColor('--brand-foreground');

  React.useEffect(() => {
    const id = setTimeout(() => {
      onChange({ ...filters, search: searchText.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const filterCount = countActive(filters);

  return (
    <View>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
          <Icon name="Search" size={16} color={mutedFg} />
          <Input
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search listings by name…"
            className="h-11 flex-1 border-0 bg-transparent px-0 text-sm"
            returnKeyType="search"
          />
          {searchText.length > 0 ? (
            <Pressable
              onPress={() => setSearchText('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Icon name="X" size={14} color={mutedFg} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          className="relative h-11 w-11 items-center justify-center rounded-full bg-brand active:opacity-80"
          accessibilityLabel="Filters"
        >
          <Icon name="SlidersHorizontal" size={16} color={brandFg} />
          {filterCount > 0 ? (
            <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
              <Text className="text-[10px] font-bold text-white">{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FiltersSheet
        visible={sheetOpen}
        initialFilters={filters}
        onClose={() => setSheetOpen(false)}
        onApply={onChange}
      />
    </View>
  );
}
