import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MfaSetupForm } from '@/features/auth/components/MfaSetupForm';

export default function MfaSetupScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <MfaSetupForm />
      </View>
    </SafeAreaView>
  );
}
