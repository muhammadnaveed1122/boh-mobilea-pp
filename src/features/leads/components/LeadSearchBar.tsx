import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { useThemeColor } from '@theme';
import { useLeadsFilterStore } from '../store/filter.store';

export function LeadSearchBar() {
  const mutedColor = useThemeColor('--muted-foreground');
  const searchInput = useLeadsFilterStore((s) => s.searchInput);
  const setSearchInput = useLeadsFilterStore((s) => s.setSearchInput);

  return (
    <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
      <Icon name="Search" size={18} color={mutedColor} />
      <Input
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search by name, email or phone..."
        className="h-11 flex-1 border-0 bg-transparent px-0"
      />
    </View>
  );
}
