import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { format, isValid, parseISO } from 'date-fns';
import { Badge } from '@/components/atoms/Badge';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { resolveAmenityIcon, resolveAmenityLabel, sortAmenities } from '@/lib/amenities';
import { formatCurrency } from '@/lib/format/currency';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import { htmlToText } from '@/lib/html-to-text';
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type ListingDetail,
  type ListingsPurpose,
} from '../../types';
import { useListingsInfinite } from '../../hooks/use-listings';
import { UnifiedListingCard } from '../UnifiedListingCard';
import { normalizeSecondaryRow } from '../../lib/normalize-row';

/** Tabular figures keep prices/counts from reflowing as digits change. */
const TABULAR = { fontVariant: ['tabular-nums' as const] };

/** Plain white card matching the mockup — bold title + content, no icon chip. */
function Card({ title, children }: Readonly<{ title?: string; children: React.ReactNode }>) {
  return (
    <View
      className="mb-3 rounded-2xl border border-border/70 bg-card p-4"
      style={{
        shadowColor: '#101827',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
      }}
    >
      {title ? (
        <Text className="mb-3 text-base font-bold tracking-tight text-foreground">{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd MMM, yyyy') : null;
}

function resolvePrice(detail: ListingDetail): number | null {
  const p = detail.sections.highlights?.price;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  const raw = detail.derived.askingPrice;
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function listingTitle(detail: ListingDetail): string {
  return detail.name ?? detail.sections.hero?.title ?? 'Untitled listing';
}

/** Short "/year" | "/month" suffix for rent prices, inferred from the period label. */
function pricePeriodSuffix(priceType?: string | null): string | null {
  const t = priceType?.toLowerCase();
  if (!t) return null;
  if (t.includes('year') || t.includes('annual')) return '/year';
  if (t.includes('month')) return '/month';
  if (t.includes('week')) return '/week';
  if (t.includes('day') || t.includes('night')) return '/day';
  return null;
}

/* ------------------------------------------------------------ purpose pill */

/** Sale vs rent chip — green for sale, blue for rent, icon + label. */
function PurposePill({ purpose }: Readonly<{ purpose: ListingsPurpose }>) {
  const isRent = purpose === 'rent';
  const color = useThemeColor(isRent ? '--info' : '--success');
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full px-2.5 py-1',
        isRent ? 'bg-info/15' : 'bg-success/15',
      )}
    >
      <Icon name={isRent ? 'KeyRound' : 'Tag'} size={12} color={color} />
      <Text className={cn('text-xs font-semibold', isRent ? 'text-info' : 'text-success')}>
        {isRent ? 'For Rent' : 'For Sale'}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------- price header */

export function PriceHeader({
  detail,
  purpose,
}: Readonly<{ detail: ListingDetail; purpose: ListingsPurpose | null }>) {
  const price = resolvePrice(detail);
  const d = detail.derived;
  const beds = d.bedrooms ?? detail.sections.highlights?.bedrooms ?? null;
  const unit =
    d.unitType ?? d.propertyType ?? detail.sections.highlights?.propertyType ?? 'Property';
  const subtitle = Number.isFinite(beds) ? `${beds} Bedroom ${unit}` : unit;
  const periodSuffix = purpose === 'rent' ? pricePeriodSuffix(d.priceType) : null;

  return (
    <Card>
      <View className="mb-3 flex-row items-center gap-2">
        {purpose ? <PurposePill purpose={purpose} /> : null}
        <Badge variant={STATUS_BADGE_VARIANT[detail.status]}>
          <Text>{STATUS_LABEL[detail.status]}</Text>
        </Badge>
      </View>
      <View className="flex-row items-end gap-1">
        <Text className="text-2xl font-bold tracking-tight text-brand" style={TABULAR}>
          {price != null ? formatCurrency(price) : 'Price on request'}
        </Text>
        {periodSuffix ? (
          <Text className="pb-1 text-sm font-medium text-muted-foreground">{periodSuffix}</Text>
        ) : null}
      </View>
      <Text className="mt-1 text-sm text-muted-foreground">{subtitle}</Text>
      <Text className="mt-2 text-base font-semibold leading-snug text-foreground">
        {listingTitle(detail)}
      </Text>
    </Card>
  );
}

/* ------------------------------------------------------- highlights grid */

function HighlightTile({ icon, value }: Readonly<{ icon: IconName; value: string }>) {
  const brand = useThemeColor('--brand');
  return (
    <View className="mb-2 w-1/3 px-1">
      <View className="flex-row items-center gap-2 rounded-xl border border-border/70 px-2.5 py-2.5">
        <Icon name={icon} size={16} color={brand} />
        <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/** Highlight-tile display order per purpose — rent leads with furnishing, sale with size. */
const TILE_ORDER: Record<ListingsPurpose, IconName[]> = {
  rent: ['Sofa', 'Bed', 'Bath', 'Maximize2', 'LayoutGrid', 'Eye', 'Building2'],
  sale: ['Bed', 'Bath', 'Maximize2', 'LayoutGrid', 'Sofa', 'Eye', 'Building2'],
};

export function HighlightsSection({
  detail,
  purpose,
}: Readonly<{ detail: ListingDetail; purpose: ListingsPurpose | null }>) {
  const d = detail.derived;
  const h = detail.sections.highlights;
  const area = h?.builtUpArea ?? d.builtUpArea ?? null;
  const areaUnit = h?.builtUpAreaUnit ?? 'sqft';

  const beds = h?.bedrooms ?? d.bedrooms;
  const baths = h?.bathrooms ?? d.bathrooms;
  const tiles: { icon: IconName; value?: string | number | null }[] = [
    { icon: 'Bed', value: Number.isFinite(beds) ? `${beds} Beds` : null },
    { icon: 'Bath', value: Number.isFinite(baths) ? `${baths} Baths` : null },
    { icon: 'Maximize2', value: area ? `${area} ${areaUnit}` : null },
    { icon: 'LayoutGrid', value: h?.unitType ?? d.unitType },
    { icon: 'Sofa', value: h?.furnishing ?? d.furnishing },
    { icon: 'Eye', value: h?.view ?? d.view },
    { icon: 'Building2', value: h?.propertyType ?? d.propertyType },
  ];
  const order = TILE_ORDER[purpose ?? 'sale'];
  const ordered = [...tiles].sort((a, b) => order.indexOf(a.icon) - order.indexOf(b.icon));
  const visible = ordered.filter((t) => t.value != null && t.value !== '');
  if (visible.length === 0) return null;

  return (
    <Card title="Property Highlights">
      <View className="-mx-1 flex-row flex-wrap">
        {visible.map((t) => (
          <HighlightTile key={String(t.value)} icon={t.icon} value={String(t.value)} />
        ))}
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------ about */

export function AboutSection({ detail }: Readonly<{ detail: ListingDetail }>) {
  const [expanded, setExpanded] = useState(false);
  const about = detail.sections.about;
  const lead = about?.subtitle?.trim();
  const body = htmlToText(about?.textSection1 ?? about?.additionalDescription);
  if (!lead && !body) return null;

  return (
    <Card title="About this property">
      {lead ? <Text className="mb-1 text-sm font-semibold text-foreground">{lead}</Text> : null}
      {body ? (
        <Text
          className="text-sm leading-relaxed text-muted-foreground"
          numberOfLines={expanded ? undefined : 4}
        >
          {body}
        </Text>
      ) : null}
      {body && body.length > 160 ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} className="mt-2">
          <Text className="text-sm font-semibold text-brand">
            {expanded ? 'Read Less' : 'Read More'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------- amenities */

const AMENITIES_PREVIEW = 8;

export function AmenitiesSection({ detail }: Readonly<{ detail: ListingDetail }>) {
  const [showAll, setShowAll] = useState(false);
  const brand = useThemeColor('--brand');
  const amenities = detail.amenities ?? [];
  if (amenities.length === 0) return null;
  const sorted = sortAmenities(amenities);
  const visible = showAll ? sorted : sorted.slice(0, AMENITIES_PREVIEW);

  return (
    <Card title="Amenities">
      <View className="-mx-1 flex-row flex-wrap">
        {visible.map((a) => {
          const name = resolveAmenityLabel({ customTitle: a.customTitle, name: a.amenity?.name });
          const iconName = resolveAmenityIcon({
            icon: a.amenity?.icon,
            slug: a.amenity?.slug,
            label: a.amenity?.name,
          });
          return (
            <View key={a.id} className="mb-2 w-1/2 px-1">
              <View className="flex-row items-center gap-2.5 rounded-xl border border-border/70 px-3 py-3">
                <Icon name={iconName} size={16} color={brand} />
                <Text className="flex-1 text-xs font-medium text-foreground" numberOfLines={2}>
                  {name}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {sorted.length > AMENITIES_PREVIEW ? (
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          className="mt-1 items-center rounded-xl border border-border py-2.5 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-brand">
            {showAll ? 'Show less' : `Show all ${sorted.length} amenities`}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------- shared detail row */

function RegRow({
  label,
  value,
  last,
}: Readonly<{ label: string; value: string; last?: boolean }>) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between py-3',
        last ? '' : 'border-b border-border/50',
      )}
    >
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text
        className="flex-1 text-right text-sm font-semibold text-foreground"
        numberOfLines={1}
        style={TABULAR}
      >
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------ purpose-specific terms */

/** Title-case a raw period label (e.g. "yearly" → "Yearly"); null if empty. */
function humanizePeriod(priceType?: string | null): string | null {
  const t = priceType?.trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Format a money-ish string as AED currency when numeric; otherwise pass through. */
function formatMoneyish(raw?: string | null): string | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? raw : formatCurrency(n);
}

/** "N cheque(s)" label; null when unset or non-positive. */
function chequesLabel(count?: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  return `${count} cheque${count === 1 ? '' : 's'}`;
}

/**
 * Purpose-aware terms card. Rent surfaces payment period / deposit / cheques;
 * sale surfaces asking price. Hidden when purpose is unknown or no rows resolve.
 */
export function PropertyTermsSection({
  detail,
  purpose,
}: Readonly<{ detail: ListingDetail; purpose: ListingsPurpose | null }>) {
  const d = detail.derived;
  if (!purpose) return null;
  const isRent = purpose === 'rent';

  const rows: { label: string; value?: string | null }[] = isRent
    ? [
        { label: 'Payment Period', value: humanizePeriod(d.priceType) },
        { label: 'Security Deposit', value: formatMoneyish(d.deposit) },
        { label: 'Cheques', value: chequesLabel(d.maxCheques) },
        { label: 'Furnishing', value: d.furnishing },
      ]
    : [
        { label: 'Asking Price', value: formatMoneyish(d.askingPrice) },
        { label: 'Furnishing', value: d.furnishing },
      ];
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (visible.length === 0) return null;

  return (
    <Card title={isRent ? 'Rental Terms' : 'Sale Details'}>
      {visible.map((r, i) => (
        <RegRow
          key={r.label}
          label={r.label}
          value={String(r.value)}
          last={i === visible.length - 1}
        />
      ))}
    </Card>
  );
}

/* ---------------------------------------------- project details (primary) */

/** Turn a snake/space token into Title Case (e.g. "off_market" → "Off Market"). */
function humanizeLabel(raw?: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Primary (project) listing facts — developer, project, availability, and unit
 * specs. Renders only for primary listings (`detail.primary` present) and hides
 * when no rows resolve.
 */
export function ProjectDetailsSection({ detail }: Readonly<{ detail: ListingDetail }>) {
  const p = detail.primary;
  if (!p) return null;

  const rows: { label: string; value?: string | null }[] = [
    { label: 'Developer', value: p.developerName },
    { label: 'Project', value: p.projectName },
    { label: 'Availability', value: humanizeLabel(p.availability) },
    { label: 'Size', value: p.size != null ? `${p.size} sqft` : null },
    { label: 'Floor', value: p.floor },
    { label: 'Total Floors', value: p.totalFloors },
    { label: 'Build Year', value: p.buildYear },
    { label: 'Occupancy', value: humanizeLabel(p.occupancy) },
    { label: 'Parking', value: p.parking },
    { label: 'Available From', value: fmtDate(p.availabilityDate) },
  ];
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (visible.length === 0) return null;

  return (
    <Card title="Project Details">
      {visible.map((r, i) => (
        <RegRow
          key={r.label}
          label={r.label}
          value={String(r.value)}
          last={i === visible.length - 1}
        />
      ))}
    </Card>
  );
}

/* ------------------------------------------------------ regulatory */

export function RegulatorySection({ detail }: Readonly<{ detail: ListingDetail }>) {
  const permit = detail.trakheesiPermit;
  if (!permit?.permitNumber && !permit?.qrCodeUrl) return null;

  return (
    <Card title="Regulatory Information">
      {permit.permitNumber ? (
        <RegRow label="Trakheesi Permit" value={permit.permitNumber} last={!permit.qrCodeUrl} />
      ) : null}
      {permit?.qrCodeUrl ? (
        <View className="mt-4 items-center">
          <Image
            source={{ uri: permit.qrCodeUrl }}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------ related listings */

export function RelatedListingsSection({ detail }: Readonly<{ detail: ListingDetail }>) {
  const { data } = useListingsInfinite({ status: 'active' });
  const items = (data?.pages.flatMap((p) => p.items) ?? [])
    .filter((l) => l.id !== detail.id)
    .slice(0, 5);
  if (items.length === 0) return null;

  return (
    <Card title="Related Listings & Projects">
      <View className="gap-3">
        {items.map((l) => (
          <UnifiedListingCard key={l.id} row={normalizeSecondaryRow(l)} stages={[]} />
        ))}
      </View>
    </Card>
  );
}
