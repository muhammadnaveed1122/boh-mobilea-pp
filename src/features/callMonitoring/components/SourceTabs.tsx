import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { SOURCE_TABS, type SourceTabKey } from '../constants';

interface Props {
  value: SourceTabKey;
  onChange: (key: SourceTabKey) => void;
  countFor: (key: SourceTabKey) => number | undefined;
}

export function SourceTabs({ value, onChange, countFor }: Readonly<Props>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {SOURCE_TABS.map((t) => {
        const active = value === t.key;
        const count = countFor(t.key);
        return (
          <Pressable
            key={t.key || 'all'}
            onPress={() => onChange(t.key)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-4 py-1.5',
              active ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active ? 'text-primary-foreground' : 'text-secondary-foreground',
              )}
            >
              {t.label}
            </Text>
            {count !== undefined ? (
              <View className={cn('rounded-full px-1.5', active ? 'bg-white/20' : 'bg-background')}>
                <Text
                  className={cn(
                    'text-xs',
                    active ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
