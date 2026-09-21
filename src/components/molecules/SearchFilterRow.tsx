import { Pressable, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

interface SearchFilterRowProps {
  value: string;
  onChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  placeholder?: string;
}

/**
 * Shared search + filter row used across listing/lead/call/project screens.
 * Bordered card pill with a leading search icon, clear button, and a brand
 * filter button showing an active-filter count badge.
 */
export function SearchFilterRow({
  value,
  onChange,
  onOpenFilters,
  filterCount,
  placeholder = 'Search…',
}: Readonly<SearchFilterRowProps>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const brandFg = useThemeColor('--brand-foreground');
  return (
    <View className="flex-row items-center gap-2 px-4 pt-2">
      <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
        <Icon name="Search" size={16} color={mutedFg} />
        <Input
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          className="h-11 flex-1 border-0 bg-transparent px-0 text-sm"
          returnKeyType="search"
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChange('')} hitSlop={8}>
            <Icon name="X" size={14} color={mutedFg} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onOpenFilters}
        className="relative h-11 w-11 items-center justify-center rounded-full bg-brand active:opacity-80"
        accessibilityLabel="Filters"
      >
        <Icon name="SlidersHorizontal" size={16} color={brandFg} />
        {filterCount > 0 ? (
          <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
            <Text className="text-[10px] font-bold text-white">{filterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
