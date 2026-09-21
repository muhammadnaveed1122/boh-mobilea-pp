import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import {
  formatAED,
  getListing,
  leadInitials,
  LEAD_STATUS_STYLES,
  STATUS_STYLES,
  type InterestedLead,
  type Listing,
  type ListingActivity,
} from '@/features/projects/data';

const CARD_DARK = '#1E1640';

type Tab = 'Details' | 'Activity';

function HeroChip({ icon, label }: Readonly<{ icon?: 'Clock' | 'Hash'; label: string }>) {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
      style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
    >
      {icon ? <Icon name={icon} size={12} color="white" /> : null}
      <Text className="text-xs font-medium text-white">{label}</Text>
    </View>
  );
}

interface ActionButtonProps {
  icon: 'Pencil' | 'Share2' | 'Eye';
  label: string;
  containerClassName: string;
  iconColor: string;
  textClassName: string;
}

function ActionButton({
  icon,
  label,
  containerClassName,
  iconColor,
  textClassName,
}: Readonly<ActionButtonProps>) {
  return (
    <Pressable
      className={`flex-1 items-center justify-center rounded-2xl py-4 active:opacity-80 ${containerClassName}`}
    >
      <Icon name={icon} size={20} color={iconColor} />
      <Text className={`mt-1 text-sm font-semibold ${textClassName}`}>{label}</Text>
    </Pressable>
  );
}

