import { Pressable, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  left: { value: string; label: string };
  right: { value: string; label: string };
}

export function SegmentedToggle({ value, onChange, left, right }: Readonly<Props>) {
  return (
    <View className="flex-row rounded-full border border-border bg-card p-1">
      {[left, right].map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={cn(
              'flex-1 items-center rounded-full py-2',
              active ? 'bg-brand' : 'bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
