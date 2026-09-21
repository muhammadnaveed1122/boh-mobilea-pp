import { memo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatCurrency } from '@/lib/format/currency';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import {
  normalizeListingPurpose,
  STATUS_LABEL,
  type ListingStage,
  type ListingStatus,
  type UnifiedListingRow,
} from '../types';
import { HERO_GRADIENT, HERO_SCRIM, STATUS_DOT } from '../lib/visuals';
import { PORTAL_META } from '../lib/filters';
import { ListingActionsSheet } from './ListingActionsSheet';

/* ------------------------------------------------------------- hero chips */

/**
 * Frosted chip for overlaying on the hero photo — dark glass + white text so
 * it stays legible on any photo, mirroring `lead-detail/HeroHeaderCard`.
 */
function FrostedChip({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1">
      {children}
    </View>
  );
}

function isKnownStatus(status: string): status is ListingStatus {
  return status in STATUS_LABEL;
}

/** Status as a frosted hero chip: colored dot + label. */
function StatusChip({ status }: Readonly<{ status: string }>) {
  const dot = isKnownStatus(status) ? STATUS_DOT[status] : STATUS_DOT.draft;
  const label = isKnownStatus(status) ? STATUS_LABEL[status] : status;
  return (
    <FrostedChip>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </FrostedChip>
  );
}

/** Sale vs rent — solid colored chip so mixed lists read purpose at a glance. */
const PURPOSE_CHIP: Record<'sale' | 'rent', { label: string; bgClass: string }> = {
  sale: { label: 'For Sale', bgClass: 'bg-info' },
  rent: { label: 'For Rent', bgClass: 'bg-warning' },
};

function PurposeChip({ purpose }: Readonly<{ purpose: string | null | undefined }>) {
  const normalized = normalizeListingPurpose(purpose);
  if (!normalized) return null;
  const chip = PURPOSE_CHIP[normalized];
  return (
    <View className={cn('rounded-full px-2.5 py-1', chip.bgClass)}>
      <Text className="text-[11px] font-bold text-white">{chip.label}</Text>
    </View>
  );
}

