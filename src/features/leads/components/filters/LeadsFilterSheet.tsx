/**
 * Leads filter sheet — mobile equivalent of web's `BoardFilterBar` +
 * `LeadsMoreFiltersDrawer`, collapsed into one sheet because a phone has no
 * room for a persistent filter bar.
 *
 * Layout follows the web ordering but re-groups by how a filter is picked:
 * short enumerations become chip rows (visible at a glance, one tap), long or
 * fetched lists become drill-down rows. Edits go to a local draft — the list
 * behind the sheet doesn't refetch until Apply, so a half-built filter set
 * never fires a query.
 *
 * Not carried over from web, both deliberate: Team (admin-only there, and no
 * teams client here) and Financing (commented out on web pending a decision).
 *
 * Built on React Native's own `Modal`, matching the sheet `/leads/all` already
 * ships. A native modal is its own view hierarchy, so the theme palette has to
 * be re-applied inside it via `vars()` — without that the tokens resolve to
 * nothing and the panel renders unstyled.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { vars } from 'nativewind';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';

import {
  NATIONALITY_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
  type SelectOption,
} from '../../constants/lead-profile-fields';
import {
  ASSIGNMENT_OPTIONS,
  CALL_OUTCOME_OPTIONS,
  DIAL_CODE_OPTIONS,
  FURNISHING_OPTIONS,
  PORTAL_SOURCE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  SOURCE_OPTIONS,
  VIEW_OPTIONS,
} from '../../constants/leads-filter-options';
import { useAgentsList } from '../../hooks/use-agents-list';
import { useLeadCreators } from '../../hooks/use-lead-creators';
import { useNeighbourhoods } from '../../hooks/use-neighbourhoods';
import { useStates } from '../../hooks/use-states';
import {
  clearSheetFilters,
  countActiveFilters,
  type LeadsFilterState,
} from '../../models/leads-filters';
import { PRIORITY_FILTERS, PRIORITY_LABEL } from '../../types';
import {
  FilterChipGroup,
  FilterPickerRow,
  FilterSection,
  FilterToggleRow,
  toSelection,
  type FilterOption,
  type FilterValue,
} from './FilterControls';
import { OptionPickerView } from './OptionPickerView';

const PRIORITY_OPTIONS: FilterOption[] = PRIORITY_FILTERS.map((p) => ({
  value: p,
  label: PRIORITY_LABEL[p],
}));

const INTENT_OPTIONS: FilterOption[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'rent', label: 'Rent' },
  { value: 'sell', label: 'Sell' },
];

/** Which drill-down list is open, or `null` for the sheet's root view. */
type PickerField =
  | 'assigneeId'
  | 'createdById'
  | 'source'
  | 'stateId'
  | 'neighbourhoodId'
  | 'propertyType'
  | 'nationality'
  | 'spokenLanguages'
  | 'countryCode'
  | 'furnishing'
  | 'view'
  | null;

function agentLabel(agent: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : (agent.email ?? 'Unnamed');
}

/** "3 selected" for multi-picks, the label itself for a single pick. */
function summarize(value: FilterValue, options: readonly SelectOption[]): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    if (value.length === 1) {
      return options.find((o) => o.value === value[0])?.label ?? value[0];
    }
    return `${value.length} selected`;
  }
  return options.find((o) => o.value === value)?.label ?? value;
}

function selectionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

interface LeadsFilterSheetProps {
  visible: boolean;
  /** Filters currently applied to the list. Re-seeds the draft on each open. */
  filters: LeadsFilterState;
  onApply: (next: LeadsFilterState) => void;
  onClose: () => void;
}

