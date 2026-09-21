import * as React from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

/** Lucide icon tinted with the muted-foreground token (Icon has no className). */
export function MutedIcon({ name, size = 18 }: Readonly<{ name: IconName; size?: number }>) {
  const color = useThemeColor('--muted-foreground');
  return <Icon name={name} size={size} color={color} />;
}

/** Titled card with a muted leading icon — the shared shell for every detail section. */
export function SectionCard({
  icon,
  title,
  children,
}: Readonly<{ icon: IconName; title: string; children: React.ReactNode }>) {
  return (
    <View className="rounded-2xl border border-border bg-card">
      <View className="flex-row items-center gap-2 px-4 pt-4">
        <MutedIcon name={icon} />
        <Text className="text-base font-semibold text-foreground">{title}</Text>
      </View>
      <View className="p-4">{children}</View>
    </View>
  );
}

/** Half-width labelled field; shows muted italic "Not entered yet" when empty. */
export function DetailItem({
  label,
  value,
}: Readonly<{ label: string; value: string | null | undefined }>) {
  const empty = !value || value === '—';
  return (
    <View className="w-1/2 pb-3 pr-3">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      <Text className={empty ? 'text-sm italic text-muted-foreground' : 'text-sm text-foreground'}>
        {empty ? 'Not entered yet' : value}
      </Text>
    </View>
  );
}
