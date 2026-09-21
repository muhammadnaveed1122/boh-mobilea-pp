import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

interface Props {
  title: string;
  location?: string;
  priceLabel: string;
}

export function PropertyHeaderCard({ title, location, priceLabel }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="mx-4 -mt-6 rounded-3xl bg-card p-5 shadow-sm">
      <Text className="text-2xl font-bold text-foreground" numberOfLines={3}>
        {title}
      </Text>
      {location ? (
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Icon name="MapPin" size={13} color={mutedFg} />
          <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={2}>
            {location}
          </Text>
        </View>
      ) : null}
      <View className="mt-4">
        <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Unit Price
        </Text>
        <Text className="text-2xl font-bold text-brand">{priceLabel}</Text>
      </View>
    </View>
  );
}
