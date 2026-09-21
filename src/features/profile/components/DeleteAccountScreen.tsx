import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react-native';
import { Header } from '@/components/organisms/Header';
import { Text } from '@/components/atoms/Text';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { ApiError } from '@/lib/api-error';
import { useThemeColor } from '@theme';
import { clearLocalSession } from '@/features/auth/session';
import { AppleSignInCancelledError, signInWithApple } from '@/features/auth/apple-signin';
import { GoogleSignInCancelledError, signInWithGoogle } from '@/features/auth/google-signin';
import { showToast } from '@/lib/toast/toast.store';
import {
  deleteAccount,
  getDeleteInfo,
  type DeleteAccountPayload,
  type DeleteInfo,
} from '../services';

function confirmDelete(onConfirm: () => void): void {
  Alert.alert(
    'Delete Account',
    'This deletes your account and signs you out. Are you sure you want to continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ],
  );
}

export function DeleteAccountScreen() {
  const router = useRouter();
  const destructive = useThemeColor('--destructive');
  const [info, setInfo] = useState<DeleteInfo | null>(null);
  const [infoError, setInfoError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDeleteInfo()
      .then(setInfo)
      .catch(() => setInfoError(true));
  }, []);

  let statusNode: ReactNode = null;
  if (infoError) {
    statusNode = (
      <Text className="text-center text-sm text-destructive">
        Could not load account details. Please try again later.
      </Text>
    );
  } else if (info === null) {
    statusNode = <ActivityIndicator className="mt-4" />;
  }

  // Shared tail: server already invalidated every session, so clear local state
  // only (an authed call here would 401 and show a spurious "Session expired").
  async function finishDelete(payload: DeleteAccountPayload): Promise<void> {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await deleteAccount(payload);
      clearLocalSession();
      router.replace('/');
      showToast('success', 'Your account has been deleted.');
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setSubmitError(err?.message ?? 'Could not delete your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Header title="Delete Account" showBack />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4 items-center">
          <TriangleAlert size={36} color={destructive} strokeWidth={1.8} />
        </View>
        <Text className="mb-1 text-center text-xl font-bold text-foreground">
          Delete your account
        </Text>
        <Text className="mb-6 text-center text-sm text-muted-foreground">
          Your account will be deleted and you will be signed out. Confirm below to continue.
        </Text>

        {statusNode}
        {submitError !== null ? (
          <Text className="mb-3 text-center text-sm text-destructive">{submitError}</Text>
        ) : null}

        {info?.requiresPassword === true ? (
          <PasswordSection
            isSubmitting={isSubmitting}
            onDelete={(password) => finishDelete({ password })}
          />
        ) : null}

        {info !== null && !info.requiresPassword ? (
          <SocialSection
            info={info}
            isSubmitting={isSubmitting}
            onError={setSubmitError}
            onDelete={finishDelete}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

interface PasswordSectionProps {
  isSubmitting: boolean;
  onDelete: (password: string) => void;
}

function PasswordSection({ isSubmitting, onDelete }: Readonly<PasswordSectionProps>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Text className="mb-1.5 text-sm font-medium text-foreground">Current password</Text>
      <View className="mb-4 flex-row items-center">
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Current password"
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          autoCapitalize="none"
          className="flex-1 pr-10"
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          hitSlop={8}
          className="absolute right-3"
        >
          {showPassword ? (
            <Eye size={18} color={mutedFg} strokeWidth={1.8} />
          ) : (
            <EyeOff size={18} color={mutedFg} strokeWidth={1.8} />
          )}
        </Pressable>
      </View>
      <Button
        onPress={() => confirmDelete(() => onDelete(password))}
        disabled={password.length === 0}
        loading={isSubmitting}
        loadingLabel="Deleting"
        variant="destructive"
        size="lg"
        className="rounded-2xl"
      >
        <Text>Delete Account</Text>
      </Button>
    </>
  );
}

interface SocialSectionProps {
  info: DeleteInfo;
  isSubmitting: boolean;
  onError: (message: string) => void;
  onDelete: (payload: DeleteAccountPayload) => Promise<void>;
}

function SocialSection({ info, isSubmitting, onError, onDelete }: Readonly<SocialSectionProps>) {
  function deleteWithApple(): void {
    confirmDelete(() => {
      signInWithApple()
        .then((result) =>
          onDelete({
            appleIdentityToken: result.identityToken,
            appleAuthorizationCode: result.authorizationCode,
          }),
        )
        .catch((e: unknown) => {
          if (e instanceof AppleSignInCancelledError) return;
          onError('Apple re-authentication failed. Please try again.');
        });
    });
  }

  function deleteWithGoogle(): void {
    confirmDelete(() => {
      signInWithGoogle()
        .then((idToken) => onDelete({ googleIdToken: idToken }))
        .catch((e: unknown) => {
          if (e instanceof GoogleSignInCancelledError) return;
          onError('Google re-authentication failed. Please try again.');
        });
    });
  }

  return (
    <>
      <Text className="mb-4 text-center text-sm text-muted-foreground">
        For your security, re-authenticate to confirm deletion.
      </Text>
      {info.appleLinked ? (
        <Button
          onPress={deleteWithApple}
          loading={isSubmitting}
          loadingLabel="Deleting"
          variant="destructive"
          size="lg"
          className="mb-3 rounded-2xl"
        >
          <Text>Confirm with Apple & Delete</Text>
        </Button>
      ) : null}
      {info.googleLinked ? (
        <Button
          onPress={deleteWithGoogle}
          loading={isSubmitting}
          loadingLabel="Deleting"
          variant="destructive"
          size="lg"
          className="rounded-2xl"
        >
          <Text>Confirm with Google & Delete</Text>
        </Button>
      ) : null}
    </>
  );
}
