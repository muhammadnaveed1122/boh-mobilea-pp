import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useThemeColor } from '@theme';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
  label: string;
  count: number;
  icon: IconName;
  href: Href;
  className?: string;
}

/**
 * Navigation card: tinted icon, label + lead count, trailing chevron affordance.
 * Sizing is the caller's job — pass a width (or `flex-1`) via `className`.
 */
export function CategoryCard({ label, count, icon, href, className }: Readonly<CategoryCardProps>) {
  const foreground = useThemeColor('--foreground');
  const muted = useThemeColor('--muted-foreground');

  return (
    <Pressable
      onPress={() => router.push(href)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${label} leads, ${count}`}
      className={cn('rounded-2xl border border-border bg-card p-3.5', className)}
    >
      <View className="flex-row items-center justify-between">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <Icon name={icon} size={18} color={foreground} />
        </View>
        <Icon name="ChevronRight" size={18} color={muted} />
      </View>
      <Text className="mt-2.5 text-sm font-bold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {count} {count === 1 ? 'lead' : 'leads'}
      </Text>
    </Pressable>
  );
}
