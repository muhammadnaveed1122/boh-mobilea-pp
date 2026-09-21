import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

/**
 * Tiny trend chart. Normalizes `data` into the given box; flat/empty data
 * renders a centered baseline so the card never looks broken.
 *
 * Promoted from `features/leads` — used by both the leads KPI cards and the
 * super-admin dashboard tiles (CLAUDE.md: promote to `src/components` at 2+ features).
 */
export function Sparkline({ data, color, width = 64, height = 24 }: Readonly<SparklineProps>) {
  if (!data || data.length === 0) return <View style={{ width, height }} />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pad = 2;
  const usableH = height - pad * 2;

  const points = data
    .map((value, i) => {
      const x = i * stepX;
      const y = pad + (1 - (value - min) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
