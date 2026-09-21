import { Redirect, useLocalSearchParams } from 'expo-router';
import { ListingDetailScreen } from '@/features/listings/components/ListingDetailScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ListingDetailRoute() {
  const { id, kind, purpose } = useLocalSearchParams<{
    id: string;
    kind?: string;
    purpose?: string;
  }>();
  const isPrimary = kind === 'primary';
  const state = useRequirePermission(
    isPrimary ? PERMISSIONS.LISTINGS_READ : PERMISSIONS.OPPORTUNITY_LISTING_READ,
  );

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/listings" />;

  // `purpose` is an instant-badge hint from the list; the payload value wins once loaded.
  return (
    <ListingDetailScreen id={id} kind={isPrimary ? 'primary' : 'secondary'} purposeHint={purpose} />
  );
}
