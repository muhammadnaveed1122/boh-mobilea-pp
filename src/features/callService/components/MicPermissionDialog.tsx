/**
 * Shown when microphone permission is permanently denied. RN port of web
 * `MicrophonePermissionModal` — offers a deep link to system settings.
 */

import { Linking, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';

export interface MicPermissionDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function MicPermissionDialog({ visible, onClose }: Readonly<MicPermissionDialogProps>) {
  return (
    <Dialog
      visible={visible}
      onRequestClose={onClose}
      title="Microphone access needed"
      description="Calling requires microphone access. Enable it for this app in your device settings, then try again."
    >
      <View className="gap-3">
        <Button
          variant="default"
          onPress={() => {
            Linking.openSettings().catch(() => {});
            onClose();
          }}
        >
          <Text>Open Settings</Text>
        </Button>
        <Button variant="outline" onPress={onClose}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </Dialog>
  );
}
