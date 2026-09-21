import * as React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { bestColumnIndex, COMPARE_ROWS, SECTIONS, type CompareRow } from '../compare/compare-rows';
import { useListingCompareAmenities } from '../hooks/use-listing-compare-amenities';
import { compareKey, useListingCompareStore } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

const LABEL_W = 124;
const COL_W = 156;
const HEADER_H = 108;
const SECTION_H = 36;
const MIN_ROW_H = 52;

type VisualRow = { kind: 'section'; title: string } | { kind: 'data'; row: CompareRow };
type ReportHeight = (key: string, h: number) => void;

const VISUAL_ROWS: VisualRow[] = SECTIONS.flatMap((section) => [
  { kind: 'section' as const, title: section.title },
  ...COMPARE_ROWS.filter((r) => r.section === section.key).map((row) => ({
    kind: 'data' as const,
    row,
  })),
]);

/** Rows to render: all, or (diff-only) just those whose values differ across listings. */
function visibleRows(rows: UnifiedListingRow[], diffOnly: boolean): VisualRow[] {
  if (!diffOnly || rows.length < 2) return VISUAL_ROWS;
  const keep = new Set<string>();
  COMPARE_ROWS.forEach((cr) => {
    const values = rows.map((r) => cr.value(r).display);
    if (new Set(values).size > 1) keep.add(cr.key);
  });
  const out: VisualRow[] = [];
  SECTIONS.forEach((section) => {
    const sectionRows = COMPARE_ROWS.filter((r) => r.section === section.key && keep.has(r.key));
    if (sectionRows.length === 0) return;
    out.push({ kind: 'section', title: section.title });
    sectionRows.forEach((row) => out.push({ kind: 'data', row }));
  });
  return out;
}

function ScreenHeader({
  diffOnly,
  onToggleDiff,
}: Readonly<{ diffOnly?: boolean; onToggleDiff?: () => void }>) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text className="flex-1 text-xl font-bold text-foreground">Compare</Text>
        {onToggleDiff ? (
          <Pressable
            onPress={onToggleDiff}
            accessibilityRole="switch"
            accessibilityState={{ checked: Boolean(diffOnly) }}
            accessibilityLabel="Show differences only"
            hitSlop={8}
            className={cn(
              'h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
              diffOnly ? 'border-brand bg-brand/10' : 'border-border',
            )}
          >
            <Icon name="ListFilter" size={15} />
            <Text
              className={cn('text-sm font-medium', diffOnly ? 'text-brand' : 'text-foreground')}
            >
              Differences
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label }: Readonly<{ label: string }>) {
  return (
    <View className="rounded-full border border-border bg-transparent px-2 py-0.5">
      <Text className="text-[11px] font-medium text-foreground">{label}</Text>
    </View>
  );
}

/** Data cell with measured row-height sync so the frozen label column stays aligned. */
function DataCell({
  rowKey,
  rowH,
  reportH,
  className,
  children,
}: Readonly<{
  rowKey: string;
  rowH: number | undefined;
  reportH: ReportHeight;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <View
      onLayout={(e) => reportH(rowKey, e.nativeEvent.layout.height)}
      style={{ minHeight: rowH ?? MIN_ROW_H }}
      className={cn('justify-center border-b border-border px-3 py-2', className)}
    >
      {children}
    </View>
  );
}

function LabelColumn({
  rows,
  rowH,
  reportH,
}: Readonly<{ rows: VisualRow[]; rowH: Record<string, number>; reportH: ReportHeight }>) {
  return (
    <View style={{ width: LABEL_W }} className="border-r border-border bg-card">
      <View style={{ height: HEADER_H }} className="justify-end px-3 pb-2">
        <Text className="text-[11px] font-medium text-muted-foreground">
          {rows.filter((v) => v.kind === 'data').length} fields
        </Text>
      </View>
      {rows.map((vr) =>
        vr.kind === 'section' ? (
          <View
            key={`s-${vr.title}`}
            style={{ height: SECTION_H }}
            className="justify-end bg-muted px-3 pb-1.5"
          >
            <Text className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {vr.title}
            </Text>
          </View>
        ) : (
          <DataCell key={vr.row.key} rowKey={vr.row.key} rowH={rowH[vr.row.key]} reportH={reportH}>
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {vr.row.label}
            </Text>
          </DataCell>
        ),
      )}
    </View>
  );
}