export function LeadsFilterSheet({
  visible,
  filters,
  onApply,
  onClose,
}: Readonly<LeadsFilterSheetProps>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);

  const [draft, setDraft] = useState<LeadsFilterState>(filters);
  const [picker, setPicker] = useState<PickerField>(null);

  // Re-seed the draft each time it opens, so an abandoned edit is discarded
  // and the sheet always reflects what's actually applied.
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPicker(null);
    }
  }, [visible, filters]);

  const patch = (next: Partial<LeadsFilterState>): void => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  // Option sources, all gated on `visible`: this component stays mounted for
  // the life of the leads tab, so fetching eagerly would cost three requests
  // per tab visit for a sheet most sessions never open. The cache is shared
  // with the applied-filter chips, which read it without refetching.
  const { data: agentsPage, isLoading: agentsLoading } = useAgentsList(undefined, visible);
  const { data: creators, isLoading: creatorsLoading } = useLeadCreators(visible);
  const { data: states, isLoading: statesLoading } = useStates({ enabled: visible });
  // The neighbourhood endpoint scopes to a single state, so this stays disabled
  // until exactly one community is picked.
  const singleStateId = draft.stateId?.length === 1 ? draft.stateId[0] : undefined;
  const { data: neighbourhoods, isLoading: neighbourhoodsLoading } = useNeighbourhoods(
    singleStateId,
    { enabled: visible },
  );

  const agentOptions = useMemo<FilterOption[]>(
    () => (agentsPage?.items ?? []).map((a) => ({ value: a.id, label: agentLabel(a) })),
    [agentsPage],
  );
  const creatorOptions = useMemo<FilterOption[]>(
    () => (creators ?? []).map((c) => ({ value: c.id, label: c.name ?? c.email ?? 'Unnamed' })),
    [creators],
  );
  const stateOptions = useMemo<FilterOption[]>(
    () => (states ?? []).map((s) => ({ value: s.id, label: s.name })),
    [states],
  );
  const neighbourhoodOptions = useMemo<FilterOption[]>(
    () => (neighbourhoods ?? []).map((n) => ({ value: n.id, label: n.name })),
    [neighbourhoods],
  );

  const draftCount = countActiveFilters(draft);

  const apply = (): void => {
    selectionHaptic();
    onApply(draft);
    onClose();
  };

  const reset = (): void => {
    selectionHaptic();
    setDraft((prev) => clearSheetFilters(prev));
  };

  /** Config for whichever drill-down is open. */
  const pickerConfig = useMemo(() => {
    switch (picker) {
      case 'assigneeId':
        return {
          title: 'Assignee',
          options: agentOptions,
          multi: true,
          loading: agentsLoading,
          empty: 'No agents found.',
        };
      case 'createdById':
        return {
          title: 'Created by',
          options: creatorOptions,
          multi: true,
          loading: creatorsLoading,
          empty: 'No users found.',
        };
      case 'source':
        return { title: 'Source', options: SOURCE_OPTIONS, multi: false, loading: false };
      case 'stateId':
        return {
          title: 'Community',
          options: stateOptions,
          multi: true,
          loading: statesLoading,
          empty: 'No communities found.',
        };
      case 'neighbourhoodId':
        return {
          title: 'Neighbourhood',
          options: neighbourhoodOptions,
          multi: true,
          loading: neighbourhoodsLoading,
          empty: 'No neighbourhoods in this community.',
        };
      case 'propertyType':
        return { title: 'Property type', options: PROPERTY_TYPE_OPTIONS, multi: false };
      case 'nationality':
        return { title: 'Nationality', options: NATIONALITY_OPTIONS, multi: false };
      case 'spokenLanguages':
        return { title: 'Spoken languages', options: SPOKEN_LANGUAGE_OPTIONS, multi: true };
      case 'countryCode':
        return { title: 'Country code', options: DIAL_CODE_OPTIONS, multi: true };
      case 'furnishing':
        return { title: 'Furnishing', options: FURNISHING_OPTIONS, multi: false };
      case 'view':
        return { title: 'Preferred view', options: VIEW_OPTIONS, multi: false };
      default:
        return null;
    }
  }, [
    picker,
    agentOptions,
    agentsLoading,
    creatorOptions,
    creatorsLoading,
    stateOptions,
    statesLoading,
    neighbourhoodOptions,
    neighbourhoodsLoading,
  ]);

  const handlePickerChange = (next: FilterValue): void => {
    if (picker === null) return;
    if (picker === 'stateId') {
      // Neighbourhoods are scoped to the picked communities — a stale pick from
      // a community that just got removed must not keep filtering silently.
      const values = toSelection(next);
      patch({ stateId: values.length > 0 ? values : undefined, neighbourhoodId: undefined });
      return;
    }
    patch({ [picker]: next } as Partial<LeadsFilterState>);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim: tapping outside the panel dismisses, as a sheet should. */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close filters"
        className="flex-1 justify-end bg-black/50"
      >
        {/* Swallows taps so a press inside the panel never hits the scrim. */}
        <Pressable
          onPress={() => {}}
          style={[palette, { maxHeight: '92%', flexShrink: 1 }]}
          className="overflow-hidden rounded-t-3xl bg-background pt-2"
        >
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-muted-foreground/40" />
          {pickerConfig ? (
            <View style={{ height: 520 }}>
              <OptionPickerView
                title={pickerConfig.title}
                options={pickerConfig.options}
                value={picker ? (draft[picker] as FilterValue) : undefined}
                multi={pickerConfig.multi}
                loading={pickerConfig.loading}
                emptyLabel={pickerConfig.empty}
                onChange={handlePickerChange}
                onBack={() => setPicker(null)}
              />
            </View>
          ) : (
            // Shrinkable, or the header + scroll list size to their content and
            // push the Apply bar past the panel's 92% cap, where it's clipped.
            <View style={{ flexShrink: 1 }}>
              <View className="flex-row items-center justify-between border-b border-border px-4 pb-3">
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close filters"
                  className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
                >
                  <Icon name="X" size={22} />
                </Pressable>
                <Text className="text-base font-bold text-foreground">
                  Filters{draftCount > 0 ? ` (${draftCount})` : ''}
                </Text>
                <Pressable
                  onPress={reset}
                  disabled={draftCount === 0}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all filters"
                  accessibilityState={{ disabled: draftCount === 0 }}
                  className="min-h-11 w-11 items-end justify-center"
                  style={{ opacity: draftCount === 0 ? 0.4 : 1 }}
                >
                  <Text className="text-sm font-semibold text-brand">Reset</Text>
                </Pressable>
              </View>

              <ScrollView
                // The panel is capped at 92% of the screen; without an explicit
                // shrink the list would size to its content and push the Apply bar
                // off the bottom.
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <FilterSection title="Priority">
                  <FilterChipGroup
                    options={PRIORITY_OPTIONS}
                    value={draft.priority}
                    onChange={(v) => patch({ priority: v as LeadsFilterState['priority'] })}
                  />
                </FilterSection>

                <FilterSection title="Assignment">
                  <FilterChipGroup
                    options={ASSIGNMENT_OPTIONS}
                    value={draft.assignment}
                    onChange={(v) => patch({ assignment: v as LeadsFilterState['assignment'] })}
                  />
                </FilterSection>

                <FilterSection title="Type">
                  <FilterChipGroup
                    options={INTENT_OPTIONS}
                    value={draft.intentBucket}
                    onChange={(v) => patch({ intentBucket: v as LeadsFilterState['intentBucket'] })}
                  />
                </FilterSection>

                <FilterSection title="Rooms">
                  <FilterChipGroup
                    multi
                    options={ROOM_OPTIONS}
                    value={draft.bedroomsIn}
                    onChange={(v) => patch({ bedroomsIn: v as string[] | undefined })}
                  />
                </FilterSection>

                <FilterSection title="Portal">
                  <FilterChipGroup
                    options={PORTAL_SOURCE_OPTIONS}
                    value={draft.portalSource}
                    onChange={(v) => patch({ portalSource: v as string | undefined })}
                  />
                </FilterSection>

                <FilterSection title="Call outcome">
                  <FilterChipGroup
                    options={CALL_OUTCOME_OPTIONS}
                    value={draft.callOutcome}
                    onChange={(v) => patch({ callOutcome: v as string | undefined })}
                  />
                </FilterSection>

                <FilterSection title="People">
                  <View className="gap-2">
                    <FilterPickerRow
                      label="Assignee"
                      summary={summarize(draft.assigneeId, agentOptions)}
                      placeholder="All agents"
                      loading={agentsLoading}
                      onPress={() => setPicker('assigneeId')}
                    />
                    <FilterPickerRow
                      label="Created by"
                      summary={summarize(draft.createdById, creatorOptions)}
                      placeholder="Anyone"
                      loading={creatorsLoading}
                      onPress={() => setPicker('createdById')}
                    />
                    <FilterPickerRow
                      label="Nationality"
                      summary={summarize(draft.nationality, NATIONALITY_OPTIONS)}
                      onPress={() => setPicker('nationality')}
                    />
                    <FilterPickerRow
                      label="Spoken languages"
                      summary={summarize(draft.spokenLanguages, SPOKEN_LANGUAGE_OPTIONS)}
                      onPress={() => setPicker('spokenLanguages')}
                    />
                    <FilterPickerRow
                      label="Country code"
                      summary={
                        draft.countryCode && draft.countryCode.length > 0
                          ? draft.countryCode.join(', ')
                          : undefined
                      }
                      onPress={() => setPicker('countryCode')}
                    />
                  </View>
                </FilterSection>

                <FilterSection title="Property">
                  <View className="gap-2">
                    <FilterPickerRow
                      label="Source"
                      summary={summarize(draft.source, SOURCE_OPTIONS)}
                      placeholder="All sources"
                      onPress={() => setPicker('source')}
                    />
                    <FilterPickerRow
                      label="Community"
                      summary={summarize(draft.stateId, stateOptions)}
                      loading={statesLoading}
                      onPress={() => setPicker('stateId')}
                    />
                    <FilterPickerRow
                      label="Neighbourhood"
                      summary={summarize(draft.neighbourhoodId, neighbourhoodOptions)}
                      placeholder={singleStateId ? 'Any' : 'Pick one community first'}
                      disabled={!singleStateId}
                      loading={neighbourhoodsLoading}
                      onPress={() => setPicker('neighbourhoodId')}
                    />
                    <FilterPickerRow
                      label="Property type"
                      summary={summarize(draft.propertyType, PROPERTY_TYPE_OPTIONS)}
                      onPress={() => setPicker('propertyType')}
                    />
                    <FilterPickerRow
                      label="Furnishing"
                      summary={summarize(draft.furnishing, FURNISHING_OPTIONS)}
                      onPress={() => setPicker('furnishing')}
                    />
                    <FilterPickerRow
                      label="Preferred view"
                      summary={summarize(draft.view, VIEW_OPTIONS)}
                      onPress={() => setPicker('view')}
                    />
                  </View>
                </FilterSection>

                <FilterToggleRow
                  label="New Project only"
                  description="Off-plan and new-project enquiries"
                  value={draft.newProject === true}
                  onChange={(next) => patch({ newProject: next ? true : undefined })}
                />
              </ScrollView>

              <View
                className="border-t border-border bg-background px-5 pt-3"
                style={{ paddingBottom: 12 + insets.bottom }}
              >
                <Button onPress={apply} accessibilityLabel="Apply filters">
                  <Text>{draftCount > 0 ? `Show results (${draftCount})` : 'Show results'}</Text>
                </Button>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
