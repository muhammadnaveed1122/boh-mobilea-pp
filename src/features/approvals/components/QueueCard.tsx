import * as React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Badge } from '@/components/atoms/Badge';
import { Dot } from '@/components/atoms/Dot';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApprovalQueueDef } from '../constants/queues';

export function QueueCard({
  def,
  onPress,
  showDot = false,
}: Readonly<{ def: ApprovalQueueDef; onPress: () => void; showDot?: boolean }>) {
  const chevron = useThemeColor('--muted-foreground');
  const disabled = def.deferred;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border border-border bg-background p-4',
        disabled ? 'opacity-60' : 'active:opacity-70',
      )}
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-foreground">{def.label}</Text>
          {showDot ? <Dot /> : null}
          {disabled ? (
            <Badge variant="mutedSoft">
              <Text>Coming soon</Text>
            </Badge>
          ) : null}
        </View>
        <Text numberOfLines={2} className="mt-1 text-sm text-muted-foreground">
          {def.subtitle}
        </Text>
      </View>
      {!disabled ? <ChevronRight size={18} color={chevron} /> : null}
    </Pressable>
  );
}
