import * as React from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { type Href, router } from 'expo-router';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatRelative } from '@/lib/format/date';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { AreaListingItem } from '../models/area-detail';

function titleCase(raw: string): string {
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compact label/value cell used in the card's meta grid. */
function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="w-1/3 pr-3">
      <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text numberOfLines={1} className="text-[13px] font-medium text-foreground">
        {value}
      </Text>
    </View>
  );
}

/** Translucent badge overlaid on the hero image (Type / Status). */
function OverlayPill({
  label,
  tone = 'default',
}: Readonly<{ label: string; tone?: 'default' | 'danger' }>) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-0.5',
        tone === 'danger' ? 'bg-destructive' : 'bg-black/60',
      )}
    >
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </View>
  );
}

/** Hero image with image-count badge, Type/Status overlay pills, selection checkbox. */
function CardHero({
  item,
  selectable,
  selected,
}: Readonly<{ item: AreaListingItem; selectable: boolean; selected: boolean }>) {
  const hero = item.imageUrls[0];
  const checkColor = useThemeColor('--primary-foreground');
  const extra = item.imageUrls.length - 1;
  const hasOverlay = Boolean(item.availabilityType || item.status);
  return (
    <View className="aspect-[16/9] w-full bg-muted">
      {hero ? (
        <Image source={{ uri: hero }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Icon name="ImageOff" size={28} />
        </View>
      )}
      {hasOverlay ? (
        <View className="absolute left-2 top-2 flex-row flex-wrap gap-1.5">
          {item.availabilityType ? <OverlayPill label={titleCase(item.availabilityType)} /> : null}
          {item.status ? <OverlayPill label={titleCase(item.status)} /> : null}
        </View>
      ) : null}
      {extra > 0 ? (
        <View
          className={cn(
            'absolute right-2 rounded-full bg-black/60 px-2 py-0.5',
            selectable ? 'bottom-2' : 'top-2',
          )}
        >
          <Text className="text-[11px] font-semibold text-white">+{extra}</Text>
        </View>
      ) : null}
      {selectable ? (
        <View
          className={cn(
            'absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full border-2',
            selected ? 'border-primary bg-primary' : 'border-white bg-black/40',
          )}
        >
          {selected ? <Icon name="Check" size={16} color={checkColor} strokeWidth={3} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Trakheesi QR thumbnail; tap opens a larger view. Stops card-tap propagation. */
function TrakheesiQr({ url }: Readonly<{ url: string }>) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="View Trakheesi QR code"
        hitSlop={6}
      >
        <Image
          source={{ uri: url }}
          className="h-14 w-14 rounded-lg border border-border bg-white"
          resizeMode="contain"
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-center bg-black/70 p-8"
          accessibilityLabel="Close QR code"
        >
          <View className="items-center gap-3 rounded-2xl bg-white p-5">
            <Image source={{ uri: url }} className="h-72 w-72" resizeMode="contain" />
            <Text className="text-sm font-medium text-black">Trakheesi QR</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Optional Trakheesi Permit footer: permit pill + tappable QR thumbnail. */
function TrakheesiFooter({ item }: Readonly<{ item: AreaListingItem }>) {
  if (!item.trakheesiPermit) return null;
  return (
    <View className="flex-row items-center justify-between border-t border-border pt-2.5">
      <View className="flex-1 gap-1 pr-3">
        <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Trakheesi Permit
        </Text>
        <View className="flex-row">
          <OverlayPill
            label={titleCase(item.trakheesiPermit)}
            tone={item.trakheesiPermit === 'expired' ? 'danger' : 'default'}
          />
        </View>
      </View>
      {item.trakheesiQrCodeUrl ? <TrakheesiQr url={item.trakheesiQrCodeUrl} /> : null}
    </View>
  );
}

/**
 * Rich area-detail listing card. Hero image carries the image-count badge and
 * (when present) Type/Status overlay pills; the body groups title + price, a
 * labelled meta grid (Area / Developer-or-Owner / Handover / Bedrooms / Size /
 * Service Charge), and an optional Trakheesi footer (permit pill + tappable QR).
 * Taps route to the detail; in compare mode (`selectable`) taps toggle selection.
 */
export function AreaListingCard({
  item,
  selectable = false,
  selected = false,
  onToggleSelect,
}: Readonly<{
  item: AreaListingItem;
  /** When true, the card toggles selection (compare mode) instead of navigating. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}>) {
  const target = resolveTarget(item);

  const body = (
    <View
      className={cn(
        'overflow-hidden rounded-2xl border bg-card',
        selectable && selected ? 'border-primary' : 'border-border',
      )}
    >
      <CardHero item={item} selectable={selectable} selected={selected} />

      <View className="gap-2.5 p-3">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            {item.tag}
          </Text>
          {item.updatedAt ? (
            <Text className="text-[11px] text-muted-foreground">
              {formatRelative(item.updatedAt)}
            </Text>
          ) : null}
        </View>

        <View className="gap-0.5">
          <Text numberOfLines={2} className="text-base font-bold leading-snug text-foreground">
            {item.title}
          </Text>
          <Text className="text-lg font-bold tabular-nums text-foreground">{item.price}</Text>
        </View>

        <View className="mt-0.5 flex-row flex-wrap gap-y-3 border-t border-border pt-2.5">
          <Field label="Area" value={item.area} />
          <Field label={item.secondaryLabel} value={item.secondaryValue} />
          <Field label="Handover" value={item.handover} />
          <Field label="Bedrooms" value={item.bedrooms} />
          <Field label="Size" value={item.size} />
          <Field label="Service Charge" value={item.serviceCharge} />
        </View>

        <TrakheesiFooter item={item} />
      </View>
    </View>
  );

  if (!selectable && !target) return body;

  const handlePress = () => {
    if (selectable) {
      onToggleSelect?.();
      return;
    }
    if (target) router.push(target);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={selectable ? { selected } : undefined}
      accessibilityLabel={selectable ? `Select ${item.title}` : `Open ${item.title}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** Owner listings → listing detail; New-Projects rows → project-management detail. */
function resolveTarget(item: AreaListingItem): Href | null {
  if (item.listingId) return `/listings/${item.listingId}`;
  if (item.projectId) return `/project-management/${item.projectId}`;
  return null;
}