function DetailRow({
  label,
  children,
  last,
}: Readonly<{ label: string; children: React.ReactNode; last?: boolean }>) {
  return (
    <View
      className="flex-row items-center justify-between px-4 py-4"
      style={
        last ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgb(229 229 229 / 0.5)' }
      }
    >
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {typeof children === 'string' ? (
        <Text className="text-sm font-semibold text-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function InterestedLeadCard({ lead }: Readonly<{ lead: InterestedLead }>) {
  const brand = useThemeColor('--brand');
  const brandMuted = useThemeColor('--brand-muted');
  const s = LEAD_STATUS_STYLES[lead.status];
  return (
    <Pressable className="flex-row items-center rounded-2xl bg-card p-3 active:opacity-80">
      <View
        className="mr-3 h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: brandMuted }}
      >
        <Text className="text-sm font-bold" style={{ color: brand }}>
          {leadInitials(lead.name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-foreground">{lead.name}</Text>
        <Text className="text-xs text-muted-foreground">{lead.intent}</Text>
      </View>
      <View className="rounded-md px-2 py-1" style={{ backgroundColor: s.bg }}>
        <Text className="text-xs font-semibold" style={{ color: s.fg }}>
          {lead.status}
        </Text>
      </View>
    </Pressable>
  );
}

function ActivityItem({ entry, last }: Readonly<{ entry: ListingActivity; last: boolean }>) {
  const brand = useThemeColor('--brand');
  return (
    <View className="flex-row">
      <View className="items-center" style={{ width: 36 }}>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-muted">
          <Icon name={entry.icon} size={16} color={brand} />
        </View>
        {last ? null : (
          <View
            className="flex-1"
            style={{ width: 2, backgroundColor: 'rgb(229 229 229)', marginTop: 4 }}
          />
        )}
      </View>
      <View className="ml-3 flex-1 pb-5">
        <Text className="text-sm font-bold text-foreground">{entry.title}</Text>
        <Text className="text-xs text-muted-foreground">{entry.description}</Text>
        <Text className="mt-1 text-xs text-brand">{entry.timestamp}</Text>
      </View>
    </View>
  );
}

function DetailsTab({ listing }: Readonly<{ listing: Listing }>) {
  return (
    <View className="mx-4 mt-4 overflow-hidden rounded-2xl bg-card">
      <DetailRow label="Type">{listing.type}</DetailRow>
      <DetailRow label="Location">{listing.location}</DetailRow>
      <DetailRow label="Price">{formatAED(listing.priceAED)}</DetailRow>
      <DetailRow label="Bedrooms">{`${listing.beds}`}</DetailRow>
      <DetailRow label="Bathrooms">{`${listing.baths}`}</DetailRow>
      <DetailRow label="Size">{`${listing.sqft.toLocaleString('en-US')} sqft`}</DetailRow>
      <DetailRow label="Reference">{listing.reference}</DetailRow>
      <View className="items-center px-4 py-4">
        <Text className="text-sm text-muted-foreground">Description</Text>
        <Text className="mt-1 text-center text-sm text-foreground">{listing.description}</Text>
      </View>
    </View>
  );
}

function ActivityTab({ listing }: Readonly<{ listing: Listing }>) {
  if (listing.activity.length === 0) {
    return (
      <View className="mx-4 mt-4 items-center rounded-2xl bg-card p-8">
        <Icon name="Inbox" size={28} color="rgb(163 163 163)" />
        <Text className="mt-2 text-sm text-muted-foreground">No activity yet</Text>
      </View>
    );
  }
  return (
    <View className="mx-4 mt-4 rounded-2xl bg-card p-4">
      {listing.activity.map((e, i) => (
        <ActivityItem key={e.id} entry={e} last={i === listing.activity.length - 1} />
      ))}
    </View>
  );
}

export function ProjectDetailScreen({ id }: Readonly<{ id: string }>) {
  const insets = useSafeAreaInsets();
  const brand = useThemeColor('--brand');
  const [tab, setTab] = useState<Tab>('Details');
  const listing = getListing(id);

  if (!listing) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-base text-muted-foreground">Listing not found</Text>
        <Pressable className="mt-4" onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-brand">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = STATUS_STYLES[listing.status];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <BackButton />
        <Text className="text-xl font-bold text-foreground">Listing Detail</Text>
        <Text className="text-sm font-semibold" style={{ color: statusStyle.fg }}>
          {listing.status}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-4 mt-2 rounded-3xl p-5" style={{ backgroundColor: CARD_DARK }}>
          <View className="flex-row items-start">
            <View
              className="mr-3 h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <Icon name="Building2" size={26} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">{listing.title}</Text>
              <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {listing.location}
              </Text>
              <Text className="mt-1 text-base font-bold text-white">
                {formatAED(listing.priceAED)}
              </Text>
            </View>
            <View className="rounded-md px-2 py-1" style={{ backgroundColor: statusStyle.bg }}>
              <Text className="text-xs font-semibold" style={{ color: statusStyle.fg }}>
                {listing.status}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            <HeroChip label={`${listing.type} · ${listing.beds}bd · ${listing.baths}ba`} />
            <HeroChip label={`${listing.sqft.toLocaleString('en-US')} sqft`} />
            <HeroChip icon="Clock" label={listing.listedLabel} />
            <HeroChip icon="Hash" label={listing.reference} />
          </View>
        </View>

        <View className="mx-4 mt-4 flex-row gap-3">
          <ActionButton
            icon="Pencil"
            label="Edit"
            containerClassName="bg-brand-muted"
            iconColor={brand}
            textClassName="text-brand"
          />
          <ActionButton
            icon="Share2"
            label="Share"
            containerClassName="bg-brand-muted"
            iconColor={brand}
            textClassName="text-brand"
          />
          <ActionButton
            icon="Eye"
            label="Preview"
            containerClassName="bg-brand-muted"
            iconColor={brand}
            textClassName="text-brand"
          />
        </View>

        <View className="mt-4 px-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="rounded-2xl bg-card p-1">
              <TabsTrigger value="Details" className="rounded-xl py-3">
                <Text>Details</Text>
              </TabsTrigger>
              <TabsTrigger value="Activity" className="rounded-xl py-3">
                <Text>Activity</Text>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </View>

        {tab === 'Details' ? <DetailsTab listing={listing} /> : <ActivityTab listing={listing} />}

        {tab === 'Details' && listing.interested.length > 0 ? (
          <>
            <View className="mt-6 flex-row items-center justify-between px-4">
              <View className="flex-row items-center gap-2">
                <Icon name="Users" size={18} color={brand} />
                <Text className="text-base font-bold text-foreground">Interested Leads</Text>
              </View>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
                <Text className="text-xs font-bold text-brand-foreground">
                  {listing.interested.length}
                </Text>
              </View>
            </View>

            <View className="mt-3 gap-3 px-4">
              {listing.interested.map((l) => (
                <InterestedLeadCard key={l.id} lead={l} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