function ColumnHeader({
  row,
  onRemove,
}: Readonly<{ row: UnifiedListingRow; onRemove: () => void }>) {
  return (
    <View style={{ height: HEADER_H }} className="gap-1.5 border-b border-border p-2">
      <View className="h-12 w-full overflow-hidden rounded-lg bg-muted">
        {row.heroImageUrl ? (
          <Image source={{ uri: row.heroImageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="Building2" size={16} />
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="text-[13px] font-bold text-foreground">
        {row.title}
      </Text>
      <View className="mt-auto flex-row items-center justify-between">
        {row.kind === 'secondary' ? (
          <Pressable
            onPress={() => router.push(`/listings/${row.id}`)}
            hitSlop={6}
            accessibilityLabel={`View ${row.title}`}
          >
            <Text className="text-[11px] font-semibold text-brand">View</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={`Remove ${row.title}`}>
          <Icon name="X" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function AmenitiesCell({
  names,
  loading,
}: Readonly<{ names: string[] | undefined; loading: boolean }>) {
  if (names === undefined) {
    if (loading) return <Skeleton className="h-4 w-16 rounded" />;
    return <Text className="text-muted-foreground">—</Text>;
  }
  if (names.length === 0) return <Text className="text-muted-foreground">—</Text>;
  return (
    <View className="flex-row flex-wrap gap-1">
      {names.map((a, i) => (
        <Chip key={`${a}-${i}`} label={a} />
      ))}
    </View>
  );
}

function ListingColumn({
  rows,
  row,
  index,
  allRows,
  amenities,
  amenitiesLoading,
  onRemove,
  rowH,
  reportH,
}: Readonly<{
  rows: VisualRow[];
  row: UnifiedListingRow;
  index: number;
  allRows: UnifiedListingRow[];
  amenities: string[] | undefined;
  amenitiesLoading: boolean;
  onRemove: () => void;
  rowH: Record<string, number>;
  reportH: ReportHeight;
}>) {
  return (
    <View style={{ width: COL_W }} className="border-r border-border">
      <ColumnHeader row={row} onRemove={onRemove} />
      {rows.map((vr) => {
        if (vr.kind === 'section') {
          return <View key={`s-${vr.title}`} style={{ height: SECTION_H }} className="bg-muted" />;
        }
        const isBest = vr.row.best ? bestColumnIndex(vr.row, allRows) === index : false;
        return (
          <DataCell
            key={vr.row.key}
            rowKey={vr.row.key}
            rowH={rowH[vr.row.key]}
            reportH={reportH}
            className={cn('gap-1', isBest ? 'bg-primary/10' : '')}
          >
            {vr.row.key === 'amenities' ? (
              <AmenitiesCell names={amenities} loading={amenitiesLoading} />
            ) : (
              <Text
                numberOfLines={3}
                className="text-[13px] font-medium tabular-nums text-foreground"
              >
                {vr.row.value(row).display}
              </Text>
            )}
            {isBest && vr.row.bestTag ? (
              <View className="self-start rounded-full bg-primary px-1.5 py-0.5">
                <Text className="text-[9px] font-bold text-primary-foreground">
                  {vr.row.bestTag}
                </Text>
              </View>
            ) : null}
          </DataCell>
        );
      })}
    </View>
  );
}

function CompareSkeleton() {
  return (
    <View className="flex-row gap-3 p-4">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-96 flex-1 rounded-2xl" />
      ))}
    </View>
  );
}

export function ListingCompareScreen() {
  const items = useListingCompareStore((s) => s.items);
  const remove = useListingCompareStore((s) => s.remove);

  const { amenitiesByKey, isLoading: amenitiesLoading } = useListingCompareAmenities(items);

  const [rowH, setRowH] = React.useState<Record<string, number>>({});
  const reportH = React.useCallback<ReportHeight>((key, h) => {
    setRowH((prev) => (h > (prev[key] ?? 0) ? { ...prev, [key]: h } : prev));
  }, []);

  const [diffOnly, setDiffOnly] = React.useState(false);
  const rows = React.useMemo(() => visibleRows(items, diffOnly), [items, diffOnly]);

  if (items.length < 2) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Scale"
            title="Nothing to compare"
            description="Pick at least 2 listings to compare."
          />
        </View>
      </View>
    );
  }

  const hasSecondary = items.some((i) => i.kind === 'secondary');
  const showSkeleton = amenitiesLoading && Object.keys(amenitiesByKey).length === 0 && hasSecondary;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader diffOnly={diffOnly} onToggleDiff={() => setDiffOnly((v) => !v)} />
      {showSkeleton ? (
        <CompareSkeleton />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="flex-row">
            <LabelColumn rows={rows} rowH={rowH} reportH={reportH} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={COL_W}
              decelerationRate="fast"
            >
              <View className="flex-row">
                {items.map((row, index) => (
                  <ListingColumn
                    key={compareKey(row)}
                    rows={rows}
                    row={row}
                    index={index}
                    allRows={items}
                    amenities={amenitiesByKey[compareKey(row)]}
                    amenitiesLoading={amenitiesLoading}
                    onRemove={() => remove(compareKey(row))}
                    rowH={rowH}
                    reportH={reportH}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
