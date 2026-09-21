import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { FunnelChart } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
// Import the SVG entry point directly, never the package barrel: the barrel also re-exports
// skiaChart, so Metro follows it and fails to resolve @shopify/react-native-skia — a large
// native dep we deliberately do not install. react-native-svg is already a direct dependency.
import SvgChart, { SVGRenderer } from '@wuba/react-native-echarts/svgChart';

import { EmptyState } from '@/components/atoms/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useLeadFunnel } from '../hooks/use-lead-funnel';
import type { FunnelPeriod, LeadFunnelStage } from '../types';

// Tree-shaken core — never import the `echarts` barrel. Mirrors the web app's
// registration (boh-lead-magnet already runs ECharts v6) so option shapes
// transfer between platforms.
echarts.use([FunnelChart, TooltipComponent, LegendComponent, SVGRenderer]);

const CHART_HEIGHT = 260;

const PERIODS: readonly { value: FunnelPeriod; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
];

interface FunnelLabelParams {
  name: string;
  value: number;
}

interface BuildOptionArgs {
  stages: LeadFunnelStage[];
  rampColor: string;
  closedColor: string;
  labelColor: string;
  valueColor: string;
  lineColor: string;
  gapColor: string;
}

/**
 * `useThemeColor` hands back an `rgb(r, g, b)` string; ECharts needs a real colour
 * value, so re-emit it as `rgba(...)` to fade a single hue across the funnel.
 */
function withAlpha(rgb: string, alpha: number): string {
  const channels = rgb.match(/\d+/g);
  if (channels === null || channels.length < 3) {
    return rgb;
  }
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

/**
 * Two overlaid funnel series sharing identical geometry: the first paints the
 * trapezoids and puts the stage name OUTSIDE on the left, the second is an
 * invisible funnel of the same shape that places count + percent on the right.
 * A single ECharts series only exposes one label per item, hence the pair.
 *
 * Labels sit outside deliberately. Drawn inside, they clip to nothing on the
 * lower (narrow) bands — "Viewing Scheduled" renders as "g Sch".
 *
 * Colour is one hue fading down the funnel, with the closing stage in the
 * success colour. A per-stage rainbow reads as unrelated categories; a funnel
 * is one cohort draining, and the colour should say so.
 */
function buildFunnelOption({
  stages,
  rampColor,
  closedColor,
  labelColor,
  valueColor,
  lineColor,
  gapColor,
}: BuildOptionArgs): Record<string, unknown> {
  const pctByLabel = new Map(stages.map((s) => [s.label, s.pctOfTop]));
  const top = stages[0]?.count ?? 0;
  const lastIndex = stages.length - 1;

  const shared = {
    type: 'funnel',
    left: '30%',
    right: '26%',
    top: 8,
    bottom: 8,
    min: 0,
    max: top > 0 ? top : 1,
    // A generous floor: the last stage is often a tiny fraction of the first, and a
    // hairline band is both unreadable and ugly.
    minSize: '34%',
    maxSize: '100%',
    sort: 'none',
    gap: 4,
    funnelAlign: 'center',
  };

  return {
    tooltip: { show: false },
    legend: { show: false },
    series: [
      {
        ...shared,
        name: 'stage',
        silent: true,
        itemStyle: { borderColor: gapColor, borderWidth: 1, borderRadius: 3 },
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'left',
          color: labelColor,
          fontSize: 12,
          fontWeight: '500',
        },
        labelLine: { show: false },
        data: stages.map((stage, i) => ({
          name: stage.label,
          value: stage.count,
          itemStyle: {
            color:
              i === lastIndex
                ? closedColor
                : withAlpha(rampColor, 1 - (i / Math.max(lastIndex, 1)) * 0.55),
          },
        })),
      },
      {
        ...shared,
        name: 'values',
        silent: true,
        itemStyle: { color: 'transparent', borderWidth: 0 },
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'right',
          color: valueColor,
          fontSize: 12,
          fontWeight: '600',
          formatter: (params: FunnelLabelParams) =>
            `${params.value}   ${pctByLabel.get(params.name) ?? 0}%`,
        },
        labelLine: { show: true, length: 10, lineStyle: { color: lineColor } },
        data: stages.map((stage) => ({ name: stage.label, value: stage.count })),
      },
    ],
  };
}

function formatPct(value: number | undefined): string {
  return `${value ?? 0}%`;
}

function FunnelSkeleton() {
  return (
    <View className="mx-4 mt-6 gap-4 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-5 w-28 rounded" />
        <Skeleton className="h-7 w-40 rounded-full" />
      </View>
      <Skeleton style={{ height: CHART_HEIGHT }} className="w-full rounded-xl" />
      <View className="items-center gap-2 border-t border-border pt-4">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
      </View>
    </View>
  );
}

