import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { usePropertyDetail } from '../hooks/use-property-detail';
import { buildListingCallContext } from '../utils/call-context';
import { listingWebUrl } from '../utils/web-url';
import type { PropertyDetailTarget } from '../types';
import { PropertyAbout } from './detail/PropertyAbout';
import { PropertyAgentCard } from './detail/PropertyAgentCard';
import { AmenitiesSection } from '@/features/new-projects/components/detail/AmenitiesSection';
import { toProjectAmenities } from '../utils/to-project-amenities';
import { unitPriceLabel } from '../utils/web-format';
import { PropertyCalculator } from './detail/PropertyCalculator/PropertyCalculator';
import { PropertyAttributes } from './detail/PropertyAttributes';
import { PropertyContactBar } from './detail/PropertyContactBar';
import { PropertyFaq } from './detail/PropertyFaq';
import { PropertyHeaderCard } from './detail/PropertyHeaderCard';
import { PropertyHero } from './detail/PropertyHero';
import { PropertyLocation } from './detail/PropertyLocation';
import { PropertyTrakheesi } from './detail/PropertyTrakheesi';

export function PropertyDetailScreen({
  target,
  isRent = false,
}: Readonly<{ target: PropertyDetailTarget; isRent?: boolean }>) {
  const { data, isLoading, error } = usePropertyDetail(target);
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <Text className="text-center text-sm text-muted-foreground">
          Could not load property details.
        </Text>
      </View>
    );
  }

  const withRentSuffix = (label: string) => (isRent && data.price > 0 ? `${label} /yr` : label);
  // Header shows the exact price; the contact bar uses the card's compact form so the
  // two surfaces agree and the label doesn't truncate in the narrow bar.
  const priceLabel = withRentSuffix(data.priceLabel);
  const barPriceLabel = withRentSuffix(unitPriceLabel(data.price));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <PropertyHero
          media={data.hero.media}
          title={data.title}
          favoriteId={data.listingId}
          shareUrl={listingWebUrl(target)}
        />
        <PropertyHeaderCard title={data.title} location={data.location} priceLabel={priceLabel} />
        <PropertyAttributes attributes={data.attributes} />
        <PropertyAbout about={data.about} />
        <AmenitiesSection amenities={toProjectAmenities(data.amenities)} />
        <PropertyLocation location={data.locationSection} />
        <PropertyCalculator price={data.price} />
        <PropertyTrakheesi trakheesi={data.trakheesi} />
        <PropertyFaq faq={data.faq} />
        <PropertyAgentCard agent={data.agent} />
      </ScrollView>

      <PropertyContactBar
        priceLabel={barPriceLabel}
        agent={data.agent}
        propertyName={data.title}
        callContext={buildListingCallContext(target, {
          reference: data.reference,
          listingId: data.listingId,
        })}
      />
    </View>
  );
}
