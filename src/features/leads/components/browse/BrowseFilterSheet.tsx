import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import {
  PRIORITY_FILTERS,
  PRIORITY_LABEL,
  type AssignmentFilter,
  type LeadPriority,
  type PortalSource,
} from '@/features/leads/types';
import { cn } from '@/lib/utils';

const PORTAL_SOURCES: { key: PortalSource; label: string }[] = [
  { key: 'property_finder', label: 'Property Finder' },
  { key: 'bayut', label: 'Bayut' },
  { key: 'dubizzle', label: 'Dubizzle' },
];

function Chip({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      className={cn(
        'mb-2 mr-2 rounded-full border px-3.5 py-2',
        active ? 'border-brand bg-brand' : 'border-border bg-card',
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold',
          active ? 'text-brand-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface BrowseFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  priority: LeadPriority | null;
  assignment: AssignmentFilter;
  assigneeId: string | null;
  onPriority: (p: LeadPriority | null) => void;
  onAssignment: (a: AssignmentFilter) => void;
  onAssigneeId: (id: string | null) => void;
  onClear: () => void;
  // Portal-only: when provided, a "Portal source" section is shown.
  portalSource?: PortalSource | null;
  onPortalSource?: (s: PortalSource | null) => void;
}

const ASSIGNMENTS: AssignmentFilter[] = ['all', 'assigned', 'unassigned'];

export function BrowseFilterSheet({
  visible,
  onClose,
  priority,
  assignment,
  assigneeId,
  onPriority,
  onAssignment,
  onAssigneeId,
  onClear,
  portalSource = null,
  onPortalSource,
}: Readonly<BrowseFilterSheetProps>) {
  const { data: agents } = useAgentsList();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable
          onPress={() => {}}
          style={{ flexShrink: 1 }}
          className="max-h-[85%] rounded-t-3xl bg-card p-5"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-foreground">Filters</Text>
            <Pressable onPress={onClear}>
              <Text className="text-sm font-bold text-brand">Clear all</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {onPortalSource ? (
              <>
                <Text className="mb-2 mt-2 text-xs font-extrabold uppercase text-muted-foreground">
                  Portal source
                </Text>
                <View className="flex-row flex-wrap">
                  {PORTAL_SOURCES.map((s) => (
                    <Chip
                      key={s.key}
                      label={s.label}
                      active={portalSource === s.key}
                      onPress={() => onPortalSource(portalSource === s.key ? null : s.key)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text className="mb-2 mt-2 text-xs font-extrabold uppercase text-muted-foreground">
              Assignment
            </Text>
            <View className="flex-row flex-wrap">
              {ASSIGNMENTS.map((a) => (
                <Chip
                  key={a}
                  label={a[0].toUpperCase() + a.slice(1)}
                  active={assignment === a}
                  onPress={() => onAssignment(a)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Priority
            </Text>
            <View className="flex-row flex-wrap">
              {PRIORITY_FILTERS.map((p) => (
                <Chip
                  key={p}
                  label={PRIORITY_LABEL[p]}
                  active={priority === p}
                  onPress={() => onPriority(priority === p ? null : p)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Assignee
            </Text>
            <View className="flex-row flex-wrap">
              {(agents?.items ?? []).map((a) => {
                const name =
                  [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'Agent';
                return (
                  <Chip
                    key={a.id}
                    label={name}
                    active={assigneeId === a.id}
                    onPress={() => onAssigneeId(assigneeId === a.id ? null : a.id)}
                  />
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
            className="mt-4 items-center rounded-2xl bg-brand py-3.5"
          >
            <Text className="text-base font-extrabold text-brand-foreground">Apply</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
