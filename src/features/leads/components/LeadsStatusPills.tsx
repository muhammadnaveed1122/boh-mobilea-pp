import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { STATUS_FILTERS, STATUS_LABEL, type LeadStatus } from '../types';

export type StatusPillValue = 'All' | LeadStatus;

const PILL_VALUES: readonly StatusPillValue[] = ['All', ...STATUS_FILTERS];

interface LeadsStatusPillsProps {
  value: StatusPillValue;
  onChange: (value: StatusPillValue) => void;
}

export function LeadsStatusPills({ value, onChange }: Readonly<LeadsStatusPillsProps>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="mt-3"
    >
      {PILL_VALUES.map((v) => {
        const active = v === value;
        const label = v === 'All' ? 'All' : STATUS_LABEL[v];
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            className={cn(
              'rounded-full px-4 py-2',
              active ? 'bg-brand' : 'border border-border bg-background',
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
      })}
    </ScrollView>
  );
}
