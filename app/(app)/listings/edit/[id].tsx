import { Redirect, useLocalSearchParams } from 'expo-router';
import { ListingWizard } from '@/features/listing-wizard/components/ListingWizard';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function EditListingRoute() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isPrimary = kind === 'primary';
  const state = useRequirePermission(
    isPrimary ? PERMISSIONS.LISTINGS_UPDATE : PERMISSIONS.OPPORTUNITY_LISTING_UPDATE,
  );

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/listings" />;

  return <ListingWizard editListingId={id} editKind={isPrimary ? 'primary' : 'secondary'} />;
}
