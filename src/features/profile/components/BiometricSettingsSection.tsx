import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Switch } from '@/components/atoms/Switch';
import { Text } from '@/components/atoms/Text';
import { authenticateBiometric, isBiometricAvailable } from '@/lib/biometrics';
import { useAuthStore } from '@/store/auth.store';

/**
 * Toggle for biometric quick-unlock. Hidden entirely on devices without
 * enrolled biometrics. Enabling requires one confirming scan; disabling is
 * immediate. Persistence lives in the auth store (`setBiometricEnabled`).
 */
export function BiometricSettingsSection() {
  const enabled = useAuthStore((s) => s.biometricEnabled);
  const setEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBiometricAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    if (busy) return;
    if (!next) {
      setEnabled(false);
      return;
    }
    setBusy(true);
    const ok = await authenticateBiometric('Confirm to enable quick unlock');
    setBusy(false);
    if (ok) setEnabled(true);
  };

  // Don't surface the option on devices that can't use it.
  if (available !== true) return null;

  return (
    <View>
      <Text className="mt-6 px-4 text-xl font-bold text-foreground">App Lock</Text>
      <View className="mx-4 mt-3 overflow-hidden rounded-2xl bg-card">
        <View className="flex-row items-center gap-3 px-4 py-4">
          <Icon name="ScanFace" size={20} />
          <View className="flex-1">
            <Text className="text-sm font-medium">Biometric unlock</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              Use Face ID or fingerprint to reopen the app
            </Text>
          </View>
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={busy} />
        </View>
      </View>
    </View>
  );
}
