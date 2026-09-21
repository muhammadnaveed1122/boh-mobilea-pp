import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { ImageViewer } from '@/components/organisms/ImageViewer';
import { useThemeColor } from '@theme';
import type {
  ProjectUnitTypesFloorPlans,
  UnitTypesFloorPlanLayout,
  UnitTypesFloorPlanUnitType,
} from '../../types';
import {
  bedroomLabel,
  formatPriceRange,
  formatSizeRange,
  propertyTypeLabel,
} from '../../utils/format';
import { SectionWrap } from './SectionWrap';

interface Props {
  data: ProjectUnitTypesFloorPlans | null;
}

function LayoutRow({
  layout,
  onPreview,
  isLast,
}: Readonly<{
  layout: UnitTypesFloorPlanLayout;
  onPreview: (l: UnitTypesFloorPlanLayout) => void;
  isLast: boolean;
}>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const hasPreview = Boolean(layout.floorPlanImageUrl || layout.floorPlanUrl);
  return (
    <Pressable
      onPress={hasPreview ? () => onPreview(layout) : undefined}
      className={`flex-row items-center justify-between py-3 ${
        isLast ? '' : 'border-b border-border'
      }`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-foreground">{layout.name}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {layout.size ? `${layout.size.toLocaleString()} sqft` : '—'}
          {layout.price ? ` · ${formatPriceRange(layout.price, layout.price)}` : ''}
        </Text>
      </View>
      {hasPreview ? <Icon name="ChevronRight" size={16} color={mutedFg} /> : null}
    </Pressable>
  );
}

function UnitTypeCard({
  unit,
  onPreview,
}: Readonly<{
  unit: UnitTypesFloorPlanUnitType;
  onPreview: (l: UnitTypesFloorPlanLayout) => void;
}>) {
  const [open, setOpen] = useState(false);
  const enabledLayouts = unit.layouts.filter((l) => l.enabled !== false);

  return (
    <View className="mb-2 overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between px-4 py-4"
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {bedroomLabel(unit.unitType) ?? `${unit.bedrooms ?? ''} BR`}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {formatSizeRange(unit.sizeRange?.min, unit.sizeRange?.max)} ·{' '}
            {formatPriceRange(unit.priceRange?.min, unit.priceRange?.max)}
          </Text>
        </View>
        <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
          <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={15} />
        </View>
      </Pressable>
      {open && enabledLayouts.length > 0 ? (
        <View className="border-t border-border px-4 py-1">
          {enabledLayouts.map((l, i) => (
            <LayoutRow
              key={l.layoutId}
              layout={l}
              onPreview={onPreview}
              isLast={i === enabledLayouts.length - 1}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function FloorPlansSection({ data }: Readonly<Props>) {
  const propertyTypes = useMemo(
    () => (data?.propertyTypes ?? []).filter((p) => p.selected && p.unitTypes.length > 0),
    [data],
  );
  const [active, setActive] = useState<string>(propertyTypes[0]?.propertyType ?? '');
  const [preview, setPreview] = useState<UnitTypesFloorPlanLayout | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  if (propertyTypes.length === 0) return null;

  const current = propertyTypes.find((p) => p.propertyType === active) ?? propertyTypes[0];
  const units = current?.unitTypes.filter((u) => u.selected) ?? [];

  return (
    <SectionWrap title="Floor Plans">
      {propertyTypes.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          className="-mx-4 mb-3 px-4"
        >
          {propertyTypes.map((p) => {
            const isActive = p.propertyType === current?.propertyType;
            return (
              <Pressable
                key={p.propertyType}
                onPress={() => setActive(p.propertyType)}
                className={`rounded-full px-4 py-2 ${
                  isActive ? 'bg-brand' : 'border border-border bg-background'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? 'text-brand-foreground' : 'text-foreground'
                  }`}
                >
                  {propertyTypeLabel(p.propertyType)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {units.map((u) => (
        <UnitTypeCard key={u.unitTypeId} unit={u} onPreview={setPreview} />
      ))}

      <Dialog
        visible={preview !== null}
        onRequestClose={() => setPreview(null)}
        title={preview?.name}
      >
        {preview?.floorPlanImageUrl ? (
          // Tap opens the zoomable viewer — a plan is unreadable at dialog size.
          <Pressable
            onPress={() => setZoomUrl(preview.floorPlanImageUrl ?? null)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open ${preview.name} floor plan`}
            className="active:opacity-80"
          >
            <Image
              source={{ uri: preview.floorPlanImageUrl }}
              className="mb-4 h-64 w-full rounded-xl bg-muted"
              resizeMode="contain"
            />
          </Pressable>
        ) : null}
        <View className="flex-row gap-3">
          {preview?.floorPlanUrl ? (
            <View className="flex-1">
              <Button
                onPress={() => preview?.floorPlanUrl && Linking.openURL(preview.floorPlanUrl)}
              >
                <Text>Download PDF</Text>
              </Button>
            </View>
          ) : null}
          <View className="flex-1">
            <Button variant="outline" onPress={() => setPreview(null)}>
              <Text>Close</Text>
            </Button>
          </View>
        </View>
      </Dialog>

      <ImageViewer
        visible={zoomUrl !== null}
        uri={zoomUrl ?? ''}
        onClose={() => setZoomUrl(null)}
      />
    </SectionWrap>
  );
}
