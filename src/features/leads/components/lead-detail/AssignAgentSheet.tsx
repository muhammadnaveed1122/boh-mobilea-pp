/**
 * AssignAgentSheet — assign / reassign / unassign a lead's agent.
 *
 * Mobile counterpart of web's `AssignAgentModal` + `AgentPickerModal`: same
 * `PATCH /leads/:id { assigneeId }` write, same server-scoped agent list
 * (`forAssignment` + `assignFor: 'leads'` → own/team/all on `leads:assign`),
 * same rule that a deactivated-team agent is shown but not selectable.
 *
 * Web's picker is a filterable table (languages / specialities / areas). On a
 * phone that collapses to search + a single scrolling list; the pick is staged
 * locally and only written on confirm, so a mis-tap never reassigns a lead.
 *
 * Built on RN `Modal` (not `@gorhom/bottom-sheet`), matching `ActivityFiltersSheet`
 * on this same screen — which is also why the palette is re-injected via `vars()`:
 * a Modal renders in its own native view hierarchy, outside the `ThemeProvider`
 * view that carries the CSS variables, so without it every token resolves to
 * nothing.
 */

import * as React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import * as Haptics from 'expo-haptics';

import { useTheme, useThemeColor } from '@theme';
import { tokens } from '@theme/tokens';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { ApiError } from '@/lib/api-error';
import { initials } from '@/lib/format/initials';
import { showErrorToast, showToast } from '@/lib/toast/toast.store';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

import { useAssignableAgents } from '../../hooks/use-agents-list';
import { useUpdateLead } from '../../hooks/use-update-lead';
import type { LeadAssignee } from '../../models/lead-detail';
import type { AgentListItem } from '../../types';

const SEARCH_DEBOUNCE_MS = 300;

function agentName(agent: AgentListItem): string {
  return (
    [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim() || agent.email || 'Agent'
  );
}

function selectionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/** Failure copy, matching web's toasts for the two cases the API distinguishes. */
function assignErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'You do not have permission to assign leads.';
    // The backend rejects assigning a lead another agent already claimed.
    if (error.status === 409) {
      return error.message || 'This lead has already been assigned to another agent.';
    }
    if (error.message) return error.message;
  }
  return 'Failed to update agent assignment. Please try again.';
}

interface AgentRowProps {
  name: string;
  photoUrl?: string | null;
  teamName?: string | null;
  selected: boolean;
  isCurrent: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function AgentRow({
  name,
  photoUrl,
  teamName,
  selected,
  isCurrent,
  disabled = false,
  onPress,
}: Readonly<AgentRowProps>) {
  const brand = useThemeColor('--brand');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
      className={cn(
        'min-h-14 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-muted',
        selected && 'bg-brand/10',
      )}
    >
      <Avatar alt={name} className="h-9 w-9 bg-brand-muted">
        {photoUrl ? <AvatarImage source={{ uri: photoUrl }} /> : null}
        <AvatarFallback className="bg-brand-muted">
          <Text className="text-xs font-semibold text-foreground">{initials(name)}</Text>
        </AvatarFallback>
      </Avatar>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-shrink text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {name}
          </Text>
          {isCurrent ? (
            <Badge variant="successSoft">
              <Text>Assigned</Text>
            </Badge>
          ) : null}
        </View>
        {teamName ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {disabled ? `${teamName} · Team deactivated` : teamName}
          </Text>
        ) : null}
      </View>

      {selected ? <Icon name="Check" size={20} color={brand} /> : null}
    </Pressable>
  );
}

export interface AssignAgentSheetProps {
  readonly leadId: string;
  readonly currentAssignee?: LeadAssignee | null;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function AssignAgentSheet({
  leadId,
  currentAssignee,
  visible,
  onClose,
}: AssignAgentSheetProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);

  const currentId = currentAssignee?.id ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(currentId);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const brand = useThemeColor('--brand');

  // Only fetch once the sheet is open — the picker list is scoped differently
  // from the assignee filter list, so it is a separate cache entry.
  const { data, isLoading } = useAssignableAgents(debouncedSearch || undefined, visible);
  const { mutate, isPending } = useUpdateLead(leadId);

  React.useEffect(() => {
    if (!visible) return;
    // The row can be tapped while the card is in Edit mode with a field focused.
    Keyboard.dismiss();
    setSelectedId(currentId);
    setSearch('');
  }, [visible, currentId]);

  const agents = data?.items ?? [];
  const changed = selectedId !== currentId;

  const submit = React.useCallback(() => {
    if (!changed) return;
    mutate(
      { assigneeId: selectedId },
      {
        onSuccess: () => {
          showToast('success', selectedId ? 'Agent updated' : 'Agent unassigned');
          onClose();
        },
        onError: (error) => {
          showErrorToast(assignErrorMessage(error));
        },
      },
    );
  }, [changed, mutate, onClose, selectedId]);

  let confirmLabel = 'Assign Agent';
  if (selectedId === null && currentId) {
    confirmLabel = 'Unassign Agent';
  } else if (currentId) {
    confirmLabel = 'Update Agent';
  }

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

          <View className="px-5 pb-3 pt-3">
            <Text className="text-center text-base font-semibold text-foreground">
              Assign Agent
            </Text>
            <Text className="pb-3 pt-1 text-center text-xs text-muted-foreground">
              Select an available agent to assign to this lead
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name"
              placeholderTextColor={mutedFg}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: mutedFg,
                paddingHorizontal: 12,
                fontSize: 16,
                color: foreground,
              }}
            />
          </View>

          <ScrollView
            className="max-h-[55vh]"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {currentId ? (
              <AgentRow
                name="Unassign lead"
                selected={selectedId === null}
                isCurrent={false}
                onPress={() => {
                  selectionHaptic();
                  setSelectedId(null);
                }}
              />
            ) : null}

            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={brand} />
              </View>
            ) : null}

            {!isLoading && agents.length === 0 ? (
              <Text className="py-8 text-center text-sm text-muted-foreground">
                No agents found
              </Text>
            ) : null}

            {agents.map((agent) => {
              const isCurrent = agent.id === currentId;
              return (
                <AgentRow
                  key={agent.id}
                  name={agentName(agent)}
                  photoUrl={agent.avatarUrl}
                  teamName={agent.teamName}
                  selected={selectedId === agent.id}
                  isCurrent={isCurrent}
                  // A deactivated team blocks NEW picks; the lead's existing assignee
                  // stays selectable so the row isn't a dead end.
                  disabled={agent.isTeamDeactivated === true && !isCurrent}
                  onPress={() => {
                    selectionHaptic();
                    setSelectedId(agent.id);
                  }}
                />
              );
            })}
          </ScrollView>

          <View className="border-t border-border px-5 pt-3">
            <Button loading={isPending} loadingLabel="Saving" disabled={!changed} onPress={submit}>
              <Text>{confirmLabel}</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
