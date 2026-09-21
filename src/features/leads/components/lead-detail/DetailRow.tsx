import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export interface DetailRowProps {
  label: string;
  children: ReactNode;
  last?: boolean;
}

/**
 * Single read-only row in a lead-detail card. Label on the left, value
 * (string or arbitrary node) on the right. Bottom border unless `last`.
 */
export function DetailRow({ label, children, last }: Readonly<DetailRowProps>) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between gap-3 py-3',
        last ? '' : 'border-b border-border/40',
      )}
    >
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="max-w-[70%] flex-shrink items-end">
        {typeof children === 'string' ? (
          <Text className="text-right text-sm font-semibold text-foreground" numberOfLines={2}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
