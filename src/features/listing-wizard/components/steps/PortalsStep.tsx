import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useMasterAmenities } from '../../hooks/use-master-amenities';
import { usePropertyFinderEnabled } from '../../hooks/use-wizard-options';
import type { WizardPublish, WizardWebsiteContent } from '../../portals.model';
import { getPropertyFinderAgents } from '../../services';
import { AmenitiesSelector } from '../AmenitiesSelector';
import { CollapsibleSection } from '../CollapsibleSection';
import { WizardCard } from '../WizardCard';
import { PortalRow } from './PortalRow';
import { PropertyFinderSection } from './PropertyFinderSection';
import { TrakheesiPermitSection } from './TrakheesiPermitSection';
import { WebsiteContentSection } from './WebsiteContentSection';

const DISABLED_PORTALS = [
  { key: 'bayut', label: 'Bayut', mark: 'BY' },
  { key: 'dubizzle', label: 'Dubizzle', mark: 'DZ' },
] as const;

export function PortalsStep({
  selectedAmenityIds,
  onSelectedChange,
  publish,
  onPublishChange,
  website,
  onWebsiteChange,
  heroTitle,
  heroDescription,
}: Readonly<{
  selectedAmenityIds: string[];
  onSelectedChange: (ids: string[]) => void;
  publish: WizardPublish;
  onPublishChange: (patch: Partial<WizardPublish>) => void;
  website: WizardWebsiteContent;
  onWebsiteChange: (next: WizardWebsiteContent) => void;
  heroTitle: string;
  heroDescription: string;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const amenities = useMasterAmenities();
  // Property Finder is gated by the admin Portals toggle (Platform Settings).
  const pfEnabled = usePropertyFinderEnabled();

  const pfAgents = useQuery({
    queryKey: ['property-finder-agents'],
    queryFn: getPropertyFinderAgents,
    enabled: publish.pushToPropertyFinder,
  });

  const anyCompliancePortalOn = publish.publishToPortal || publish.pushToPropertyFinder;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        {/* Amenities */}
        <CollapsibleSection
          icon="SquareStack"
          title="Amenities"
          description="Amenities shown on the listing and sent to Property Finder."
          defaultCollapsed
        >
          {amenities.isLoading ? (
            <View className="py-6">
              <ActivityIndicator color={brand} />
            </View>
          ) : amenities.isError ? (
            <Text className="py-2 text-sm text-destructive">
              Could not load amenities. Pull back and retry.
            </Text>
          ) : (
            <AmenitiesSelector
              options={amenities.data ?? []}
              selectedIds={selectedAmenityIds}
              onChange={onSelectedChange}
            />
          )}
        </CollapsibleSection>

        {/* Portals */}
        <WizardCard
          icon="Globe"
          title="Portals"
          description="Choose where this listing goes live. Our website is on by default."
        >
          <View className="gap-3">
            <PortalRow
              icon={<Icon name="Globe" size={18} color={brand} />}
              title="Our website"
              subtitle="Publishes the listing live on our website."
              checked={publish.publishToPortal}
              onChange={(checked) => onPublishChange({ publishToPortal: checked })}
            />

            {publish.publishToPortal ? (
              <WebsiteContentSection
                value={website}
                onChange={onWebsiteChange}
                title={heroTitle}
                heroDescription={heroDescription}
              />
            ) : null}

            {pfEnabled ? (
              <>
                <PortalRow
                  icon={<Icon name="Building2" size={18} color={brand} />}
                  title="Property Finder"
                  subtitle="Push this listing to Property Finder."
                  checked={publish.pushToPropertyFinder}
                  onChange={(checked) => onPublishChange({ pushToPropertyFinder: checked })}
                />

                {publish.pushToPropertyFinder ? (
                  <PropertyFinderSection
                    publish={publish}
                    onChange={onPublishChange}
                    agents={pfAgents.data ?? []}
                    agentsLoading={pfAgents.isLoading}
                  />
                ) : null}
              </>
            ) : null}

            {DISABLED_PORTALS.map((portal) => (
              <PortalRow
                key={portal.key}
                icon={
                  <Text className="text-xs font-bold text-muted-foreground">{portal.mark}</Text>
                }
                title={portal.label}
                subtitle="Coming soon — integration not available yet."
                checked={false}
                disabled
                onChange={() => {
                  // disabled — no-op
                }}
              />
            ))}
          </View>
        </WizardCard>

        {/* Trakheesi permit — only when a compliance portal is on. */}
        {anyCompliancePortalOn ? (
          <CollapsibleSection
            icon="ShieldCheck"
            title="Trakheesi Permit"
            description="DLD permit details required before the listing can be published."
          >
            <TrakheesiPermitSection
              permit={publish.permit}
              onChange={(patch) => onPublishChange({ permit: { ...publish.permit, ...patch } })}
            />
          </CollapsibleSection>
        ) : (
          <View className="flex-row items-center gap-2 px-1">
            <Icon name="Info" size={14} color={mutedFg} />
            <Text className="text-xs text-muted-foreground">
              Enable a portal to add the Trakheesi permit.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
