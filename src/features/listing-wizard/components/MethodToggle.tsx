import { Pressable, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export type IdentityMethod = 'link' | 'manual';

const OPTIONS: { id: IdentityMethod; label: string }[] = [
  { id: 'link', label: 'Send Verification Link' },
  { id: 'manual', label: 'Manual Review' },
];

export function MethodToggle({
  value,
  onChange,
}: Readonly<{ value: IdentityMethod; onChange: (m: IdentityMethod) => void }>) {
  return (
    <View className="flex-row rounded-full bg-muted p-1">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            className={cn(
              'flex-1 items-center justify-center rounded-full py-2',
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
