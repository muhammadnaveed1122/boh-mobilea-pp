import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { STATUS_FILTERS, STATUS_LABEL, type ListingStatus } from '../types';
import { STATUS_DOT } from '../lib/visuals';

export type ListingStatusPillValue = 'All' | ListingStatus;

const PILL_VALUES: readonly ListingStatusPillValue[] = ['All', ...STATUS_FILTERS];

interface ListingsStatusPillsProps {
  value: ListingStatusPillValue;
  onChange: (value: ListingStatusPillValue) => void;
}

export function ListingsStatusPills({ value, onChange }: Readonly<ListingsStatusPillsProps>) {
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
        const dot = v === 'All' ? null : STATUS_DOT[v];
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-3.5 py-2',
              active ? 'bg-brand' : 'border border-border bg-card',
            )}
            style={
              active
                ? {
                    shadowColor: '#101827',
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 2,
                  }
                : undefined
            }
          >
            {dot ? (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
            ) : null}
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
