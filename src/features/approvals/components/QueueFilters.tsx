import * as React from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, RotateCcw } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApproverOption } from '../services';
import { useApprovers } from '../hooks/use-approvers';
import { useAgentSearch } from '../hooks/use-agent-search';
import type { ApprovalsQueueFilters } from '../hooks/use-approvals-queue';

function FilterTrigger({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
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
        className={cn('flex-1 text-base', active ? 'text-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
      <ChevronDown size={16} color={iconColor} />
    </Pressable>
  );
}

function OptionSheet({
  title,
  options,
  selectedValue,
  onSelect,
  sheetRef,
  searchable,
  searchValue,
  onSearchChange,
}: Readonly<{
  title: string;
  options: ApproverOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}>) {
  const insets = useSafeAreaInsets();
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');
  const muted = useThemeColor('--muted-foreground');

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
        {searchable ? (
          <BottomSheetTextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder="Search agents"
            placeholderTextColor={muted}
            className="mb-2 h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground"
          />
        ) : null}
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
              <Text className="flex-1 text-base text-popover-foreground">{opt.label}</Text>
              {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export function QueueFilters({
  filters,
  onFilterChange,
  onReset,
}: Readonly<{
  filters: ApprovalsQueueFilters;
  onFilterChange: <K extends keyof ApprovalsQueueFilters>(
    key: K,
    value: ApprovalsQueueFilters[K],
  ) => void;
  onReset: () => void;
}>) {
  const approverRef = React.useRef<BottomSheetModal>(null);
  const agentRef = React.useRef<BottomSheetModal>(null);
  const muted = useThemeColor('--muted-foreground');

  const { options: approverOptions } = useApprovers();
  const {
    options: agentOptions,
    search: agentSearch,
    setSearch: setAgentSearch,
  } = useAgentSearch();

  const approverLabel =
    approverOptions.find((o) => o.value === filters.approverId)?.label ?? 'All Approvers';
  const agentLabel = agentOptions.find((o) => o.value === filters.agentId)?.label ?? 'All Agents';
  const anyActive = filters.search !== '' || filters.approverId !== '' || filters.agentId !== '';

  return (
    <View className="gap-2 px-4 pb-2">
      <Input
        placeholder="Search by title, price or agent"
        value={filters.search}
        onChangeText={(v) => onFilterChange('search', v)}
      />
      <View className="flex-row gap-2">
        <FilterTrigger
          label={approverLabel}
          active={filters.approverId !== ''}
          onPress={() => approverRef.current?.present()}
        />
        <FilterTrigger
          label={agentLabel}
          active={filters.agentId !== ''}
          onPress={() => agentRef.current?.present()}
        />
        {anyActive ? (
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            className="h-11 w-11 items-center justify-center rounded-lg border border-input bg-background active:opacity-70"
          >
            <RotateCcw size={18} color={muted} />
          </Pressable>
        ) : null}
      </View>

      <OptionSheet
        title="Approver"
        options={approverOptions}
        selectedValue={filters.approverId}
        onSelect={(v) => onFilterChange('approverId', v)}
        sheetRef={approverRef}
      />
      <OptionSheet
        title="Agent"
        options={agentOptions}
        selectedValue={filters.agentId}
        onSelect={(v) => onFilterChange('agentId', v)}
        sheetRef={agentRef}
        searchable
        searchValue={agentSearch}
        onSearchChange={setAgentSearch}
      />
    </View>
  );
}
