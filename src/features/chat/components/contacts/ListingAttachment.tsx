/**
 * Attach / preview / remove control for a listing-card template's image header.
 *
 * Shared by every send surface — single chat, channel broadcast and
 * multi-contact broadcast — so the attachment reads and behaves identically
 * wherever a `property_listing`-style template is chosen.
 */

import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import type { ListingCard } from '../../models/contact';

interface Props {
  listing: ListingCard | null;
  /** True when the chosen template declares an IMAGE header, making this required. */
  required: boolean;
  onPick: () => void;
  onClear: () => void;
}

export function ListingAttachment({ listing, required, onPick, onClear }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const border = useThemeColor('--border');

  return (
    <View className="gap-2">
      <Text variant="label">Listing{required ? '' : ' (optional)'}</Text>

      {listing === null ? (
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel="Attach a listing"
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border active:opacity-70"
        >
          <Icon name="Building2" size={18} color={mutedFg} />
          <Text className="font-medium text-foreground">Attach listing</Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center gap-3 rounded-xl bg-card p-2">
          <Image
            source={{ uri: listing.imageUrl }}
            accessibilityIgnoresInvertColors
            style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: border }}
          />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {listing.title}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {listing.location !== '' ? `${listing.location} · ` : ''}
              {listing.priceLabel}
            </Text>
          </View>
          <Pressable
            onPress={onClear}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove attached listing"
            className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
          >
            <Icon name="X" size={18} color={mutedFg} />
          </Pressable>
        </View>
      )}

      {required && listing === null ? (
        <Text variant="error" className="text-xs">
          This template shows a photo, so a listing must be attached before sending.
        </Text>
      ) : null}
    </View>
  );
}
