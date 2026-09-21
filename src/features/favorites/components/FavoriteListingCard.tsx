// src/features/favorites/components/FavoriteListingCard.tsx
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatAed } from '@/features/new-projects/utils/format';
import { useThemeColor } from '@theme';
import { FavoriteHeartButton } from './FavoriteHeartButton';
import { FavoriteResourceKind, type ClientFavoriteListingItem } from '../types';

export function FavoriteListingCard({ item }: Readonly<{ item: ClientFavoriteListingItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const listing = item.listing;
  const beds = listing.unitType?.bedrooms;
  const baths = listing.unitType?.bathrooms;

  return (
    <Pressable
      onPress={() => {
        const slug = listing.project?.slug;
        if (slug) router.push(`/new-projects/${slug}`);
      }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      {listing.heroImageUrl ? (
        <Image
          source={{ uri: listing.heroImageUrl }}
          className="h-44 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-44 w-full items-center justify-center bg-muted">
          <Icon name="Image" size={28} color={mutedFg} />
        </View>
      )}
      <FavoriteHeartButton
        kind={FavoriteResourceKind.LISTING}
        id={listing.id}
        className="absolute right-3 top-3"
      />
      <View className="p-3">
        {typeof listing.price === 'number' ? (
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {formatAed(listing.price)}
          </Text>
        ) : null}
        <Text className="mt-0.5 text-sm font-medium text-foreground" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {listing.project?.projectName}
        </Text>
        <View className="mt-2 flex-row items-center gap-3">
          {beds ? (
            <View className="flex-row items-center gap-1">
              <Icon name="Bed" size={13} color={mutedFg} />
              <Text className="text-xs text-muted-foreground">{beds}</Text>
            </View>
          ) : null}
          {baths ? (
            <View className="flex-row items-center gap-1">
              <Icon name="Bath" size={13} color={mutedFg} />
              <Text className="text-xs text-muted-foreground">{baths}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
