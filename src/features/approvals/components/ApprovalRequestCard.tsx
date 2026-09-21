import * as React from 'react';
import { Image, View } from 'react-native';
import {
  Bath,
  BedDouble,
  ClipboardList,
  Clock,
  House,
  Ruler,
  SquarePen,
} from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import {
  asUpdateSnapshot,
  listingPreviewTitle,
  type ApprovalRequestListItem,
  type ListingFieldChange,
  type ListingPreview,
} from '../models/approval';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';

/** Blank titles must fall through to the snapshot — `??` alone would keep the empty string. */
function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function snapshotTitle(snapshot: unknown): string {
  if (typeof snapshot === 'object' && snapshot !== null && 'title' in snapshot) {
    const { title } = snapshot as { title?: unknown };
    if (typeof title === 'string' && title !== '') return title;
  }
  return 'Listing';
}

function formatPrice(preview: ListingPreview): string | null {
  if (preview.price === null || preview.price <= 0) return null;
  return preview.price.toLocaleString('en-US');
}

/** Compact icon + value chip for the headline specs (beds / baths / size). */
function StatChip({
  icon: Icon,
  value,
  a11yLabel,
  color,
}: Readonly<{
  icon: typeof BedDouble;
  value: string;
  a11yLabel: string;
  color: string;
}>) {
  return (
    <View
      accessibilityLabel={a11yLabel}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-muted py-2"
    >
      <Icon size={16} color={color} />
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

/** Headline specs (beds / baths / size) as an icon row for at-a-glance scanning.
 *  Returns null when the preview carries none of them. */
function HeadlineStats({ preview, color }: Readonly<{ preview: ListingPreview; color: string }>) {
  const beds = preview.bedrooms !== null;
  const baths = preview.bathrooms !== null;
  const hasSize = preview.size !== null && preview.size !== '';
  if (!beds && !baths && !hasSize) return null;
  return (
    <View className="mt-3 flex-row gap-2">
      {beds ? (
        <StatChip
          icon={BedDouble}
          value={String(preview.bedrooms)}
          a11yLabel={`${preview.bedrooms} bedrooms`}
          color={color}
        />
      ) : null}
      {baths ? (
        <StatChip
          icon={Bath}
          value={String(preview.bathrooms)}
          a11yLabel={`${preview.bathrooms} bathrooms`}
          color={color}
        />
      ) : null}
      {hasSize ? (
        <StatChip
          icon={Ruler}
          value={preview.size!}
          a11yLabel={`Size ${preview.size}`}
          color={color}
        />
      ) : null}
    </View>
  );
}

/** Stacked label-over-value cell — value gets the full column width, so long
 *  strings (e.g. area names) wrap to 1-2 lines instead of shredding the grid. */
function Field({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (value === null || value === '') return null;
  return (
    <View className="mb-3 w-1/2 pr-3">
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

function ChangedFields({ snapshot }: Readonly<{ snapshot: unknown }>) {
  const diff = asUpdateSnapshot(snapshot);
  if (diff === null || diff.fields.length === 0) return null;
  return (
    <View className="mt-1 border-t border-border pt-3">
      <Text className="mb-2 text-xs font-medium text-muted-foreground">
        {`Changed fields (${diff.fields.length})`}
      </Text>
      <View className="gap-1.5">
        {diff.fields.map((change: ListingFieldChange) => (
          <View
            key={change.field}
            className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted px-2.5 py-1.5"
          >
            <Text className="text-xs font-medium text-foreground">{change.label}</Text>
            <Text className="text-xs text-muted-foreground line-through">
              {change.before ?? '—'}
            </Text>
            <Text className="text-xs text-muted-foreground">→</Text>
            <Text className="text-xs font-medium text-foreground">{change.after ?? '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ApprovalRequestCard({
  request,
  onOpenAudit,
  onOpenListing,
}: Readonly<{
  request: ApprovalRequestListItem;
  onOpenAudit: () => void;
  onOpenListing: () => void;
}>) {
  const muted = useThemeColor('--muted-foreground');
  const preview = request.listingPreview;
  const title = listingPreviewTitle(preview) ?? snapshotTitle(request.snapshot);
  const reference = nonEmpty(preview?.reference);
  const price = preview ? formatPrice(preview) : null;
  const requestedAt = new Date(request.submittedAt).toLocaleString();
  const canOpenListing = request.resourceId !== '';
  // On an update request the raw `approvalFor` is a long "Updated: a, b, c…" list that
  // duplicates the Changed-fields diff below — collapse it to a compact count instead.
  const updateDiff = asUpdateSnapshot(request.snapshot);
  const changedCount = updateDiff?.fields.length ?? 0;
  const fieldWord = changedCount === 1 ? 'field' : 'fields';
  const approvalForValue = updateDiff
    ? `Updated ${changedCount} ${fieldWord}`
    : request.approvalFor;

  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      {/* Thumbnail */}
      <View className="h-40 w-full overflow-hidden rounded-xl bg-muted">
        {preview?.imageUrl ? (
          <Image source={{ uri: preview.imageUrl }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <House size={36} color={muted} />
          </View>
        )}
      </View>

      {/* Header row */}
      <View className="mt-3 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold leading-5 text-foreground" numberOfLines={2}>
            {title}
          </Text>
          {reference !== null || preview?.propertyType ? (
            <Text className="mt-1 text-sm text-muted-foreground">
              {reference !== null ? <Text className="font-medium">{reference}</Text> : null}
              {reference !== null && preview?.propertyType ? ' · ' : ''}
              {preview?.propertyType ? (
                <Text className="capitalize">{preview.propertyType}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>
        <ApprovalStatusBadge status={request.status} />
      </View>

      {price ? (
        <Text className="mt-2 text-2xl font-bold text-foreground">
          {price}{' '}
          <Text className="text-sm font-normal text-muted-foreground">
            {preview?.priceUnit ?? 'AED'}
          </Text>
        </Text>
      ) : null}

      {/* Headline specs */}
      {preview ? <HeadlineStats preview={preview} color={muted} /> : null}

      {/* Key/value grid */}
      {preview ? (
        <View className="mt-4 flex-row flex-wrap border-t border-border pt-4">
          <Field label="Community" value={preview.community} />
          <Field label="Area" value={preview.area} />
          <Field label="Developer" value={preview.developer} />
          <Field
            label="Total Floors"
            value={preview.totalFloors !== null ? String(preview.totalFloors) : null}
          />
          <Field label="Floor Level" value={preview.floorLevel} />
          <Field label="Agent" value={preview.agent} />
          <Field label="Permit No." value={preview.permitNumber} />
          <Field label="Approval For" value={approvalForValue} />
          <Field label="Submitted By" value={request.submitterName} />
        </View>
      ) : null}

      <ChangedFields snapshot={request.snapshot} />

      <View className="mt-1 flex-row items-center gap-1.5">
        <Clock size={13} color={muted} />
        <Text className="text-xs text-muted-foreground">Requested on {requestedAt}</Text>
      </View>

      {/* Actions */}
      <View className="mt-4 flex-row gap-2">
        {canOpenListing ? (
          <Button variant="outline" size="sm" onPress={onOpenListing} className="flex-1">
            <SquarePen size={16} color={muted} />
            <Text>Detail</Text>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onPress={onOpenAudit} className="flex-1">
          <ClipboardList size={16} color={muted} />
          <Text>Audit</Text>
        </Button>
      </View>
    </View>
  );
}
