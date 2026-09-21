import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { CONFIG } from '@/lib/config';
import { usePublicProject } from '../hooks/use-public-project';
import { parsePrice } from '../utils/format';
import { AmenitiesSection } from './detail/AmenitiesSection';
import { BrochureDownloadModal } from './detail/BrochureDownloadModal';
import { FaqSection } from './detail/FaqSection';
import { FloorPlansSection } from './detail/FloorPlansSection';
import { HeroCarousel } from './detail/HeroCarousel';
import { HeroHeaderCard } from './detail/HeroHeaderCard';
import { ListingsSection } from './detail/ListingsSection';
import { LocationSection } from './detail/LocationSection';
import { OverviewSection } from './detail/OverviewSection';
import { PaymentPlanSection } from './detail/PaymentPlanSection';
import { ProceedOptionsSection } from './detail/ProceedOptionsSection';
import { ProjectDetailsSection } from './detail/ProjectDetailsSection';
import { StickyContactBar } from './detail/StickyContactBar';

interface Props {
  slug: string;
}

export function ProjectDetailScreen({ slug }: Readonly<Props>) {
  const { data, isLoading, error } = usePublicProject(slug);
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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
          Could not load project details.
        </Text>
      </View>
    );
  }

  const sections = data.sections;
  const projectName = data.projectName ?? sections.hero?.projectName ?? '';
  const projectId = data.projectId;
  const projectSlug = data.slug;
  const location = sections.hero?.locationLine ?? data.locationLine ?? null;
  const shareUrl = projectSlug ? `${CONFIG.WEB_BASE_URL}/new-projects/${projectSlug}` : undefined;
  const highlights = sections.highlights;
  const brochureUrl = highlights?.brochureUrl;

  const price = highlights
    ? parsePrice({
        startingPrice: highlights.startingPrice,
        publicStartingPrice: highlights.publicStartingPrice,
      })
    : 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <HeroCarousel
          hero={sections.hero}
          fallbackTitle={projectName}
          projectId={projectId}
          shareUrl={shareUrl}
        />
        <HeroHeaderCard title={projectName} location={location} highlights={highlights} />

        <OverviewSection overview={sections.overview} />
        <ProjectDetailsSection highlights={highlights} />
        <PaymentPlanSection paymentPlans={sections.paymentPlans} />
        <FloorPlansSection data={sections.unitTypesFloorPlans} />
        <AmenitiesSection amenities={sections.amenities} />
        <LocationSection location={sections.location} />
        <ListingsSection
          projectId={projectId}
          projectSlug={projectSlug}
          projectName={projectName}
        />
        <FaqSection faq={sections.faq} />
      </ScrollView>

      <StickyContactBar
        price={price}
        onContact={() => setContactOpen(true)}
        onBrochure={brochureUrl ? () => setBrochureOpen(true) : undefined}
      />

      <ProceedOptionsSection
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        projectId={projectId}
        projectSlug={projectSlug}
        projectName={projectName}
      />

      <BrochureDownloadModal
        visible={brochureOpen}
        onClose={() => setBrochureOpen(false)}
        projectId={projectId}
        projectSlug={projectSlug}
        projectName={projectName}
        brochureUrl={brochureUrl}
      />
    </View>
  );
}
