import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';

import { useCommunityGeocode } from '../../hooks/use-wizard-options';
import { slugifyUrlSlug, type WizardWebsiteContent } from '../../portals.model';
import { CommunityMap } from '../CommunityMap';
import { LabeledInput, LabeledTextarea } from './LabeledField';

/**
 * "Our Website Content" block shown under the Our-website toggle — mirrors the web
 * `ListingContentWorkflowTab` in `websiteContentOnly` mode: Subtitle, About this Property,
 * Highlights, Location & Connectivity, and Generate SEO.
 */
export function WebsiteContentSection({
  value,
  onChange,
  title,
  heroDescription,
}: Readonly<{
  value: WizardWebsiteContent;
  onChange: (next: WizardWebsiteContent) => void;
  /** Hero title from the Description step — seeds the map community + Generate SEO. */
  title: string;
  /** Hero description — the primary SEO meta-description source. */
  heroDescription: string;
}>) {
  const set = (patch: Partial<WizardWebsiteContent>) => onChange({ ...value, ...patch });
  const setLoc = (patch: Partial<WizardWebsiteContent['location']>) =>
    onChange({ ...value, location: { ...value.location, ...patch } });
  const setSeo = (patch: Partial<WizardWebsiteContent['seo']>) =>
    onChange({ ...value, seo: { ...value.seo, ...patch } });

  const geocodeName = value.location.locationName.trim() || title.trim();
  const { data: geo } = useCommunityGeocode(geocodeName);

  // Seed lat/lng from the geocode once per resolved point (guarded so it can't loop).
  useEffect(() => {
    if (
      geo &&
      (geo.latitude !== value.location.latitude || geo.longitude !== value.location.longitude)
    ) {
      setLoc({ latitude: geo.latitude, longitude: geo.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo?.latitude, geo?.longitude]);

  const generateSeo = () => {
    const heroTitle = title.trim();
    if (heroTitle === '') {
      showToast('error', 'Add a title first to generate SEO.');
      return;
    }
    const descriptionSource =
      heroDescription.trim() !== '' ? heroDescription.trim() : value.textSection1.trim();
    setSeo({
      metaTitle: value.seo.metaTitle.trim() === '' ? heroTitle : value.seo.metaTitle,
      urlSlug: slugifyUrlSlug(heroTitle),
      metaDescription:
        value.seo.metaDescription.trim() === '' ? descriptionSource : value.seo.metaDescription,
    });
    showToast('success', 'SEO generated from the listing.');
  };

  return (
    <View className="gap-4">
      {/* Hero & Basics — website subtitle (title lives on the Description step). */}
      <SubBlock
        title="Hero & Basics"
        caption="The subtitle shown on the website hero."
        action={
          <Button variant="outline" size="sm" onPress={generateSeo}>
            <Icon name="Sparkles" size={14} />
            <Text>Generate SEO</Text>
          </Button>
        }
      >
        <LabeledInput
          label="Subtitle"
          required
          value={value.subtitle}
          onChangeText={(t) => set({ subtitle: t })}
          placeholder="Subtitle"
        />
      </SubBlock>

      <SubBlock title="About this Property">
        <LabeledInput
          label="Title"
          value={value.aboutTitle}
          onChangeText={(t) => set({ aboutTitle: t })}
          placeholder="Title"
        />
        <LabeledInput
          label="Subtitle"
          value={value.aboutSubtitle}
          onChangeText={(t) => set({ aboutSubtitle: t })}
          placeholder="Subtitle"
        />
        <LabeledTextarea
          label="Text Section 1 (Main Description)"
          required
          value={value.textSection1}
          onChangeText={(t) => set({ textSection1: t })}
          placeholder="Main description"
          numberOfLines={3}
        />
        <LabeledTextarea
          label="Text Section 2 (Architectural Description)"
          value={value.textSection2}
          onChangeText={(t) => set({ textSection2: t })}
          placeholder="Architectural description"
          numberOfLines={2}
        />
        <LabeledTextarea
          label="Additional Helping Description (Optional)"
          value={value.additionalDescription}
          onChangeText={(t) => set({ additionalDescription: t })}
          placeholder="Additional helping description"
        />
      </SubBlock>

      <SubBlock title="Highlights">
        <LabeledInput
          label="Title"
          value={value.highlightsTitle}
          onChangeText={(t) => set({ highlightsTitle: t })}
          placeholder="Highlights title"
        />
        <LabeledInput
          label="Subtitle"
          value={value.highlightsSubtitle}
          onChangeText={(t) => set({ highlightsSubtitle: t })}
          placeholder="Highlights subtitle"
        />
      </SubBlock>

      <SubBlock title="Location & Connectivity">
        <LabeledInput
          label="Heading"
          value={value.location.heading}
          onChangeText={(t) => setLoc({ heading: t })}
          placeholder="e.g. Perfectly Connected"
        />
        <LabeledInput
          label="Location Label"
          value={value.location.subtitle}
          onChangeText={(t) => setLoc({ subtitle: t })}
          placeholder="e.g. Downtown Dubai"
        />
        <LabeledInput
          label="Community (for map)"
          value={value.location.locationName}
          onChangeText={(t) => setLoc({ locationName: t })}
          placeholder="Community or area name"
        />
        <CommunityMap communityName={geocodeName} />
      </SubBlock>
    </View>
  );
}

/** A titled, bordered sub-block card — mirrors the web content sections. */
function SubBlock({
  title,
  caption,
  action,
  children,
}: Readonly<{
  title: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{title}</Text>
          {caption !== undefined ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{caption}</Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
