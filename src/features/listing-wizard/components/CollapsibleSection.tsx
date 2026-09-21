import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

/**
 * Collapsible card section — the RN counterpart of the web `CollapsibleSection` used on the
 * Portals step. Header toggles the body; styling matches `WizardCard`.
 */
export function CollapsibleSection({
  icon,
  title,
  description,
  defaultCollapsed = false,
  headerExtra,
  children,
}: Readonly<{
  icon: IconName;
  title: string;
  description?: string;
  defaultCollapsed?: boolean;
  headerExtra?: string;
  children: React.ReactNode;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <View
      className="rounded-2xl border border-border bg-card p-4"
      style={{
        shadowColor: '#101827',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        className="flex-row items-center gap-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand/10">
          <Icon name={icon} size={18} color={brand} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">{title}</Text>
          {description !== undefined && (
            <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
          )}
        </View>
        {headerExtra !== undefined && (
          <Text className="text-xs text-muted-foreground">{headerExtra}</Text>
        )}
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={18} color={mutedFg} />
      </Pressable>
      {collapsed ? null : <View className="mt-4 gap-3">{children}</View>}
    </View>
  );
}
