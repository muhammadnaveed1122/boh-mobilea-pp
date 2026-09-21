import { View } from 'react-native';

import { Switch } from '@/components/atoms/Switch';
import { Text } from '@/components/atoms/Text';

/** A single portal toggle row — icon + title/subtitle on the left, a Switch on the right. */
export function PortalRow({
  icon,
  title,
  subtitle,
  checked,
  disabled = false,
  onChange,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-border px-4 py-3">
      <View className="mr-3 flex-1 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{title}</Text>
          <Text className="text-xs text-muted-foreground">{subtitle}</Text>
        </View>
      </View>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </View>
  );
}
