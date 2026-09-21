import { View } from 'react-native';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

interface WizardCardProps {
  icon: IconName;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function WizardCard({ icon, title, description, children }: Readonly<WizardCardProps>) {
  const brand = useThemeColor('--brand');

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
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand/10">
          <Icon name={icon} size={18} color={brand} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">{title}</Text>
          {description !== undefined && (
            <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
          )}
        </View>
      </View>
      <View className="mt-4 gap-3">{children}</View>
    </View>
  );
}
