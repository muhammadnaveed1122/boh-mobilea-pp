import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';

interface Props {
  title: string;
  showBack?: boolean;
}

export function Header({ title, showBack = false }: Readonly<Props>) {
  const router = useRouter();
  const { top } = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: top }} className="flex-row items-center px-4 pb-3 bg-card border-b border-border">
      {showBack && (
        <Pressable onPress={() => router.back()} className="mr-3">
          <Icon name="ArrowLeft" size={22} />
        </Pressable>
      )}
      <Text variant="title" className="text-xl">{title}</Text>
    </View>
  );
}
