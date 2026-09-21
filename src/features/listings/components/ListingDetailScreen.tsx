/**
 * ListingDetailScreen — read-only view of a single listing, secondary
 * (opportunity) or primary (project). `kind` selects the data source; both map
 * into the shared `ListingDetail` shape so one screen renders either.
 *
 * Edge-to-edge hero (photo or navy gradient) with the title/status/key facts
 * overlaid, then an overlapping rounded content sheet of stacked sections
 * (price, highlights, project details [primary], about, agent, purpose-specific
 * terms, amenities, regulatory, related). Purpose-aware: sale vs rent drive the
 * price badge, price period, and the terms card. The hero carries a placeholder
 * Edit action (no handler wired yet).
 */

import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { listingEditQueryOptions } from '@/features/listing-wizard/hooks/use-listing-edit-hydration';
import { useThemeColor } from '@theme';
import { useListingDetail } from '../hooks/use-listing-detail';
import { ListingDetailSkeleton } from './detail/ListingDetailSkeleton';
import { ImageCarousel } from './detail/ImageCarousel';
import { AgentCard } from './detail/AgentCard';
import { normalizeListingPurpose, type ListingKind } from '../types';
import {
  AboutSection,
  AmenitiesSection,
  HighlightsSection,
  PriceHeader,
  ProjectDetailsSection,
  PropertyTermsSection,
  RegulatorySection,
  RelatedListingsSection,
} from './detail/sections';

function ChromeWithTopBar({
  children,
  paddingTop,
}: Readonly<{ children: React.ReactNode; paddingTop: number }>) {
  return (
    <View className="flex-1 bg-background" style={{ paddingTop }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <BackButton />
        <Text className="text-base font-bold text-foreground">Listing</Text>
        <View style={{ width: 40 }} />
      </View>
      {children}
    </View>
  );
}

function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const destructive = useThemeColor('--destructive');
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Icon name="CircleAlert" size={32} color={destructive} />
      <Text className="mt-3 text-center text-base font-semibold text-destructive">{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
      </Pressable>
    </View>
  );
}

function NotFoundState() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Icon name="Inbox" size={32} />
      <Text className="mt-3 text-base text-muted-foreground">Listing not found</Text>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/listings');
        }}
        accessibilityRole="button"
        className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-brand-foreground">Go back</Text>
      </Pressable>
    </View>
  );
}

export interface ListingDetailScreenProps {
  id: string;
  /** Which source to fetch from: `secondary` (opportunity, default) or `primary` (project). */
  kind?: ListingKind;
  /** Optional sale/rent hint from the list route, shown until the payload loads. */
  purposeHint?: string;
}

export function ListingDetailScreen({
  id,
  kind = 'secondary',
  purposeHint,
}: Readonly<ListingDetailScreenProps>) {
  const insets = useSafeAreaInsets();
  const { data: listing, isLoading, isError, error, refetch } = useListingDetail(id, kind);

  // Warm the edit-prefill bundle in the background (only for users who can edit)
  // so tapping Edit opens instantly from cache instead of re-fetching.
  const queryClient = useQueryClient();
  const canEdit = useCan(
    kind === 'primary' ? PERMISSIONS.LISTINGS_UPDATE : PERMISSIONS.OPPORTUNITY_LISTING_UPDATE,
  );
  useEffect(() => {
    if (!id || !canEdit) return;
    queryClient.prefetchQuery(listingEditQueryOptions(id, kind)).catch(() => {});
  }, [id, kind, canEdit, queryClient]);

  if (isLoading) {
    return (
      <ChromeWithTopBar paddingTop={insets.top}>
        <ListingDetailSkeleton />
      </ChromeWithTopBar>
    );
  }

  if (isError) {
    return (
      <ChromeWithTopBar paddingTop={insets.top}>
        <ErrorState
          message={error?.message ?? 'Failed to load listing'}
          onRetry={() => {
            refetch().catch(() => {});
          }}
        />
      </ChromeWithTopBar>
    );
  }

  if (!listing) {
    return (
      <ChromeWithTopBar paddingTop={insets.top}>
        <NotFoundState />
      </ChromeWithTopBar>
    );
  }

  // Payload purpose wins; fall back to the route hint until it loads.
  const purpose =
    normalizeListingPurpose(listing.derived.purpose) ?? normalizeListingPurpose(purposeHint);

  // Open the wizard in edit mode for this listing's branch.
  const handleEdit = (): void => {
    router.push({ pathname: '/listings/edit/[id]', params: { id, kind } });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ImageCarousel detail={listing} topInset={insets.top} onEdit={handleEdit} />

        {/* Content sheet overlaps the carousel with a rounded top edge. */}
        <View className="-mt-5 rounded-t-3xl bg-background px-4 pt-5">
          <PriceHeader detail={listing} purpose={purpose} />
          <HighlightsSection detail={listing} purpose={purpose} />
          <ProjectDetailsSection detail={listing} />
          <AboutSection detail={listing} />
          <AgentCard agent={listing.agentInfo} />
          <PropertyTermsSection detail={listing} purpose={purpose} />
          <AmenitiesSection detail={listing} />
          <RegulatorySection detail={listing} />
          <RelatedListingsSection detail={listing} />
        </View>
      </ScrollView>
    </View>
  );
}
