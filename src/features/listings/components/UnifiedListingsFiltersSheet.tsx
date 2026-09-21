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
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import { useListingAgents } from '../hooks/use-listing-agents';
import { useDeveloperOptions } from '../hooks/use-developers';
import {
  PORTAL_META,
  PORTAL_ORDER,
  PRICE_OPTIONS,
  ROOM_PILLS,
  STATUS_FILTER_OPTIONS,
} from '../lib/filters';
import type { ListingPortal } from '../types';
import type { UnifiedFilterDraft } from '../hooks/use-sell-listings';

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full px-3.5 py-2',
        active ? 'bg-brand' : 'border border-border bg-card',
      )}
    >
      <Text
        className={cn(
          'text-xs font-semibold',
          active ? 'text-brand-foreground' : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface Props {
  visible: boolean;
  initial: UnifiedFilterDraft;
  propertyTypeOptions: string[];
  onClose: () => void;
  onApply: (next: UnifiedFilterDraft) => void;
}

export function UnifiedListingsFiltersSheet({
  visible,
  initial,
  propertyTypeOptions,
  onClose,
  onApply,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<UnifiedFilterDraft>(initial);
  const { data: agents, isLoading: agentsLoading } = useListingAgents();
  const { data: developers, isLoading: developersLoading } = useDeveloperOptions();

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const reset = () => setDraft({});

  const statusValue = STATUS_FILTER_OPTIONS.find((o) => o.value === (draft.status ?? ''));
  const priceValue = PRICE_OPTIONS.find((o) => o.value === (draft.priceValue ?? ''));
  const agentValue =
    draft.agentId && draft.agentLabel
      ? { value: draft.agentId, label: draft.agentLabel }
      : undefined;
  const developerValue =
    draft.developerId && draft.developerLabel
      ? { value: draft.developerId, label: draft.developerLabel }
      : undefined;
  const propertyTypeValue = draft.propertyType
    ? { value: draft.propertyType, label: draft.propertyType }
    : undefined;

  const togglePortal = (p: ListingPortal) => {
    const set = new Set(draft.portals ?? []);
    if (set.has(p)) set.delete(p);
    else set.add(p);
    setDraft({ ...draft, portals: set.size ? [...set] : undefined });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Nested GH root + BottomSheetModalProvider so the Select's gorhom
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
              <Section title="Status">
                <Select
                  value={
                    statusValue?.value
                      ? { value: statusValue.value, label: statusValue.label }
                      : undefined
                  }
                  onValueChange={(opt) => setDraft({ ...draft, status: opt?.value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent title="Status">
                    {STATUS_FILTER_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Property Type">
                <Select
                  value={propertyTypeValue}
                  onValueChange={(opt) => setDraft({ ...draft, propertyType: opt?.value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent title="Property Type">
                    {propertyTypeOptions.map((t) => (
                      <SelectItem key={t} value={t} label={t} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Rooms">
                <View className="flex-row flex-wrap gap-2">
                  {ROOM_PILLS.map((r) => (
                    <Pill
                      key={r.value}
                      label={r.label}
                      active={draft.rooms === r.value}
                      onPress={() =>
                        setDraft({ ...draft, rooms: draft.rooms === r.value ? undefined : r.value })
                      }
                    />
                  ))}
                </View>
              </Section>

              <Section title="Price">
                <Select
                  value={
                    priceValue?.value
                      ? { value: priceValue.value, label: priceValue.label }
                      : undefined
                  }
                  onValueChange={(opt) =>
                    setDraft({ ...draft, priceValue: opt?.value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any price" />
                  </SelectTrigger>
                  <SelectContent title="Price">
                    {PRICE_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Developer">
                <Select
                  value={developerValue}
                  onValueChange={(opt) =>
                    setDraft({ ...draft, developerId: opt?.value, developerLabel: opt?.label })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={developersLoading ? 'Loading…' : 'All developers'} />
                  </SelectTrigger>
                  <SelectContent title="Developer" loading={developersLoading}>
                    {developers.map((d) => (
                      <SelectItem key={d.value} value={d.value} label={d.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Unit Number">
                <Input
                  value={draft.unitNumber ?? ''}
                  onChangeText={(v) => setDraft({ ...draft, unitNumber: v })}
                  placeholder="Unit number…"
                  returnKeyType="search"
                />
              </Section>

              <Section title="Portals">
                <View className="flex-row flex-wrap gap-2">
                  {PORTAL_ORDER.map((p) => (
                    <Pill
                      key={p}
                      label={PORTAL_META[p].label}
                      active={(draft.portals ?? []).includes(p)}
                      onPress={() => togglePortal(p)}
                    />
                  ))}
                </View>
              </Section>

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
            </ScrollView>

            <View
              className="border-t border-border bg-background px-5 py-3"
              style={{ paddingBottom: 12 + insets.bottom }}
            >
              <Button
                onPress={() => {
                  onApply({
                    ...draft,
                    unitNumber: draft.unitNumber?.trim() ? draft.unitNumber.trim() : undefined,
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
