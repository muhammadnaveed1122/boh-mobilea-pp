import { Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
import { useThemeColor } from '@theme';
import { usePublicListings } from '../../hooks/use-public-listings';
import type { PublicListingItem } from '../../types';
import { formatAed } from '../../utils/format';
import { SectionWrap } from './SectionWrap';

interface Props {
  projectId: string | undefined;
  projectSlug: string | null | undefined;
  projectName: string;
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

function ListingCard({
  item,
  projectSlug,
}: Readonly<{ item: PublicListingItem; projectSlug: string | null | undefined }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const price = formatAed(toNumber(item.price));
  const size = toNumber(item.area ?? item.size);
  const beds = item.bedrooms;
  const baths = item.bathrooms;

  return (
    <Pressable
      onPress={() => {
        if (projectSlug && item.slug) {
          router.push({
            pathname: '/(public)/projects/[id]',
            params: { id: `${projectSlug}/${item.slug}` },
          } as never);
        }
      }}
      className="relative w-64 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      {item.heroImageUrl ? (
        <Image
          source={{ uri: item.heroImageUrl }}
          className="h-36 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-36 w-full items-center justify-center bg-muted">
          <Icon name="Image" size={28} color={mutedFg} />
        </View>
      )}
      <FavoriteHeartButton
        kind={FavoriteResourceKind.LISTING}
        id={item.id}
        className="absolute right-2 top-2"
      />
      <View className="p-3">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {price}
        </Text>
        <Text className="mt-0.5 text-sm font-medium text-foreground" numberOfLines={1}>
          {item.title ?? item.propertyType ?? 'Unit'}
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
          {size ? (
            <View className="flex-row items-center gap-1">
              <Icon name="Maximize" size={13} color={mutedFg} />
              <Text className="text-xs text-muted-foreground">{size.toLocaleString()} sqft</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ListingsSection({ projectId, projectSlug, projectName }: Readonly<Props>) {
  const { data, isLoading } = usePublicListings(projectId);
  if (isLoading) return null;
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <SectionWrap title="Available Properties" tagline={`In ${projectName}`} flush>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 4 }}
      >
        {items.map((it) => (
          <ListingCard key={it.id} item={it} projectSlug={projectSlug} />
        ))}
      </ScrollView>
    </SectionWrap>
  );
}
