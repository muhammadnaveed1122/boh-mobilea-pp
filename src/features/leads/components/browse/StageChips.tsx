import { Pressable, ScrollView } from 'react-native';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadStatus } from '@/features/leads/types';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface StageChipsProps {
  value: LeadStatus | null;
  onChange: (stage: LeadStatus | null) => void;
}

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
        'mr-2 rounded-full border px-3.5 py-2',
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

export function StageChips({ value, onChange }: Readonly<StageChipsProps>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      <Chip label="All" active={value === null} onPress={() => onChange(null)} />
      {BOARD_STAGE_ORDER.map((st) => (
        <Chip
          key={st}
          label={STATUS_LABEL[st]}
          active={value === st}
          onPress={() => onChange(st)}
        />
      ))}
    </ScrollView>
  );
}
