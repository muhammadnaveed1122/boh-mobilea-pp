import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { format } from 'date-fns';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import { OUTCOME_OPTIONS } from '../constants';

export interface CallFilterDraft {
  direction?: string;
  outcome?: string;
  department?: string;
  agentExtension?: string;
  campaignId?: string; // telesales tab only
  from?: string; // yyyy-MM-dd
  to?: string; // yyyy-MM-dd
}

interface PillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Pill({ label, active, onPress }: Readonly<PillProps>) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full border px-3 py-1.5',
        active ? 'border-brand bg-brand' : 'border-border bg-transparent',
      )}
    >
      <Text
        className={cn('text-xs font-medium', active ? 'text-brand-foreground' : 'text-foreground')}
      >
        {label}
      </Text>
    </Pressable>
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

interface Props {
  visible: boolean;
  initial: CallFilterDraft;
  agentOptions: { value: string; label: string }[];
  departmentOptions: string[];
  /** Campaign filter options — non-empty only on the Campaigns (telesales) tab. */
  campaignOptions: { value: string; label: string }[];
  onClose: () => void;
  onApply: (next: CallFilterDraft) => void;
}

function parseYmd(s?: string): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

export function CallFilterSheet({
  visible,
  initial,
  agentOptions,
  departmentOptions,
  campaignOptions,
  onClose,
  onApply,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<CallFilterDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const toggle = (key: keyof CallFilterDraft, value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? undefined : value }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-background" style={[palette, { paddingTop: insets.top }]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="X" size={22} />
          </Pressable>
          <Text className="text-base font-semibold text-foreground">Filters</Text>
          <Pressable onPress={() => setDraft({})} hitSlop={8}>
            <Text className="text-sm font-medium text-brand">Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {campaignOptions.length > 0 ? (
            <Section title="Campaign">
              <View className="flex-row flex-wrap gap-2">
                {campaignOptions.map((c) => (
                  <Pill
                    key={c.value}
                    label={c.label}
                    active={draft.campaignId === c.value}
                    onPress={() => toggle('campaignId', c.value)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Direction">
            <View className="flex-row flex-wrap gap-2">
              <Pill
                label="Incoming"
                active={draft.direction === 'inbound'}
                onPress={() => toggle('direction', 'inbound')}
              />
              <Pill
                label="Outgoing"
                active={draft.direction === 'outbound'}
                onPress={() => toggle('direction', 'outbound')}
              />
            </View>
          </Section>

          <Section title="Outcome">
            <View className="flex-row flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((o) => (
                <Pill
                  key={o}
                  label={o}
                  active={draft.outcome === o}
                  onPress={() => toggle('outcome', o)}
                />
              ))}
            </View>
          </Section>

          {agentOptions.length > 0 ? (
            <Section title="Agent">
              <View className="flex-row flex-wrap gap-2">
                {agentOptions.map((a) => (
                  <Pill
                    key={a.value}
                    label={a.label}
                    active={draft.agentExtension === a.value}
                    onPress={() => toggle('agentExtension', a.value)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {departmentOptions.length > 0 ? (
            <Section title="Department">
              <View className="flex-row flex-wrap gap-2">
                {departmentOptions.map((d) => (
                  <Pill
                    key={d}
                    label={d}
                    active={draft.department === d}
                    onPress={() => toggle('department', d)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="From">
            <DatePicker
              value={parseYmd(draft.from)}
              onChange={(d) => setDraft((prev) => ({ ...prev, from: format(d, 'yyyy-MM-dd') }))}
              placeholder="Start date"
            />
          </Section>
          <Section title="To">
            <DatePicker
              value={parseYmd(draft.to)}
              onChange={(d) => setDraft((prev) => ({ ...prev, to: format(d, 'yyyy-MM-dd') }))}
              placeholder="End date"
            />
          </Section>
        </ScrollView>

        <View
          className="border-t border-border bg-background px-5 py-3"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <Button
            onPress={() => {
              onApply(draft);
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
