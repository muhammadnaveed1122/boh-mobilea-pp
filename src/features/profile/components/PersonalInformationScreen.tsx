import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { Header } from '@/components/organisms/Header';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { tokens } from '@theme/tokens';
import { usePersonalInformationForm } from '../forms/personal-information.form';
import { updateProfile } from '../services';

const mutedFg = `rgb(${tokens.light['--muted-foreground']})`;

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function PersonalInformationScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultFirstName = user?.profile?.firstName ?? '';
  const defaultLastName = user?.profile?.lastName ?? '';
  const displayName =
    user?.profile?.fullName?.trim() || `${defaultFirstName} ${defaultLastName}`.trim();

  const form = usePersonalInformationForm(
    {
      phone: user?.phone ?? '',
      profilePicture: null,
    },
    async (values) => {
      setSubmitError(null);
      try {
        const response = await updateProfile({
          phone: values.phone,
          profilePicture: values.profilePicture,
        });
        updateUser({
          id: response.id,
          email: response.email,
          mfaEnabled: response.mfaEnabled,
          profile: response.profile ?? null,
          roles: user?.roles ?? [],
          permissions: user?.permissions ?? [],
          hasAllAccess: user?.hasAllAccess ?? false,
        });
        Alert.alert('Saved', 'Your personal information has been updated.');
        router.back();
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        setSubmitError(err?.message ?? 'Could not update profile. Please try again.');
      }
    },
  );

  return (
    <View className="flex-1 bg-background">
      <Header title="Personal Information" showBack />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6">
          <form.AppField name="profilePicture">
            {(field) => (
              <field.ImagePicker
                fallbackInitials={getInitials(defaultFirstName, defaultLastName)}
                existingUrl={user?.profile?.profilePicUrl ?? null}
              />
            )}
          </form.AppField>
        </View>

        {displayName ? (
          <View className="mb-4 rounded-xl bg-muted px-3 py-2">
            <Text className="text-xs text-muted-foreground">Name</Text>
            <Text className="text-sm text-foreground">{displayName}</Text>
          </View>
        ) : null}

        {user?.email ? (
          <View className="mb-4 rounded-xl bg-muted px-3 py-2">
            <Text className="text-xs text-muted-foreground">Email</Text>
            <Text className="text-sm text-foreground">{user.email}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <form.AppField name="phone">
            {(field) => (
              <field.PhoneInput label="Phone" defaultCode="AE" placeholder="Phone number" />
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
              loadingLabel="Saving"
              size="lg"
              className="rounded-2xl"
            >
              <Text>Save changes</Text>
            </Button>
          )}
        </form.Subscribe>

        <View className="mt-6 flex-row items-center justify-center gap-1.5">
          <Mail size={12} color={mutedFg} />
          <Text className="text-xs text-muted-foreground">
            Name and email cannot be changed from this screen.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
