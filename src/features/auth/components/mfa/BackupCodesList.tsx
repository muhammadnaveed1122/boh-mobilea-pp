import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';

interface BackupCodesListProps {
  codes: readonly string[];
  title?: string;
  description?: string;
}

export function BackupCodesList({
  codes,
  title = 'Backup codes',
  description = 'Save these somewhere safe. Each code can be used once if you lose access to your authenticator app.',
}: Readonly<BackupCodesListProps>) {
  return (
    <View>
      <Text className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</Text>
      <Text className="mb-2 text-xs text-muted-foreground">{description}</Text>
      <View className="mb-5 rounded-lg bg-muted p-3">
        {codes.map((code) => (
          <Text key={code} selectable className="py-0.5 font-mono text-sm text-foreground">
            {code}
          </Text>
        ))}
      </View>
    </View>
  );
}
