import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useElapsedTime } from '../hooks/use-elapsed-time';

/**
 * Isolated subcomponent that re-renders once per second while a check-in is
 * open. Keeping the ticking state confined here means the parent Card and
 * surrounding screen stay quiet.
 */
interface Props {
  startAt: string | Date;
  className?: string;
}

export function ElapsedTimer({ startAt, className }: Readonly<Props>) {
  const text = useElapsedTime(startAt);
  return (
    <Text
      className={cn('text-3xl font-semibold', className)}
      style={{ fontVariant: ['tabular-nums'] }}
      accessibilityLabel={`Elapsed time ${text}`}
    >
      {text}
    </Text>
  );
}
