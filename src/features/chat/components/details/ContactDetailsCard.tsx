import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

function DetailRow({
  icon,
  label,
  value,
}: Readonly<{ icon: 'Phone' | 'Mail'; label: string; value: string }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">
        <Icon name={icon} size={16} color={mutedFg} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Text>
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function ContactDetailsCard({
  phone,
  email,
}: Readonly<{ phone?: string | null; email?: string | null }>) {
  const validPhone = phone && phone.length > 0 ? phone : undefined;
  const validEmail = email && email.length > 0 ? email : undefined;
  return (
    <View className="gap-3 px-4 py-3">
      <Text className="text-base font-semibold">Contact details</Text>
      {validPhone ? <DetailRow icon="Phone" label="Phone" value={validPhone} /> : null}
      {validEmail ? <DetailRow icon="Mail" label="Email" value={validEmail} /> : null}
      {!validPhone && !validEmail ? (
        <Text className="text-sm text-muted-foreground">No contact details available</Text>
      ) : null}
    </View>
  );
}
