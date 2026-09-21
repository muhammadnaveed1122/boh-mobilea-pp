import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MfaDisableForm } from '@/features/auth/components/MfaDisableForm';

export default function MfaDisableScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <MfaDisableForm />
      </View>
    </SafeAreaView>
  );
}
