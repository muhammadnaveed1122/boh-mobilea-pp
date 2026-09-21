import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronDown, X } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import type { AreasFilters } from '../hooks/use-neighbourhoods-infinite';
import { useAreaPropertyTypes } from '../hooks/use-area-property-types';
import { useAreaStates } from '../hooks/use-area-states';
import { AreaOptionSheet, type AreaOption } from './AreaOptionSheet';

const ALL_OPTION: AreaOption = { value: '', label: 'All' };

function FilterTrigger({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const iconColor = useThemeColor('--muted-foreground');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'h-11 flex-1 flex-row items-center justify-between rounded-lg border border-input bg-background px-3 active:opacity-70',
        active && 'border-brand',
      )}
    >
      <Text
        numberOfLines={1}
        className={cn('text-base', active ? 'text-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
      <ChevronDown size={16} color={iconColor} />
    </Pressable>
  );
}

/**
 * Areas toolbar: debounced text search, City selector, Property-type selector,
 * and a reset button shown when any filter is active. Mirrors the web toolbar.
 */
export function AreaFilters({
  filters,
  onChange,
}: {
  filters: AreasFilters;
  onChange: (next: AreasFilters) => void;
}) {
  const cityRef = React.useRef<BottomSheetModal>(null);
  const typeRef = React.useRef<BottomSheetModal>(null);
  const [searchText, setSearchText] = React.useState(filters.search ?? '');

  const brand = useThemeColor('--brand');

  const { data: states = [] } = useAreaStates();
  const { data: propertyTypes = [] } = useAreaPropertyTypes();

  // Debounce search → filters so each keystroke doesn't refetch.
  React.useEffect(() => {
    const id = setTimeout(() => {
      onChange({ ...filters, search: searchText.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const cityOptions: AreaOption[] = [
    ALL_OPTION,
    ...states.map((s) => ({ value: s.id, label: s.name })),
  ];
  const typeOptions: AreaOption[] = [ALL_OPTION, ...propertyTypes];

  const cityLabel = states.find((s) => s.id === filters.stateId)?.name ?? 'City';
  const typeLabel =
    propertyTypes.find((t) => t.value === filters.propertyType)?.label ?? 'Property type';
  const hasActive = Boolean(filters.search || filters.stateId || filters.propertyType);

  const reset = () => {
    setSearchText('');
    onChange({});
  };

  return (
    <View className="gap-2">
      <Input
        placeholder="Search areas"
        value={searchText}
        onChangeText={setSearchText}
        returnKeyType="search"
      />
      <View className="flex-row gap-2">
        <FilterTrigger
          label={cityLabel}
          active={Boolean(filters.stateId)}
          onPress={() => cityRef.current?.present()}
        />
        <FilterTrigger
          label={typeLabel}
          active={Boolean(filters.propertyType)}
          onPress={() => typeRef.current?.present()}
        />
      </View>
      {hasActive ? (
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <X size={14} color={brand} />
          <Text className="text-sm font-medium text-brand">Reset filters</Text>
        </Pressable>
      ) : null}

      <AreaOptionSheet
        title="Select city"
        options={cityOptions}
        selectedValue={filters.stateId ?? ''}
        onSelect={(value) => onChange({ ...filters, stateId: value || undefined })}
        sheetRef={cityRef}
      />
      <AreaOptionSheet
        title="Select property type"
        options={typeOptions}
        selectedValue={filters.propertyType ?? ''}
        onSelect={(value) => onChange({ ...filters, propertyType: value || undefined })}
        sheetRef={typeRef}
      />
    </View>
  );
}
