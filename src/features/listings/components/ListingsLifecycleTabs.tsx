import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ListingsLifecycle } from '../types';

interface Props {
  value: ListingsLifecycle;
  onChange: (v: ListingsLifecycle) => void;
  /** Label for the 'sold' tab — "Rented" on the rent page, "Sold" on sell. */
  soldLabel?: string;
}

export function ListingsLifecycleTabs({ value, onChange, soldLabel = 'Sold' }: Readonly<Props>) {
  const tabs: readonly { label: string; value: ListingsLifecycle }[] = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: soldLabel, value: 'sold' },
  ];
  return (
    <View className="mx-4 mt-2 flex-row rounded-full border border-border bg-card p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
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
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
