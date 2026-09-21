/**
 * Applied filters as removable chips.
 *
 * Without this the only sign a filter is on is a count badge, and a user who
 * forgets what they picked has to reopen the sheet to find out why the list
 * looks short. Each chip names its filter and drops it on tap.
 *
 * Id-valued filters (assignee, community, …) resolve their labels from the
 * same cached option queries the sheet uses, so no extra fetch happens here;
 * before those land the chip falls back to a count.
 */

import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { NATIONALITY_LABEL_BY_CODE, type SelectOption } from '../../constants/lead-profile-fields';
import {
  ASSIGNMENT_OPTIONS,
  CALL_OUTCOME_OPTIONS,
  FURNISHING_OPTIONS,
  PORTAL_SOURCE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  SOURCE_OPTIONS,
  VIEW_OPTIONS,
} from '../../constants/leads-filter-options';
import { useAgentsList } from '../../hooks/use-agents-list';
import { useLeadCreators } from '../../hooks/use-lead-creators';
import { useStates } from '../../hooks/use-states';
import { ALL_FILTER_KEYS, type FilterKey, type LeadsFilterState } from '../../models/leads-filters';
import { PRIORITY_LABEL, STATUS_LABEL } from '../../types';

interface Chip {
  key: FilterKey;
  label: string;
}

function labelOf(options: readonly SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** `"Assignee: Sara"` for one pick, `"Assignee: 3"` once it's a crowd. */
function multiLabel(field: string, values: string[], byId: Map<string, string>): string {
  if (values.length === 1) return `${field}: ${byId.get(values[0]) ?? values[0]}`;
  return `${field}: ${values.length}`;
}

interface ActiveFiltersRowProps {
  filters: LeadsFilterState;
  onRemove: (key: FilterKey) => void;
  onClearAll: () => void;
}

export function ActiveFiltersRow({
  filters,
  onRemove,
  onClearAll,
}: Readonly<ActiveFiltersRowProps>) {
  const muted = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');

  // Name lookups for id-valued filters. Each is enabled only when that filter
  // is actually applied — the sheet has already populated these cache entries
  // by the time a chip needs one, so this reads through without a refetch.
  const { data: agentsPage } = useAgentsList(undefined, (filters.assigneeId?.length ?? 0) > 0);
  const { data: creators } = useLeadCreators((filters.createdById?.length ?? 0) > 0);
  const { data: states } = useStates({ enabled: (filters.stateId?.length ?? 0) > 0 });

  const agentById = useMemo(
    () =>
      new Map(
        (agentsPage?.items ?? []).map((a) => [
          a.id,
          [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || (a.email ?? 'Unnamed'),
        ]),
      ),
    [agentsPage],
  );
  const creatorById = useMemo(
    () => new Map((creators ?? []).map((c) => [c.id, c.name ?? c.email ?? 'Unnamed'])),
    [creators],
  );
  const stateById = useMemo(() => new Map((states ?? []).map((s) => [s.id, s.name])), [states]);

  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [];
    for (const key of ALL_FILTER_KEYS) {
      const value = filters[key];
      if (value === undefined || value === false) continue;
      if (Array.isArray(value) && value.length === 0) continue;

      switch (key) {
        case 'status':
          out.push({ key, label: STATUS_LABEL[value as keyof typeof STATUS_LABEL] });
          break;
        case 'priority':
          out.push({ key, label: PRIORITY_LABEL[value as keyof typeof PRIORITY_LABEL] });
          break;
        case 'assignment':
          out.push({ key, label: labelOf(ASSIGNMENT_OPTIONS, value as string) });
          break;
        case 'source':
          out.push({ key, label: labelOf(SOURCE_OPTIONS, value as string) });
          break;
        case 'portalSource':
          out.push({ key, label: labelOf(PORTAL_SOURCE_OPTIONS, value as string) });
          break;
        case 'callOutcome':
          out.push({ key, label: labelOf(CALL_OUTCOME_OPTIONS, value as string) });
          break;
        case 'intentBucket':
          out.push({ key, label: (value as string).replace(/^./, (c) => c.toUpperCase()) });
          break;
        case 'newProject':
          out.push({ key, label: 'New Project' });
          break;
        case 'propertyType':
          out.push({ key, label: labelOf(PROPERTY_TYPE_OPTIONS, value as string) });
          break;
        case 'furnishing':
          out.push({ key, label: labelOf(FURNISHING_OPTIONS, value as string) });
          break;
        case 'view':
          out.push({ key, label: labelOf(VIEW_OPTIONS, value as string) });
          break;
        case 'nationality':
          out.push({
            key,
            label: NATIONALITY_LABEL_BY_CODE.get(value as string) ?? (value as string),
          });
          break;
        case 'assigneeId':
          out.push({ key, label: multiLabel('Assignee', value as string[], agentById) });
          break;
        case 'createdById':
          out.push({ key, label: multiLabel('Created by', value as string[], creatorById) });
          break;
        case 'stateId':
          out.push({ key, label: multiLabel('Community', value as string[], stateById) });
          break;
        case 'neighbourhoodId':
          out.push({ key, label: `Neighbourhood: ${(value as string[]).length}` });
          break;
        case 'countryCode':
          out.push({ key, label: (value as string[]).join(', ') });
          break;
        case 'bedroomsIn':
          out.push({
            key,
            label: `Rooms: ${(value as string[]).map((v) => labelOf(ROOM_OPTIONS, v)).join(', ')}`,
          });
          break;
        case 'spokenLanguages':
          out.push({ key, label: (value as string[]).join(', ') });
          break;
      }
    }
    return out;
  }, [filters, agentById, creatorById, stateById]);

  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      className="mt-2"
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={() => onRemove(chip.key)}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${chip.label}`}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          className="min-h-9 flex-row items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5"
        >
          <Text className="text-xs font-semibold text-brand" numberOfLines={1}>
            {chip.label}
          </Text>
          <Icon name="X" size={12} color={brand} />
        </Pressable>
      ))}
      <Pressable
        onPress={onClearAll}
        accessibilityRole="button"
        accessibilityLabel="Clear all filters"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        className="min-h-9 justify-center px-2"
      >
        <Text className="text-xs font-semibold" style={{ color: muted }}>
          Clear all
        </Text>
      </Pressable>
      <View className="w-2" />
    </ScrollView>
  );
}
