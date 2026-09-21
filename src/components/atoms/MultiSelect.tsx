import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';

interface MultiSelectProps {
  value: string[];
  onValueChange: (next: string[]) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

interface OptionRowProps {
  optValue: string;
  label: string;
  checked: boolean;
  onToggle: (v: string) => void;
}

function OptionRow({ optValue, label, checked, onToggle }: Readonly<OptionRowProps>) {
  return (
    <Pressable
      onPress={() => onToggle(optValue)}
      className="mb-1 flex-row items-center gap-3 rounded-xl px-2 py-3"
    >
      <View pointerEvents="none">
        <Checkbox checked={checked} onCheckedChange={() => {}} />
      </View>
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  hasError,
}: Readonly<MultiSelectProps>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} selected`;

  const toggle = (v: string) => {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          'h-12 flex-row items-center justify-between rounded-xl border bg-card px-3',
          hasError ? 'border-destructive' : 'border-border',
          disabled && 'opacity-50',
        )}
      >
        <Text
          className={cn(
            'flex-1 text-sm',
            selectedLabels.length ? 'text-foreground' : 'text-muted-foreground',
          )}
          numberOfLines={1}
        >
          {summary}
        </Text>
        <Icon name="ChevronDown" size={18} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50" style={palette}>
          <Pressable
            className="flex-1"
            onPress={() => setOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View
            className="max-h-[70%] rounded-t-3xl bg-background"
            style={{ paddingBottom: 12 + insets.bottom }}
          >
            <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
              <Text className="text-base font-semibold text-foreground">Select</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text className="text-sm font-medium text-brand">Done</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {options.map((o) => (
                <OptionRow
                  key={o.value}
                  optValue={o.value}
                  label={o.label}
                  checked={value.includes(o.value)}
                  onToggle={toggle}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
