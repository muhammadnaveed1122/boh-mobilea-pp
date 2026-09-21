import * as React from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { bestColumnIndex, COMPARE_ROWS, SECTIONS, type CompareRow } from '../compare/compare-rows';
import { useCompareData } from '../hooks/use-compare-data';
import type { CompareFloorPlan, CompareProject } from '../services';
import { useCompareStore } from '../store/compare.store';

const LABEL_W = 124;
const COL_W = 148;
const HEADER_H = 116;
const SECTION_H = 36;
const MIN_ROW_H = 52;

type VisualRow = { kind: 'section'; title: string } | { kind: 'data'; row: CompareRow };

const VISUAL_ROWS: VisualRow[] = SECTIONS.flatMap((section) => [
  { kind: 'section' as const, title: section.title },
  ...COMPARE_ROWS.filter((r) => r.section === section.key).map((row) => ({
    kind: 'data' as const,
    row,
  })),
]);

type ReportHeight = (key: string, h: number) => void;

/** Rows to render: all, or (diff-only) just those whose values differ across projects. */
function visibleRows(projects: CompareProject[], diffOnly: boolean): VisualRow[] {
  if (!diffOnly || projects.length < 2) return VISUAL_ROWS;
  const keep = new Set<string>();
  COMPARE_ROWS.forEach((row) => {
    const values = projects.map((p) => row.value(p).display);
    if (new Set(values).size > 1) keep.add(row.key);
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

/** Floor-plan thumbnail; tappable to view the preview image full-size when present. */
function FloorPlanThumb({ plan }: Readonly<{ plan: CompareFloorPlan }>) {
  const [open, setOpen] = React.useState(false);
  const hasImage = Boolean(plan.previewImageUrl);
  return (
    <View className="w-14 items-center gap-1">
      <Pressable
        disabled={!hasImage}
        onPress={() => setOpen(true)}
        accessibilityRole={hasImage ? 'imagebutton' : undefined}
        accessibilityLabel={hasImage ? `View ${plan.label} floor plan` : plan.label}
        className="h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-white"
      >
        {plan.previewImageUrl ? (
          <Image
            source={{ uri: plan.previewImageUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Icon name="FileText" size={20} />
        )}
      </Pressable>
      <Text numberOfLines={1} className="w-full text-center text-[10px] text-muted-foreground">
        {plan.label}
      </Text>
      {hasImage ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            onPress={() => setOpen(false)}
            className="flex-1 items-center justify-center bg-black/70 p-6"
            accessibilityLabel="Close floor plan"
          >
            <View className="w-full items-center gap-3 rounded-2xl bg-white p-4">
              <Image
                source={{ uri: plan.previewImageUrl ?? undefined }}
                className="h-96 w-full"
                resizeMode="contain"
              />
              <Text className="text-sm font-medium text-black">{plan.label}</Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function PaymentPlanCell({ project }: Readonly<{ project: CompareProject }>) {
  if (project.paymentPlans.length === 0) return <Text className="text-muted-foreground">—</Text>;
  return (
    <View className="gap-2">
      {project.paymentPlans.map((plan, pi) => (
        <View key={`${plan.name}-${pi}`} className="gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-[12px] font-semibold text-foreground">{plan.name}</Text>
            <View
              className={cn(
                'rounded-full px-1.5 py-0.5',
                plan.status === 'active' ? 'bg-primary/15' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-[9px] font-bold uppercase',
                  plan.status === 'active' ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {plan.status}
              </Text>
            </View>
          </View>
          {plan.milestones.slice(0, 6).map((m, mi) => (
            <View key={`${m.label}-${mi}`} className="flex-row items-center justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 text-[11px] text-muted-foreground">
                {m.label}
              </Text>
              <Text className="text-[11px] font-medium tabular-nums text-foreground">
                {m.percent}%
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Rich rendering for the inventory rows; falls back to the row's display string. */
function InventoryCell({ row, project }: Readonly<{ row: CompareRow; project: CompareProject }>) {
  const { display } = row.value(project);

  if (row.key === 'unitTypes') {
    if (project.unitTypes.length === 0) return <Text className="text-muted-foreground">—</Text>;
    return (
      <View className="gap-1.5">
        <Text className="text-[11px] text-muted-foreground">{display}</Text>
        <View className="flex-row flex-wrap gap-1">
          {project.unitTypes.map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      </View>
    );
  }

  if (row.key === 'amenities') {
    if (project.amenities.length === 0) return <Text className="text-muted-foreground">—</Text>;
    return (
      <View className="gap-1.5">
        <Text className="text-[11px] text-muted-foreground">{display}</Text>
        <View className="flex-row flex-wrap gap-1">
          {project.amenities.map((a) => (
            <Chip key={a} label={a} />
          ))}
        </View>
      </View>
    );
  }

  if (row.key === 'floorPlans') {
    if (project.floorPlans.length === 0) return <Text className="text-muted-foreground">—</Text>;
    return (
      <View className="gap-1.5">
        <Text className="text-[11px] text-muted-foreground">{display}</Text>
        <View className="flex-row flex-wrap gap-2">
          {project.floorPlans.map((plan, i) => (
            <FloorPlanThumb key={`${plan.label}-${i}`} plan={plan} />
          ))}
        </View>
      </View>
    );
  }

  if (row.key === 'paymentPlans') return <PaymentPlanCell project={project} />;

  return <Text className="text-[13px] font-medium text-foreground">{display}</Text>;
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
  project,
  onRemove,
}: Readonly<{ project: CompareProject; onRemove: () => void }>) {
  return (
    <View style={{ height: HEADER_H }} className="gap-1.5 border-b border-border p-2">
      <View className="h-12 w-full overflow-hidden rounded-lg bg-muted">
        {project.imageUrl ? (
          <Image source={{ uri: project.imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="ImageOff" size={16} />
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="text-[13px] font-bold text-foreground">
        {project.name}
      </Text>
      <View className="mt-auto flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push(`/project-management/${project.id}`)}
          hitSlop={6}
          accessibilityLabel={`View ${project.name}`}
        >
          <Text className="text-[11px] font-semibold text-brand">View</Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={`Remove ${project.name}`}>
          <Icon name="X" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function ProjectColumn({
  rows,
  project,
  index,
  projects,
  onRemove,
  rowH,
  reportH,
}: Readonly<{
  rows: VisualRow[];
  project: CompareProject;
  index: number;
  projects: CompareProject[];
  onRemove: () => void;
  rowH: Record<string, number>;
  reportH: ReportHeight;
}>) {
  return (
    <View style={{ width: COL_W }} className="border-r border-border">
      <ColumnHeader project={project} onRemove={onRemove} />
      {rows.map((vr) => {
        if (vr.kind === 'section') {
          return <View key={`s-${vr.title}`} style={{ height: SECTION_H }} className="bg-muted" />;
        }
        const isBest = vr.row.best ? bestColumnIndex(vr.row, projects) === index : false;
        return (
          <DataCell
            key={vr.row.key}
            rowKey={vr.row.key}
            rowH={rowH[vr.row.key]}
            reportH={reportH}
            className={cn('gap-1', isBest ? 'bg-primary/10' : '')}
          >
            {vr.row.section === 'inventory' ? (
              <InventoryCell row={vr.row} project={project} />
            ) : (
              <Text
                numberOfLines={2}
                className="text-[13px] font-medium tabular-nums text-foreground"
              >
                {vr.row.value(project).display}
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

export function ProjectCompareScreen() {
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);
  const { projects, isLoading } = useCompareData(ids);

  const [rowH, setRowH] = React.useState<Record<string, number>>({});
  const reportH = React.useCallback<ReportHeight>((key, h) => {
    setRowH((prev) => (h > (prev[key] ?? 0) ? { ...prev, [key]: h } : prev));
  }, []);

  const [diffOnly, setDiffOnly] = React.useState(false);
  const rows = React.useMemo(() => visibleRows(projects, diffOnly), [projects, diffOnly]);

  if (items.length < 2) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Scale"
            title="Nothing to compare"
            description="Pick at least 2 projects to compare."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader diffOnly={diffOnly} onToggleDiff={() => setDiffOnly((v) => !v)} />
      {isLoading && projects.length === 0 ? (
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
                {projects.map((project, index) => (
                  <ProjectColumn
                    key={project.id}
                    rows={rows}
                    project={project}
                    index={index}
                    projects={projects}
                    onRemove={() => remove(project.id)}
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
