import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ListingStage } from '../types';

interface Props {
  stages: ListingStage[];
  stageCounts: Record<string, number>;
  /** Selected stage id; undefined = "All". */
  value: string | undefined;
  onChange: (stageId: string | undefined) => void;
}

function CountBadge({ count, active }: Readonly<{ count: number; active: boolean }>) {
  return (
    <View
      className={cn(
        'min-w-4 items-center justify-center rounded-full px-1',
        active ? 'bg-brand-foreground/20' : 'bg-muted',
      )}
    >
      <Text
        className={cn(
          'text-[10px] font-bold',
          active ? 'text-brand-foreground' : 'text-muted-foreground',
        )}
      >
        {count}
      </Text>
    </View>
  );
}

export function ListingsStagePills({ stages, stageCounts, value, onChange }: Readonly<Props>) {
  if (stages.length === 0) return null;

  const totalCount = Object.values(stageCounts).reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="mt-2"
    >
      <Pressable
        onPress={() => onChange(undefined)}
        className={cn(
          'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
          value === undefined ? 'bg-brand' : 'border border-border bg-card',
        )}
      >
        <Text
          className={cn(
            'text-xs font-semibold',
            value === undefined ? 'text-brand-foreground' : 'text-foreground',
          )}
        >
          All
        </Text>
        {totalCount > 0 ? <CountBadge count={totalCount} active={value === undefined} /> : null}
      </Pressable>

      {stages.map((stage) => {
        const active = stage.id === value;
        const count = stageCounts[stage.id] ?? 0;
        return (
          <Pressable
            key={stage.id}
            onPress={() => onChange(active ? undefined : stage.id)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
              active ? 'bg-brand' : 'border border-border bg-card',
            )}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stage.color }} />
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-foreground',
              )}
              numberOfLines={1}
            >
              {stage.name}
            </Text>
            {count > 0 ? <CountBadge count={count} active={active} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