function PortalPills({ portals }: Readonly<{ portals: UnifiedListingRow['portals'] }>) {
  if (!portals || portals.length === 0) return null;
  return (
    <View className="flex-row gap-1">
      {portals.map((p) => {
        const meta = PORTAL_META[p];
        return (
          <View
            key={p}
            className="h-5 min-w-[28px] items-center justify-center rounded px-1"
            style={{ backgroundColor: meta.bg }}
          >
            <Text className="text-[9px] font-bold text-white">{meta.mark}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- hero */

const TREND_UP = '#4ADE80';
const TREND_DOWN = '#F87171';

function trendIconFor(trend: UnifiedListingRow['priceTrend']): IconName | null {
  if (trend === 'up') return 'TrendingUp';
  if (trend === 'down') return 'TrendingDown';
  return null;
}

function Hero({
  row,
  selectable,
  selected,
}: Readonly<{ row: UnifiedListingRow; selectable: boolean; selected: boolean }>) {
  const price = formatCurrency(row.price);
  const trendIcon = trendIconFor(row.priceTrend);

  return (
    <View className="h-40 w-full bg-muted">
      {row.heroImageUrl ? (
        <Image
          source={{ uri: row.heroImageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '100%' }}
        >
          <View className="flex-1 items-center justify-center">
            <Icon name="Building2" size={36} color="rgba(255,255,255,0.35)" />
          </View>
        </LinearGradient>
      )}

      {/* Bottom scrim so the price overlay stays legible on any photo. */}
      <LinearGradient
        colors={HERO_SCRIM}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88 }}
      />

      {/* Top row: compare check + purpose | status */}
      <View className="absolute left-2.5 right-2.5 top-2.5 flex-row items-center gap-1.5">
        {selectable ? (
          <View
            className={cn(
              'h-6 w-6 items-center justify-center rounded-full border-2',
              selected ? 'border-primary bg-primary' : 'border-white bg-black/40',
            )}
          >
            {selected ? <Icon name="Check" size={14} color="#fff" strokeWidth={3} /> : null}
          </View>
        ) : null}
        <PurposeChip purpose={row.purpose} />
        <View className="ml-auto">
          <StatusChip status={row.status} />
        </View>
      </View>

      {/* Bottom row: price + trend | portal pills */}
      <View className="absolute bottom-2.5 left-3 right-3 flex-row items-end justify-between">
        <View className="flex-row items-center gap-1.5">
          {trendIcon ? (
            <Icon
              name={trendIcon}
              size={16}
              color={row.priceTrend === 'up' ? TREND_UP : TREND_DOWN}
            />
          ) : null}
          {price ? (
            <Text
              className="text-lg font-extrabold text-white"
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {price}
            </Text>
          ) : (
            <Text className="text-sm font-semibold text-white/80">Price on request</Text>
          )}
        </View>
        <PortalPills portals={row.portals} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- body */

/** One bed/bath/size stat: icon + value, evenly spaced in the stats row. */
function Stat({ icon, value }: Readonly<{ icon: IconName; value: string }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="min-w-0 shrink flex-row items-center gap-1.5">
      <Icon name={icon} size={15} color={mutedFg} />
      <Text className="shrink text-xs font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Labelled two-up meta cell; renders nothing when the value is empty. */
function MetaItem({ label, value }: Readonly<{ label: string; value: string | null | undefined }>) {
  if (!value) return null;
  return (
    <View className="w-1/2 pr-2">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-xs text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Pipeline stage chip with the stage's color dot. */
function StageChip({ stage }: Readonly<{ stage: UnifiedListingRow['stage'] }>) {
  if (!stage) return null;
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-muted px-2 py-0.5">
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stage.color }} />
      <Text className="text-[11px] font-medium text-foreground" numberOfLines={1}>
        {stage.name}
      </Text>
    </View>
  );
}

function CardBody({
  row,
  canManage,
  onManage,
  selectable,
}: Readonly<{
  row: UnifiedListingRow;
  canManage: boolean;
  onManage: () => void;
  selectable: boolean;
}>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const size = row.sizeSqft ? `${row.sizeSqft.toLocaleString()} sqft` : null;
  const kindLabel = row.kind === 'primary' ? 'Primary' : 'Secondary';
  const hasStats = Number.isFinite(row.bedrooms) || Number.isFinite(row.bathrooms) || size !== null;

  return (
    <View className="p-3">
      {/* Title + kebab */}
      <View className="flex-row items-start gap-2">
        <Text
          className="flex-1 text-base font-bold leading-tight text-foreground"
          numberOfLines={1}
        >
          {row.title}
        </Text>
        {canManage && !selectable ? (
          <Pressable onPress={onManage} hitSlop={10} accessibilityLabel="Listing actions">
            <Icon name="EllipsisVertical" size={18} color={mutedFg} />
          </Pressable>
        ) : null}
      </View>

      {/* Location */}
      {row.location ? (
        <View className="mt-1 flex-row items-center gap-1">
          <Icon name="MapPin" size={12} color={mutedFg} />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {row.location}
          </Text>
        </View>
      ) : null}

      {/* Primary stats: beds · baths · size */}
      {hasStats ? (
        <View className="mt-2.5 flex-row items-center gap-4">
          {Number.isFinite(row.bedrooms) ? (
            <Stat icon="Bed" value={`${row.bedrooms} Beds`} />
          ) : null}
          {Number.isFinite(row.bathrooms) ? (
            <Stat icon="Bath" value={`${row.bathrooms} Baths`} />
          ) : null}
          {size ? <Stat icon="Maximize2" value={size} /> : null}
        </View>
      ) : null}

      {/* Stage + kind chips */}
      <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
        <StageChip stage={row.stage} />
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {kindLabel}
          </Text>
        </View>
      </View>

      {/* Secondary meta — remaining web-row fields */}
      <View className="mt-2.5 flex-row flex-wrap gap-y-2 border-t border-border pt-2.5">
        <MetaItem label="Type" value={row.propertyType} />
        <MetaItem label="Unit No." value={row.unitNumber} />
        <MetaItem
          label={row.kind === 'primary' ? 'Project' : 'Property'}
          value={row.projectName ?? row.propertyLabel}
        />
        <MetaItem label="Developer" value={row.developerName} />
        <MetaItem label="Permit" value={row.permitNumber} />
        <MetaItem label="Agent" value={row.agentName} />
        <MetaItem label="Created By" value={row.createdByName} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- card */

const CARD_CLASS = 'overflow-hidden rounded-2xl border border-border bg-card';
const CARD_SHADOW = {
  shadowColor: '#101827',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

function UnifiedListingCardBase({
  row,
  stages,
  selectable = false,
  selected = false,
  onToggleSelect,
  fillHeight = false,
}: Readonly<{
  row: UnifiedListingRow;
  stages: ListingStage[];
  /** When true, tapping the card toggles compare selection instead of navigating. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Stretch to the parent's height — for horizontal carousels where siblings must match. */
  fillHeight?: boolean;
}>) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const canManage = useCan(
    row.kind === 'primary'
      ? [PERMISSIONS.LISTINGS_UPDATE, PERMISSIONS.LISTINGS_CREATE]
      : [PERMISSIONS.OPPORTUNITY_LISTING_UPDATE, PERMISSIONS.OPPORTUNITY_LISTING_CREATE],
  );
  const onManage = () => setSheetVisible(true);
  const cardClass = cn(CARD_CLASS, fillHeight && 'flex-1');

  const inner = (
    <>
      <Hero row={row} selectable={selectable} selected={selected} />
      <CardBody row={row} canManage={canManage} onManage={onManage} selectable={selectable} />
    </>
  );

  if (selectable) {
    return (
      <Pressable
        onPress={onToggleSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Select ${row.title}`}
        style={({ pressed }) => [CARD_SHADOW, pressed && { opacity: 0.96 }]}
        className={cn(cardClass, selected ? 'border-primary' : '')}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <>
      {/* Both branches open the detail screen; `kind` selects primary (project
          CMS) vs secondary (opportunity) data source on the detail route. */}
      <Pressable
        onPress={() => {
          const purposeHint = normalizeListingPurpose(row.purpose);
          router.push({
            pathname: '/listings/[id]',
            params: {
              id: row.id,
              kind: row.kind,
              ...(purposeHint ? { purpose: purposeHint } : {}),
            },
          });
        }}
        // `pressed` style (not the `active:` variant) — the latter stalls the
        // native UI thread on rapidly-tapped list rows (see project memory).
        style={({ pressed }) => [CARD_SHADOW, pressed && { opacity: 0.96 }]}
        className={cardClass}
      >
        {inner}
      </Pressable>

      {canManage ? (
        <ListingActionsSheet
          visible={sheetVisible}
          row={row}
          stages={stages}
          onClose={() => setSheetVisible(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Memoized: this card is rendered once per row in a long virtualized list, and
 * the surrounding screen re-renders on every scroll tick / search keystroke.
 */
export const UnifiedListingCard = memo(UnifiedListingCardBase);
