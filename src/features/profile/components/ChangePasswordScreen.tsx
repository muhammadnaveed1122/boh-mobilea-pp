import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { Header } from '@/components/organisms/Header';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { tokens } from '@theme/tokens';
import { useChangePasswordForm } from '../forms/change-password.form';
import { changePassword } from '../services';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

export function ChangePasswordScreen() {
  const router = useRouter();
  const updateTokens = useAuthStore((s) => s.updateTokens);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useChangePasswordForm(async (values) => {
    setSubmitError(null);
    const refreshToken = useAuthStore.getState().tokens?.refreshToken;
    if (!refreshToken) {
      setSubmitError('Session expired. Please sign in again.');
      return;
    }
    try {
      const response = await changePassword(
        values.currentPassword,
        values.newPassword,
        refreshToken,
      );
      if (response.tokens) {
        updateTokens(response.tokens);
      }
      Alert.alert('Password updated', 'Your password has been changed successfully.');
      router.back();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setSubmitError(err?.message ?? 'Could not change password. Please try again.');
    }
  });

  return (
    <View className="flex-1 bg-background">
      <Header title="Change Password" showBack />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4 items-center">
          <Lock size={36} color={mutedFg} strokeWidth={1.8} />
        </View>
        <Text className="mb-1 text-center text-xl font-bold text-foreground">
          Update your password
        </Text>
        <Text className="mb-6 text-center text-sm text-muted-foreground">
          Use at least 8 characters. Other sessions on this device stay signed in.
        </Text>

        <View className="mb-3">
          <form.AppField name="currentPassword">
            {(field) => (
              <field.Input
                label="Current password"
                placeholder="Current password"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
                rightElement={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    {showPassword ? (
                      <Eye size={18} color={mutedFg} strokeWidth={1.8} />
                    ) : (
                      <EyeOff size={18} color={mutedFg} strokeWidth={1.8} />
                    )}
                  </Pressable>
                }
              />
            )}
          </form.AppField>
        </View>

        <View className="mb-3">
          <form.AppField name="newPassword">
            {(field) => (
              <field.Input
                label="New password"
                placeholder="New password"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
              />
            )}
          </form.AppField>
        </View>

        <View className="mb-4">
          <form.AppField name="confirmPassword">
            {(field) => (
              <field.Input
                label="Confirm new password"
                placeholder="Confirm new password"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                leftIcon={<Lock size={18} color={mutedFg} strokeWidth={1.8} />}
              />
            )}
          </form.AppField>
        </View>

        {submitError ? (
          <Text className="mb-3 text-center text-sm text-destructive">{submitError}</Text>
        ) : null}

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              onPress={form.handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
              loadingLabel="Updating"
              size="lg"
              className="rounded-2xl"
            >
              <Text>Update password</Text>
            </Button>
          )}
        </form.Subscribe>
      </ScrollView>
    </View>
  );
}
