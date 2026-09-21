import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import {
  INTEREST_LABEL,
  INTEREST_TYPE_LABEL,
  PRIORITY_LABEL,
  type LeadInterest,
  type LeadInterestType,
  type LeadPriority,
} from '../types';

export interface LeadsFilterDraft {
  interest?: LeadInterest;
  interestType?: LeadInterestType;
  priority?: LeadPriority;
}

interface OptionPillProps<T extends string> {
  label: string;
  value: T;
  active: boolean;
  onPress: () => void;
}

function OptionPill<T extends string>({ label, active, onPress }: Readonly<OptionPillProps<T>>) {
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

interface LeadsFiltersSheetProps {
  visible: boolean;
  initial: LeadsFilterDraft;
  onClose: () => void;
  onApply: (next: LeadsFilterDraft) => void;
}

export function LeadsFiltersSheet({
  visible,
  initial,
  onClose,
  onApply,
}: Readonly<LeadsFiltersSheetProps>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<LeadsFilterDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const reset = () => setDraft({});

  const interestOptions = Object.keys(INTEREST_LABEL) as LeadInterest[];
  const interestTypeOptions = Object.keys(INTEREST_TYPE_LABEL) as LeadInterestType[];
  const priorityOptions = Object.keys(PRIORITY_LABEL) as LeadPriority[];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
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
          <Section title="Persona">
            <View className="flex-row flex-wrap gap-2">
              {interestOptions.map((opt) => (
                <OptionPill
                  key={opt}
                  label={INTEREST_LABEL[opt]}
                  value={opt}
                  active={draft.interest === opt}
                  onPress={() =>
                    setDraft({ ...draft, interest: draft.interest === opt ? undefined : opt })
                  }
                />
              ))}
            </View>
          </Section>

          <Section title="Intent">
            <View className="flex-row flex-wrap gap-2">
              {interestTypeOptions.map((opt) => (
                <OptionPill
                  key={opt}
                  label={INTEREST_TYPE_LABEL[opt]}
                  value={opt}
                  active={draft.interestType === opt}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      interestType: draft.interestType === opt ? undefined : opt,
                    })
                  }
                />
              ))}
            </View>
          </Section>

          <Section title="Priority">
            <View className="flex-row flex-wrap gap-2">
              {priorityOptions.map((opt) => (
                <OptionPill
                  key={opt}
                  label={PRIORITY_LABEL[opt]}
                  value={opt}
                  active={draft.priority === opt}
                  onPress={() =>
                    setDraft({ ...draft, priority: draft.priority === opt ? undefined : opt })
                  }
                />
              ))}
            </View>
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
