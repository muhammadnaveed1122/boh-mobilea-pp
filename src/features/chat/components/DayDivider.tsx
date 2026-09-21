import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';

interface Props {
  label: string;
}

export function DayDivider({ label }: Readonly<Props>) {
  return (
    <View className="my-3 flex-row items-center justify-center">
      <View className="h-px flex-1 bg-border" />
      <View className="mx-3 rounded-full bg-muted px-3 py-1">
        <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      </View>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
