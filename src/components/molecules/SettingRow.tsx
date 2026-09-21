import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

/**
 * Grouped settings list primitives, shared by the Profile and More screens so
 * a row looks and behaves the same wherever it appears. Extracted from
 * ProfileScreen when More adopted the same list idiom.
 */
interface SettingRowProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
  divider?: boolean;
}

export function SettingRow({
  icon,
  label,
  onPress,
  danger,
  trailing,
  divider,
}: Readonly<SettingRowProps>) {
  const destructive = useThemeColor('--destructive');
  const mutedForeground = useThemeColor('--muted-foreground');
  const rowClassName = cn(
    'flex-row items-center gap-3 px-4 py-3',
    divider && 'border-b border-border',
  );
  const content = (
    <>
      {/* Tonal icon chip — adds hierarchy + scannability to the flat list. */}
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-xl',
          danger ? 'bg-destructive/10' : 'bg-muted',
        )}
      >
        <Icon name={icon} size={18} color={danger ? destructive : undefined} />
      </View>
      <Text className={cn('flex-1 text-sm font-medium', danger && 'text-destructive')}>
        {label}
      </Text>
      {/* Danger rows intentionally omit the navigation chevron. */}
      {trailing ??
        (onPress && !danger ? (
          <Icon name="ChevronRight" size={18} color={mutedForeground} />
        ) : null)}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(rowClassName, 'active:opacity-70')}>
        {content}
      </Pressable>
    );
  }
  return <View className={rowClassName}>{content}</View>;
}

interface SettingGroupProps {
  label?: string;
  children: ReactNode;
}

export function SettingGroup({ label, children }: Readonly<SettingGroupProps>) {
  return (
    <View>
      {label ? (
        <Text className="mb-1.5 mt-5 px-5 text-[11px] font-bold tracking-widest text-muted-foreground">
          {label}
        </Text>
      ) : null}
      <View className={cn('mx-4 overflow-hidden rounded-2xl bg-card', !label && 'mt-5')}>
        {children}
      </View>
    </View>
  );
}
