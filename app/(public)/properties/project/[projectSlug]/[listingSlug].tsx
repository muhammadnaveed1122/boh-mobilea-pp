import { useLocalSearchParams } from 'expo-router';
import { PropertyDetailScreen } from '@/features/properties/components/PropertyDetailScreen';

export default function BuyListingDetailRoute() {
  const { projectSlug, listingSlug, rent } = useLocalSearchParams<{
    projectSlug: string;
    listingSlug: string;
    rent?: string;
  }>();
  return (
    <PropertyDetailScreen
      target={{ kind: 'buy-project', projectSlug, listingSlug }}
      isRent={rent === '1'}
    />
  );
}
