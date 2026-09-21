import * as icons from 'lucide-react-native/icons';
import { useThemeColor } from '@theme';

export type IconName = keyof typeof icons;

interface Props {
  name: IconName;
  color?: string;
  size?: number;
  fill?: string;
  strokeWidth?: number;
}

export function Icon({ name, color, size = 20, fill, strokeWidth }: Readonly<Props>) {
  const fallback = useThemeColor('--foreground');
  // eslint-disable-next-line import/namespace
  const LucideIcon = icons[name];
  // Only forward `fill` when explicitly set — passing it (even undefined) to
  // every lucide icon would fill all of them. Default keeps stroke-only icons.
  return (
    <LucideIcon
      color={color ?? fallback}
      size={size}
      {...(fill === undefined ? {} : { fill })}
      {...(strokeWidth === undefined ? {} : { strokeWidth })}
    />
  );
}
