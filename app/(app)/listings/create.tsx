import { Redirect } from 'expo-router';
import { ListingWizard } from '@/features/listing-wizard/components/ListingWizard';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CreateListingRoute() {
  const state = useRequirePermission([
    PERMISSIONS.LISTINGS_CREATE,
    PERMISSIONS.OPPORTUNITY_LISTING_CREATE,
  ] as const);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/listings" />;
  return <ListingWizard />;
}
