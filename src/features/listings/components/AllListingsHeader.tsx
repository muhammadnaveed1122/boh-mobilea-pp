import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';

export function AllListingsHeader() {
  return (
    <View className="px-4 pb-2 pt-2">
      <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-brand/60">
        Secondary Market
      </Text>
      <Text className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Listings
      </Text>
    </View>
  );
}
