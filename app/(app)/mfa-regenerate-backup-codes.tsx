import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MfaRegenerateBackupCodesForm } from '@/features/auth/components/MfaRegenerateBackupCodesForm';

export default function MfaRegenerateBackupCodesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <MfaRegenerateBackupCodesForm />
      </View>
    </SafeAreaView>
  );
}
