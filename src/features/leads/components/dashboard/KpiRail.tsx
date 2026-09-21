import { ScrollView } from 'react-native';
import { Skeleton } from '@/components/atoms/Skeleton';
import type { OverviewKpi } from '../../types';
import { KpiCard } from './KpiCard';

interface KpiRailProps {
  kpis: OverviewKpi[];
  loading?: boolean;
}

/** Card width (px). Sized so a third card peeks, hinting the rail scrolls. */
const CARD_WIDTH = 118;

const RAIL_CONTENT = { paddingHorizontal: 16, gap: 10 } as const;

/**
 * Performance KPIs as a single-row horizontal rail. This was a 2-column grid,
 * which grew a row per pair and ate most of the screen before the category
 * cards were reachable — one row keeps the section a fixed height no matter how
 * many KPIs the server returns.
 */
export function KpiRail({ kpis, loading }: Readonly<KpiRailProps>) {
  const cards = loading
    ? [0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[76px] rounded-xl" style={{ width: CARD_WIDTH }} />
      ))
    : kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} width={CARD_WIDTH} />);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={RAIL_CONTENT}
    >
      {cards}
    </ScrollView>
  );
}
