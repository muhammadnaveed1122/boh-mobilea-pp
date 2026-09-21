import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { PROPERTY_EMAIL } from '../constants';
import type { AssignedAgent, PropertyCard as PropertyCardModel } from '../types';
import { buildListingCallContext, cardTarget } from '../utils/call-context';
import { buildInquiryWhatsAppUrl } from '../utils/inquiry';
import { ListingCallDialog } from './detail/ListingCallDialog';
import { PropertyImageCarousel } from './PropertyImageCarousel';

/**
 * Compact list card. Height is the design constraint: the previous layout ran
 * ~436pt, so barely one card fitted a phone viewport. This one lands ~300pt by
 * shortening the image, folding the price into the stats band, and merging the
 * agent strip with the contact actions into a single row.
 */
const IMAGE_HEIGHT = 150;

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}

/** Web mails the assigned agent when there is one, else the company address. */
function emailHref(title: string, agentEmail?: string | null): string {
  const subject = encodeURIComponent(`Inquiry: ${title}`);
  return `mailto:${agentEmail?.trim() || PROPERTY_EMAIL}?subject=${subject}`;
}

function openDetail(card: PropertyCardModel, isRent: boolean): void {
  const rentParam = isRent ? { rent: '1' } : {};
  if (card.kind === 'opportunity') {
    router.push({
      pathname: '/properties/opportunity/[slug]',
      params: { slug: card.slug ?? '', ...rentParam },
    });
    return;
  }
  router.push({
    pathname: '/properties/project/[projectSlug]/[listingSlug]',
    params: {
      projectSlug: card.projectSlug ?? '',
      listingSlug: card.listingSlug ?? '',
      ...rentParam,
    },
  });
}

function Stat({ icon, value }: Readonly<{ icon: IconName; value: string }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={14} color={mutedFg} />
      <Text className="text-xs text-foreground">{value}</Text>
    </View>
  );
}

function Badge({ label }: Readonly<{ label: string }>) {
  return (
    <View
      className="absolute left-3 top-3 flex-row items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <View
        className={`h-1.5 w-1.5 rounded-full ${label === 'Ready' ? 'bg-emerald-400' : 'bg-amber-400'}`}
      />
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Agent identity, shown inline with the contact actions to save vertical space. */
function AgentIdentity({ agent }: Readonly<{ agent: AssignedAgent }>) {
  const avatar = agent.avatarUrl?.trim();
  return (
    <View className="flex-1 flex-row items-center gap-2">
      {avatar ? (
        <Image source={{ uri: avatar }} className="h-8 w-8 rounded-full" />
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Text className="text-[11px] font-semibold text-muted-foreground">
            {initials(agent.name)}
          </Text>
        </View>
      )}
      <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>
        {agent.name}
      </Text>
    </View>
  );
}

type ContactTone = 'call' | 'email' | 'whatsapp';

const TONE_STYLES: Record<ContactTone, { bg: string; color: string }> = {
  call: { bg: 'bg-destructive/10', color: '#E5484D' },
  email: { bg: 'bg-muted', color: '#64748B' },
  whatsapp: { bg: 'bg-[#25D366]/15', color: '#1FA855' },
};

/**
 * Icon-only to keep the row short. The visual circle is 40pt but `hitSlop`
 * lifts the touch target past the 44pt minimum.
 */
function ContactButton({
  icon,
  label,
  tone,
  onPress,
}: Readonly<{ icon: IconName; label: string; tone: ContactTone; onPress: () => void }>) {
  const style = TONE_STYLES[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
      className={`h-10 w-10 items-center justify-center rounded-full ${style.bg}`}
    >
      <Icon name={icon} size={18} color={style.color} />
    </Pressable>
  );
}

export function PropertyCard({
  card,
  isRent = false,
}: Readonly<{ card: PropertyCardModel; isRent?: boolean }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const [callOpen, setCallOpen] = useState(false);
  // `favoriteId` is the listing UUID for both sources — the id the callback lead attributes to.
  const callContext = buildListingCallContext(cardTarget(card), {
    reference: card.reference,
    listingId: card.favoriteId,
  });

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      {/*
        The carousel sits OUTSIDE the card's Pressable on purpose: a Pressable
        wrapping a horizontal FlatList wins the touch responder, so swipes and
        the video controls never reach it. Only the text block opens the detail.
      */}
      <PropertyImageCarousel media={card.media} height={IMAGE_HEIGHT}>
        {card.badge ? <Badge label={card.badge} /> : null}
      </PropertyImageCarousel>

      <Pressable
        onPress={() => openDetail(card, isRent)}
        accessibilityRole="button"
        accessibilityLabel={`${card.title}, ${card.priceLabel}`}
        style={({ pressed }) => (pressed ? { opacity: 0.95 } : undefined)}
      >
        <View className="px-3 pb-2.5 pt-3">
          {card.propertyType ? (
            <Text className="mb-0.5 text-[11px] text-muted-foreground">{card.propertyType}</Text>
          ) : null}

          <Text className="text-[15px] font-bold leading-5 text-foreground" numberOfLines={2}>
            {card.title}
          </Text>

          {card.location ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name="MapPin" size={13} color={mutedFg} />
              <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                {card.location}
              </Text>
            </View>
          ) : null}

          {/* Price and stats share one band — the tallest saving vs. stacking them. */}
          <View className="mt-2.5 flex-row items-end justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[11px] text-muted-foreground">Unit Price</Text>
              <Text
                className="text-base font-bold text-foreground"
                numberOfLines={1}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {card.priceLabel}
              </Text>
            </View>

            <View className="flex-row items-center gap-3 pb-0.5">
              {typeof card.beds === 'number' ? (
                <Stat icon="BedDouble" value={`${card.beds}BR`} />
              ) : null}
              {typeof card.baths === 'number' ? (
                <Stat icon="Bath" value={`${card.baths} Baths`} />
              ) : null}
              {card.area ? <Stat icon="Maximize" value={card.area} /> : null}
            </View>
          </View>
        </View>
      </Pressable>

      {/* Agent identity and the contact actions share a row to keep the card short. */}
      <View className="flex-row items-center gap-2 border-t border-border px-3 py-2">
        {card.assignedAgent ? (
          <AgentIdentity agent={card.assignedAgent} />
        ) : (
          <View className="flex-1" />
        )}
        {/* Call opens the same popup web's card shows — agent, company line, and the reference
            to quote — instead of dialling straight away. */}
        <ContactButton
          icon="Phone"
          label={`Call about ${card.title}`}
          tone="call"
          onPress={() => setCallOpen(true)}
        />
        <ContactButton
          icon="Mail"
          label={`Email about ${card.title}`}
          tone="email"
          onPress={() => openUrl(emailHref(card.title, card.assignedAgent?.email))}
        />
        <ContactButton
          icon="MessageCircle"
          label={`WhatsApp about ${card.title}`}
          tone="whatsapp"
          onPress={() =>
            openUrl(
              buildInquiryWhatsAppUrl(card.title, {
                reference: callContext.reference,
                fallbackId: card.favoriteId,
                propertyUrl: callContext.pageUrl,
              }),
            )
          }
        />
      </View>

      {/* Mounted only while open — a feed renders many cards, and the dialog carries a form
          and a mutation. */}
      {callOpen ? (
        <ListingCallDialog
          visible
          onClose={() => setCallOpen(false)}
          agent={
            card.assignedAgent
              ? {
                  name: card.assignedAgent.name,
                  avatarUrl: card.assignedAgent.avatarUrl ?? undefined,
                }
              : undefined
          }
          context={callContext}
        />
      ) : null}
    </View>
  );
}