/**
 * Super-admin dashboard funnel: New Leads → Contacted → Qualified → Viewing
 * Scheduled → Negotiation → Closed Deals, driven by `useLeadFunnel(period)`.
 * ECharts (SVG renderer) is the only RN-viable chart lib with a real `funnel`
 * series — see task-10 brief. All series colors resolve through
 * `useThemeColor` so the chart follows light/dark like every other surface.
 */
export function LeadFunnelChart() {
  const [period, setPeriod] = useState<FunnelPeriod>('this-month');
  const { data, isLoading, isError } = useLeadFunnel(period);

  const [width, setWidth] = useState(0);
  // The wrapper's forwardRef exposes an opaque `ChartElement & any` handle
  // (see @wuba/react-native-echarts/src/types.ts) — its own docs type this
  // ref as `any` for the same reason.
  const hostRef = useRef<any>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const brand = useThemeColor('--brand');
  const success = useThemeColor('--success');
  const foreground = useThemeColor('--foreground');
  const mutedForeground = useThemeColor('--muted-foreground');
  const border = useThemeColor('--border');

  const stages = useMemo(() => data?.stages ?? [], [data?.stages]);

  // Select wants the whole {value,label} option, not just the key. Defaults to
  // "This Month" because `period` is initialised to 'month'.
  const selectedPeriod = useMemo(() => {
    const match = PERIODS.find((p) => p.value === period);
    return match ? { value: match.value, label: match.label } : undefined;
  }, [period]);

  const option = useMemo(
    () =>
      buildFunnelOption({
        stages,
        rampColor: brand,
        closedColor: success,
        labelColor: mutedForeground,
        valueColor: foreground,
        lineColor: border,
        gapColor: border,
      }),
    [stages, brand, success, foreground, mutedForeground, border],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  // (Re)create the chart whenever its pixel size changes — the RN SVG
  // renderer needs concrete width/height up front, unlike web ECharts.
  useEffect(() => {
    if (!width || !hostRef.current) return;

    const chart = echarts.init(hostRef.current, undefined, {
      renderer: 'svg',
      width,
      height: CHART_HEIGHT,
    });
    chartInstanceRef.current = chart;
    chart.setOption(option as echarts.EChartsCoreOption);

    return () => {
      chart.dispose();
      chartInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // Cheaper update path for data/theme changes once the chart exists.
  useEffect(() => {
    chartInstanceRef.current?.setOption(option as echarts.EChartsCoreOption, true);
  }, [option]);

  if (isLoading) {
    return <FunnelSkeleton />;
  }

  if (isError) {
    return (
      <View className="mx-4 mt-6 rounded-2xl border border-border bg-card">
        <EmptyState
          icon="TrendingDown"
          title="Couldn't load the lead funnel"
          description="Pull to refresh or try again shortly."
        />
      </View>
    );
  }

  // An all-zero cohort is NOT a funnel. ECharts clamps every band to `minSize`, so a
  // period with no leads renders as six identical rectangles — which reads as a broken
  // chart rather than "no data". Gate on the top stage, not just on `stages.length`.
  const hasStages = stages.length > 0 && (stages[0]?.count ?? 0) > 0;

  return (
    <View className="mx-4 mt-6 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="subheading">Lead Funnel</Text>
        {/*
          A dropdown, not chips: three chips ate the whole header row and pushed the
          title into a corner. The Select atom brings its own chevron, bottom sheet and
          haptics, so the periods stay one tap away without costing horizontal space.
        */}
        <Select
          value={selectedPeriod}
          onValueChange={(option) => {
            if (option) {
              setPeriod(option.value as FunnelPeriod);
            }
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="This Month" />
          </SelectTrigger>
          <SelectContent title="Period">
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value} label={p.label} />
            ))}
          </SelectContent>
        </Select>
      </View>

      {hasStages ? (
        <View onLayout={handleLayout} style={{ height: CHART_HEIGHT, marginTop: 12 }}>
          <SvgChart ref={hostRef} handleGesture={false} />
        </View>
      ) : (
        <EmptyState
          title="No leads yet"
          description="Once leads come in, the funnel will fill in here."
        />
      )}

      <View className="mt-4 items-center gap-1 border-t border-border pt-4">
        <Text variant="muted" className="text-xs uppercase tracking-wide">
          Conversion Rate
        </Text>
        <Text variant="title" className="text-success">
          {formatPct(data?.conversionRate)}
        </Text>
      </View>
    </View>
  );
}
