import { useLocalSearchParams } from 'expo-router';
import { PropertyDetailScreen } from '@/features/properties/components/PropertyDetailScreen';

export default function OpportunityDetailRoute() {
  const { slug, rent } = useLocalSearchParams<{ slug: string; rent?: string }>();
  return <PropertyDetailScreen target={{ kind: 'opportunity', slug }} isRent={rent === '1'} />;
}
