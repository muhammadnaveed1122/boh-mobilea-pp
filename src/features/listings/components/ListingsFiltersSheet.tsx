import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import { useListingAgents } from '../hooks/use-listing-agents';

export interface ListingsFilterDraft {
  agentId?: string;
  agentLabel?: string;
  property?: string;
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

interface ListingsFiltersSheetProps {
  visible: boolean;
  initial: ListingsFilterDraft;
  onClose: () => void;
  onApply: (next: ListingsFilterDraft) => void;
}

export function ListingsFiltersSheet({
  visible,
  initial,
  onClose,
  onApply,
}: Readonly<ListingsFiltersSheetProps>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<ListingsFilterDraft>(initial);
  const { data: agents, isLoading: agentsLoading } = useListingAgents();

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const reset = () => setDraft({});

  const agentValue =
    draft.agentId && draft.agentLabel
      ? { value: draft.agentId, label: draft.agentLabel }
      : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Nested GH root + BottomSheetModalProvider so the agent Select's gorhom
          sheet portals INSIDE this native Modal (otherwise it opens behind it). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <View className="flex-1 bg-background" style={[palette, { paddingTop: insets.top }]}>
            <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="X" size={22} />
              </Pressable>
              <Text className="text-base font-semibold text-foreground">Filters</Text>
              <Pressable onPress={reset} hitSlop={8}>
                <Text className="text-sm font-medium text-brand">Reset</Text>
              </Pressable>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <Section title="Agent">
                <Select
                  value={agentValue}
                  onValueChange={(opt) =>
                    setDraft({ ...draft, agentId: opt?.value, agentLabel: opt?.label })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={agentsLoading ? 'Loading agents…' : 'All agents'} />
                  </SelectTrigger>
                  <SelectContent title="Agent" loading={agentsLoading}>
                    {(agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} label={a.name} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Property">
                <Input
                  value={draft.property ?? ''}
                  onChangeText={(v) => setDraft({ ...draft, property: v })}
                  placeholder="Building or unit number…"
                  returnKeyType="search"
                />
              </Section>
            </ScrollView>

            <View
              className="border-t border-border bg-background px-5 py-3"
              style={{ paddingBottom: 12 + insets.bottom }}
            >
              <Button
                onPress={() => {
                  onApply({
                    ...draft,
                    property: draft.property?.trim() ? draft.property.trim() : undefined,
                  });
                  onClose();
                }}
              >
                <Text>Apply Filters</Text>
              </Button>
            </View>
          </View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
