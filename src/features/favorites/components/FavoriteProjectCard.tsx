// src/features/favorites/components/FavoriteProjectCard.tsx
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatAed } from '@/features/new-projects/utils/format';
import { useThemeColor } from '@theme';
import { FavoriteHeartButton } from './FavoriteHeartButton';
import { FavoriteResourceKind, type ClientFavoriteProjectItem } from '../types';

export function FavoriteProjectCard({ item }: Readonly<{ item: ClientFavoriteProjectItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');

  return (
    <Pressable
      onPress={() => {
        if (item.slug) router.push(`/new-projects/${item.slug}`);
      }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      {item.heroImageUrl ? (
        <Image
          source={{ uri: item.heroImageUrl }}
          className="h-44 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-44 w-full items-center justify-center bg-muted">
          <Icon name="Image" size={28} color={mutedFg} />
        </View>
      )}
      <FavoriteHeartButton
        kind={FavoriteResourceKind.PROJECT}
        id={item.projectId}
        className="absolute right-3 top-3"
      />
      <View className="p-3">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.projectName}
        </Text>
        {item.locationLine ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Icon name="MapPin" size={12} color={mutedFg} />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {item.locationLine}
            </Text>
          </View>
        ) : null}
        {typeof item.startingPrice === 'number' ? (
          <Text className="mt-2 text-sm font-bold text-brand">{formatAed(item.startingPrice)}</Text>
        ) : null}
        <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
          {item.developer.brandName}
        </Text>
      </View>
    </Pressable>
  );
}
