import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  tagline?: string | null;
  className?: string;
  flush?: boolean;
  /** Draw the bottom separator between sections. Defaults to true. */
  divider?: boolean;
  children: ReactNode;
}

export function SectionWrap({
  title,
  tagline,
  className,
  flush,
  divider = true,
  children,
}: Readonly<Props>) {
  return (
    <View
      className={cn(
        flush ? 'px-0 py-6' : 'px-4 py-6',
        divider && 'border-b-8 border-muted',
        className,
      )}
    >
      {title ? (
        <View className={flush ? 'px-4' : undefined}>
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          {tagline ? <Text className="mt-1 text-sm text-muted-foreground">{tagline}</Text> : null}
        </View>
      ) : null}
      <View className={title ? 'mt-3' : undefined}>{children}</View>
    </View>
  );
}
