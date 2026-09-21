import * as React from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/atoms/BackButton';
import { Badge } from '@/components/atoms/Badge';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { ImageViewer } from '@/components/organisms/ImageViewer';
import { formatDate } from '@/lib/format/date';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import type { PaymentPlan, Project, Segment, UnitLayout, UnitType } from '../models';
import {
  getDevelopmentStageLabel,
  getHandoverDateLabel,
  getUnitTypeLabel,
  getViewTypeLabel,
  shouldHideBathrooms,
  shouldHideBedrooms,
  titleCase,
} from '../labels';
import { useProjectDetail } from '../hooks/use-project-detail';
import { DetailItem, MutedIcon, SectionCard } from './detail-primitives';

type Tab = 'profile' | 'plans';

function aed(value: number | null): string {
  return value === null ? 'Not set' : `AED ${value.toLocaleString()}`;
}

function NoteBlock({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return (
    <View className="mt-1 rounded-xl bg-muted p-3">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm text-foreground">{value ?? 'No description provided'}</Text>
    </View>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

function ProfileTab({ project }: Readonly<{ project: Project }>) {
  const projectType = project.availability === 'off_plan' ? 'Off-plan' : 'Ready';
  const lastUpdatedBy =
    project.operationsManager?.name ?? project.operationsManager?.email ?? 'Unknown';

  return (
    <View className="gap-4">
      <SectionCard icon="Building2" title="Overview">
        <View className="flex-row flex-wrap">
          <DetailItem label="Project name" value={project.projectName} />
          <DetailItem label="Developer" value={project.developer?.brandName} />
          <DetailItem
            label="Internal Owner"
            value={project.operationsManager?.name ?? project.operationsManager?.email}
          />
          <DetailItem label="Project type" value={projectType} />
          <DetailItem
            label="Development Stage"
            value={getDevelopmentStageLabel(project.developmentStage)}
          />
          <DetailItem label="Neighbourhood" value={project.neighbourhoodName} />
          <DetailItem label="State" value={project.stateName} />
          <DetailItem label="Property Use" value={titleCase(project.propertyUse)} />
          <DetailItem label="Handover Date" value={project.handoverDate} />
          <DetailItem label="Lifestyle standards" value={titleCase(project.lifestyleStandard)} />
        </View>
        <NoteBlock label="Description" value={project.shortDescription} />
      </SectionCard>

      <SectionCard icon="ShieldCheck" title="Compliance & Permits">
        <View className="flex-row flex-wrap">
          <DetailItem label="Rera Project Number" value={project.reraProjectNumber} />
          <DetailItem label="DLD Permit Reference" value={project.dldPermitReference} />
          <DetailItem label="DLD Permit Status" value={project.dldPermitStatus} />
        </View>
        <View className="mt-1 rounded-xl bg-muted p-3">
          {project.permitDocuments.length > 0 ? (
            <View className="gap-2">
              {project.permitDocuments.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => doc.documentUrl && Linking.openURL(doc.documentUrl)}
                  className="flex-row items-center gap-2 active:opacity-70"
                >
                  <MutedIcon name="FileText" size={16} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{doc.documentName}</Text>
                    {doc.createdAt ? (
                      <Text className="text-xs text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="items-center">
              <Text className="text-sm font-medium text-muted-foreground">No File found</Text>
              <Text className="text-xs text-muted-foreground">
                No permit documents uploaded yet
              </Text>
            </View>
          )}
        </View>
      </SectionCard>

      <SectionCard icon="CircleDollarSign" title="Commercial">
        <View className="flex-row flex-wrap">
          <DetailItem
            label="Commission Model"
            value={project.commissionModel ? project.commissionModel.toUpperCase() : 'Not set'}
          />
          <DetailItem
            label="Default Commission (%)"
            value={
              project.defaultCommissionPercent === null
                ? 'Not set'
                : String(project.defaultCommissionPercent)
            }
          />
          <DetailItem label="Reservation Fee" value={aed(project.reservationFee)} />
          <DetailItem label="Starting Price" value={aed(project.startingPrice)} />
        </View>
        <NoteBlock label="Description" value={project.shortDescription} />
      </SectionCard>

      <Text className="px-1 text-xs text-muted-foreground">
        Last updated {project.updatedAt ? formatDate(project.updatedAt) : '—'} by {lastUpdatedBy}
      </Text>
    </View>
  );
}

// ─── Plans & Types tab ───────────────────────────────────────────────────────

function PaymentPlanRow({ plan }: Readonly<{ plan: PaymentPlan }>) {
  const [open, setOpen] = React.useState(false);
  const complete = plan.totalPercentage === 100;
  return (
    <View className="rounded-xl border border-border">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-2 p-3 active:opacity-70"
      >
        <MutedIcon name={open ? 'ChevronUp' : 'ChevronDown'} />
        <Text className="flex-1 text-sm font-medium text-foreground">{plan.planName}</Text>
        <Badge variant={plan.status === 'active' ? 'success' : 'mutedSoft'}>
          <Text>{plan.status === 'active' ? 'Active' : 'Draft'}</Text>
        </Badge>
        <Badge variant={complete ? 'successSoft' : 'warningSoft'}>
          <Text>{plan.totalPercentage}%</Text>
        </Badge>
      </Pressable>
      {open && plan.milestones.length > 0 ? (
        <View className="border-t border-border">
          {plan.milestones.map((m, i) => (
            <View
              key={m.id}
              className="flex-row items-center gap-2 px-3 py-2"
              style={
                i === 0
                  ? undefined
                  : { borderTopWidth: 1, borderTopColor: 'rgb(229 229 229 / 0.4)' }
              }
            >
              <Text className="w-5 text-xs text-muted-foreground">{i + 1}</Text>
              <View className="flex-1">
                <Text className="text-sm text-foreground">{m.name}</Text>
                {m.date ? (
                  <Text className="text-xs text-muted-foreground">{formatDate(m.date)}</Text>
                ) : null}
              </View>
              <Text className="text-sm font-medium text-foreground">{m.percentage}%</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SegmentRow({ segment }: Readonly<{ segment: Segment }>) {
  return (
    <View className="rounded-xl border border-border p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-foreground">{segment.name}</Text>
        <Badge variant={segment.status === 'active' ? 'success' : 'mutedSoft'}>
          <Text>{segment.status === 'active' ? 'Active' : 'Inactive'}</Text>
        </Badge>
      </View>
      <View className="mt-2 flex-row flex-wrap">
        <DetailItem label="View" value={getViewTypeLabel(segment.viewType)} />
        <DetailItem label="Floors" value={`${segment.floorsMin}-${segment.floorsMax}`} />
        <DetailItem
          label="Completion Stage"
          value={getDevelopmentStageLabel(segment.completionStage)}
        />
        <DetailItem
          label="Expected Handover"
          value={getHandoverDateLabel(segment.expectedHandover)}
        />
      </View>
    </View>
  );
}

function bedsBaths(unit: UnitType): string {
  const beds =
    shouldHideBedrooms(unit.propertyType, unit.unitType) || !unit.bedrooms
      ? 'N/A'
      : String(unit.bedrooms);
  const baths =
    shouldHideBathrooms(unit.propertyType, unit.unitType) || !unit.bathrooms
      ? 'N/A'
      : String(unit.bathrooms);
  return `${beds} bd · ${baths} ba`;
}

function rangeText(min: number | null, max: number | null, prefix = ''): string {
  if (min === null || max === null) return 'Not set';
  return `${prefix}${min.toLocaleString()} - ${max.toLocaleString()}`;
}

/**
 * Layout floor-plan media: image → thumbnail that opens the in-app viewer
 * (pinch/zoom, which a floor plan needs to be readable at all); PDF → chip that
 * hands off to the system viewer, since there's no in-app PDF renderer here.
 */
function FloorPlan({ layout }: Readonly<{ layout: UnitLayout }>) {
  const [viewerOpen, setViewerOpen] = React.useState(false);

  if (layout.previewImageUrl) {
    const uri = layout.previewImageUrl;
    return (
      <>
        <Pressable
          onPress={() => setViewerOpen(true)}
          className="mt-2 active:opacity-80"
          accessibilityRole="imagebutton"
          accessibilityLabel={layout.previewImageAltText ?? `${layout.name} floor plan`}
        >
          <Text className="mb-1 text-xs font-medium text-muted-foreground">Floor Plan</Text>
          <Image source={{ uri }} resizeMode="cover" className="h-40 w-full rounded-xl bg-muted" />
        </Pressable>
        <ImageViewer visible={viewerOpen} uri={uri} onClose={() => setViewerOpen(false)} />
      </>
    );
  }
  if (layout.floorPlanPdfUrl) {
    return (
      <Pressable
        onPress={() => layout.floorPlanPdfUrl && Linking.openURL(layout.floorPlanPdfUrl)}
        className="mt-2 flex-row items-center gap-2 rounded-xl border border-border bg-muted p-3 active:opacity-70"
      >
        <MutedIcon name="FileText" size={16} />
        <Text className="text-sm text-info">View floor plan (PDF)</Text>
      </Pressable>
    );
  }
  return null;
}

function UnitTypeRow({ unit }: Readonly<{ unit: UnitType }>) {
  const [open, setOpen] = React.useState(false);
  const hasLayouts = unit.layouts.length > 0;
  const currency = (unit.currency ?? 'AED').toUpperCase();
  return (
    <View className="rounded-xl border border-border">
      <Pressable
        onPress={() => hasLayouts && setOpen((v) => !v)}
        className="flex-row items-center gap-2 p-3 active:opacity-70"
      >
        {hasLayouts ? (
          <MutedIcon name={open ? 'ChevronUp' : 'ChevronDown'} />
        ) : (
          <View style={{ width: 18 }} />
        )}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">
            {getUnitTypeLabel(unit.unitType)} · {titleCase(unit.propertyType)}
          </Text>
          <Text className="text-xs text-muted-foreground">{unit.segmentName}</Text>
        </View>
        <Badge variant="warningSoft">
          <Text>{bedsBaths(unit)}</Text>
        </Badge>
      </Pressable>
      <View className="flex-row flex-wrap px-3 pb-2">
        <DetailItem label="Size range (sq ft)" value={rangeText(unit.sizeMin, unit.sizeMax)} />
        <DetailItem
          label="Unit Price range"
          value={rangeText(unit.priceMin, unit.priceMax, `${currency} `)}
        />
      </View>
      {open && hasLayouts ? (
        <View className="border-t border-border">
          {unit.layouts.map((l, i) => (
            <View
              key={l.id}
              className="px-3 py-2"
              style={
                i === 0
                  ? undefined
                  : { borderTopWidth: 1, borderTopColor: 'rgb(229 229 229 / 0.4)' }
              }
            >
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-sm text-foreground">{l.name}</Text>
              </View>
              <View className="flex-row flex-wrap">
                <DetailItem label="View Type" value={getViewTypeLabel(l.viewType)} />
                <DetailItem
                  label="Size (sq ft)"
                  value={l.size === null ? 'N/A' : l.size.toLocaleString()}
                />
                <DetailItem
                  label="Unit Price"
                  value={
                    l.price === null
                      ? 'N/A'
                      : `${(l.currency ?? currency).toUpperCase()} ${l.price.toLocaleString()}`
                  }
                />
              </View>
              <FloorPlan layout={l} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface PlansTabProps {
  readonly paymentPlans: PaymentPlan[];
  readonly segments: Segment[];
  readonly unitTypes: UnitType[];
  readonly isLoading: boolean;
}

function ListBlock<T>({
  items,
  empty,
  render,
}: Readonly<{ items: T[]; empty: string; render: (item: T) => React.ReactNode }>) {
  if (items.length === 0) {
    return <Text className="py-4 text-center text-sm text-muted-foreground">{empty}</Text>;
  }
  return <View className="gap-2">{items.map(render)}</View>;
}

function PlansTab({ paymentPlans, segments, unitTypes, isLoading }: PlansTabProps) {
  if (isLoading) {
    return (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  return (
    <View className="gap-4">
      <SectionCard icon="CircleDollarSign" title="Payment Plans">
        <ListBlock
          items={paymentPlans}
          empty="No payment plans available."
          render={(plan) => <PaymentPlanRow key={plan.id} plan={plan} />}
        />
      </SectionCard>

      <SectionCard icon="Layers" title="Segments">
        <ListBlock
          items={segments}
          empty="No segments available."
          render={(segment) => <SegmentRow key={segment.id} segment={segment} />}
        />
      </SectionCard>

      <SectionCard icon="Grid2x2" title="Unit Configuration">
        <ListBlock
          items={unitTypes}
          empty="No unit types found."
          render={(unit) => <UnitTypeRow key={unit.id} unit={unit} />}
        />
      </SectionCard>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

function ScreenHeader({ title, top }: Readonly<{ title: string; top: number }>) {
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text numberOfLines={1} className="flex-1 text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
    </View>
  );
}

export function ProjectManagementDetailScreen({ id }: Readonly<{ id: string }>) {
  const canAccess = useCan(PERMISSIONS.PROJECTS_READ);
  const { top, bottom } = useSafeAreaInsets();
  const [tab, setTab] = React.useState<Tab>('profile');

  const {
    project,
    isLoading,
    isError,
    isRefetching,
    refetch,
    paymentPlans,
    segments,
    unitTypes,
    isPaymentPlansLoading,
    isSegmentsLoading,
    isUnitTypesLoading,
  } = useProjectDetail(id, { enabled: canAccess });

  if (!canAccess) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Project" top={top} />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="ShieldOff"
            title="No access"
            description="You don't have permission to view Projects."
          />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Project" top={top} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (isError || !project) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Project" top={top} />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Building2"
            title="Project not found"
            description="This project doesn't exist or couldn't be loaded."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={project.projectName} top={top} />
      <View className="px-4 pb-3 pt-1">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="profile">
              <Text>Profile</Text>
            </TabsTrigger>
            <TabsTrigger value="plans">
              <Text>Plans & Types</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {tab === 'profile' ? <ProfileTab project={project} /> : null}
        {tab === 'plans' ? (
          <PlansTab
            paymentPlans={paymentPlans}
            segments={segments}
            unitTypes={unitTypes}
            isLoading={isPaymentPlansLoading || isSegmentsLoading || isUnitTypesLoading}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
