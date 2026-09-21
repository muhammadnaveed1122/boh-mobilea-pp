import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor } from '@theme';
import { tokens } from '@theme/tokens';
import { useListingAgents } from '../hooks/use-listing-agents';
import { useAssignListingAgent, useChangeListingStage } from '../hooks/use-listing-mutations';
import type { ListingStage, UnifiedListingRow } from '../types';

interface Props {
  visible: boolean;
  row: UnifiedListingRow;
  stages: ListingStage[];
  onClose: () => void;
}

function SectionTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Text className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </Text>
  );
}

/** One selectable row with a leading marker and a trailing check when active. */
function OptionRow({
  label,
  active,
  dotColor,
  onPress,
}: Readonly<{ label: string; active: boolean; dotColor?: string; onPress: () => void }>) {
  const brand = useThemeColor('--brand');
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'mb-1.5 flex-row items-center gap-2 rounded-xl border px-3 py-2.5',
        active ? 'border-brand bg-brand/10' : 'border-border bg-card',
      )}
    >
      {dotColor !== undefined ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      ) : null}
      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {active ? <Icon name="Check" size={16} color={brand} /> : null}
    </Pressable>
  );
}

export function ListingActionsSheet({ visible, row, stages, onClose }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const brand = useThemeColor('--brand');

  const { data: agents, isLoading: agentsLoading } = useListingAgents();
  const changeStage = useChangeListingStage(row.kind);
  const assignAgent = useAssignListingAgent(row.kind);
  const busy = changeStage.isPending || assignAgent.isPending;

  const onPickStage = (stageId: string | null) => {
    if (busy) return;
    changeStage.mutate({ listingId: row.id, stageId }, { onSuccess: onClose });
  };

  const onPickAgent = (assigneeId: string | null) => {
    if (busy) return;
    assignAgent.mutate({ listingId: row.id, assigneeId }, { onSuccess: onClose });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50" style={palette}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="max-h-[80%] rounded-t-3xl bg-background"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
            <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
              {row.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="X" size={22} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <SectionTitle>Change Stage</SectionTitle>
            {stages.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No stages for this lifecycle.</Text>
            ) : (
              <>
                <OptionRow label="No stage" active={!row.stage} onPress={() => onPickStage(null)} />
                {stages.map((stage) => (
                  <OptionRow
                    key={stage.id}
                    label={stage.name}
                    dotColor={stage.color}
                    active={row.stage?.id === stage.id}
                    onPress={() => onPickStage(stage.id)}
                  />
                ))}
              </>
            )}

            <SectionTitle>Assign Agent</SectionTitle>
            {agentsLoading ? (
              <ActivityIndicator color={brand} />
            ) : (
              <>
                <OptionRow
                  label="Unassigned"
                  active={!row.assigneeId}
                  onPress={() => onPickAgent(null)}
                />
                {(agents ?? []).map((agent) => (
                  <OptionRow
                    key={agent.id}
                    label={agent.name}
                    active={row.assigneeId === agent.id}
                    onPress={() => onPickAgent(agent.id)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          {busy ? (
            <View className="absolute inset-0 items-center justify-center rounded-t-3xl bg-background/60">
              <ActivityIndicator color={brand} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
