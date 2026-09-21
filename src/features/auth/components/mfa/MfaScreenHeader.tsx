import { Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { tokens } from '@theme/tokens';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

interface MfaScreenHeaderProps {
  title: string;
  onClose: () => void;
}

export function MfaScreenHeader({ title, onClose }: Readonly<MfaScreenHeaderProps>) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Pressable onPress={onClose} hitSlop={12} className="flex-row items-center gap-1">
        <ArrowLeft size={20} color={mutedFg} strokeWidth={2} />
        <Text className="text-sm text-muted-foreground">Close</Text>
      </Pressable>
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}
