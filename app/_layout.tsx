// MUST be first: registers react-native-webrtc globals before any sip.js use.
import '@/features/callService/services/webrtc-bootstrap';
import { registerCallBackgroundHandler } from '@/features/callService/services/fcm-call-messaging';
import { registerVoipPush } from '@/features/callService/services/voip-push-ios';
import { useCallback, useEffect, useState } from 'react';
import { LogBox, View } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { KeyboardProvider, KeyboardToolbar } from 'react-native-keyboard-controller';
import { Theme } from '../theme';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
import { BiometricLock } from '../src/features/auth/components/BiometricLock';
import { EnableMfaPrompt } from '../src/features/auth/components/EnableMfaPrompt';
import { configureGoogleSignin } from '../src/features/auth/google-signin';
import { AuthPromptModal } from '../src/features/auth/components/AuthPromptModal';
import { ThemedStatusBar } from '../src/components/ThemedStatusBar';
import { CallProvider } from '../src/features/callService/components/CallProvider';
import { isActiveCall, useCallStore } from '../src/features/callService/store/call.store';
import { EnablePushPrompt } from '../src/features/notifications/components/EnablePushPrompt';
import { InAppBannerHost } from '../src/features/notifications/components/InAppBannerHost';
import { NotificationsProvider } from '../src/features/notifications/components/NotificationsProvider';
import { PushTokenRegistrar } from '../src/features/notifications/components/PushTokenRegistrar';
import { setOnAuthFailed, setOnTokensRefreshed, setAuthToken } from '../src/lib/api';
import { showToast } from '../src/lib/toast/toast.store';
import { ToastHost } from '../src/components/ToastHost';
import { getQueryClient } from '../src/lib/query-client';
import { useReactQueryAppFocus } from '../src/lib/query-focus';
import { usePermissionSync } from '../src/lib/rbac';
import { isBiometricAvailable } from '../src/lib/biometrics';
import { loadAuth, loadBiometricEnabled, saveAuth } from '../src/lib/secure-storage';
import { loadSignupSession } from '../src/lib/signup-storage';
import { getProfile } from '@/features/auth/services';
import { useAuthStore } from '../src/store/auth.store';
import { useOnboardingStore } from '../src/store/onboarding.store';
import '../global.css';

// Noisy dev-only warning from long chat/listing lists — it is a perf hint, not
// an error, and it fires constantly while scrolling. Muted so real warnings stay
// visible in the Metro console.
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

SplashScreen.preventAutoHideAsync().catch(() => {});
configureGoogleSignin();
// Module-scope so it is registered in both the normal app runtime AND the FCM
// headless runtime that boots when the app is killed (incoming-call wake).
registerCallBackgroundHandler();
// iOS PushKit VoIP wake listeners (iOS-only no-op on Android). Attached early so
// they exist before any VoIP push is delivered on cold start.
registerVoipPush();

export default function RootLayout() {
  const [animationDone, setAnimationDone] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [bioLocked, setBioLocked] = useState(false);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const loadOnboardingState = useOnboardingStore((s) => s.loadOnboardingState);
  const pathname = usePathname();
  // Any platform: once an incoming/active call lands during boot, cut the splash
  // short so the call screen (CallProvider's full-screen Modal) shows on connect
  // instead of the marketing animation. Covers the iOS CallKit answer path, whose
  // launch signal arrives async after first render.
  const callPresent = useCallStore((s) => s.incomingCall !== null || isActiveCall(s.activeCall));
  // When a call is minimized, the floating call bar occupies the top of the
  // screen — reserve that space so the app content slides down beneath it
  // (WhatsApp/Telegram behaviour) instead of being overlapped.
  const isCallMinimized = useCallStore((s) => s.isCallMinimized);
  const callBarReserve = callPresent && isCallMinimized ? 64 : 0;

  usePermissionSync();
  useReactQueryAppFocus();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (callPresent) setAnimationDone(true);
  }, [callPresent]);

  useEffect(() => {
    loadOnboardingState();
  }, [loadOnboardingState]);

  useEffect(() => {
    if (!animationDone || !authHydrated || hasSeenOnboarding === null) return;
    if (hasSeenOnboarding) return;
    if (pathname.startsWith('/onboarding')) return;
    router.replace('/(auth)/onboarding');
  }, [animationDone, authHydrated, hasSeenOnboarding, pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const persisted = await loadAuth();
        if (cancelled) return;
        if (!persisted) {
          // No session, but the user may have been mid-signup when the app died.
          // Restoring it lets a still-valid set-password window survive a cold start.
          const signupSession = await loadSignupSession();
          if (!cancelled && signupSession) {
            useAuthStore.getState().hydrateSignupSession(signupSession);
          }
          return;
        }
        let user = persisted.user;
        if (!user) {
          // Tokens survived but the cached user blob did not (e.g. iOS Keychain
          // outlives AsyncStorage across reinstall). Authorize with the token,
          // refetch the profile, and re-cache it.
          setAuthToken(persisted.tokens.accessToken);
          try {
            user = await getProfile();
            await saveAuth(user, persisted.tokens);
          } catch (e) {
            setAuthToken(null);
            console.warn('[auth] profile refetch failed, staying signed out', e);
            return;
          }
          if (cancelled) return;
        }
        useAuthStore.getState().hydrateAuth(user, persisted.tokens);
        const bioEnabled = await loadBiometricEnabled();
        if (cancelled) return;
        useAuthStore.setState({ biometricEnabled: bioEnabled });
        // Lock the restored session behind biometrics only when the user opted
        // in AND the device can actually prompt; otherwise let them straight in.
        if (bioEnabled && (await isBiometricAvailable()) && !cancelled) {
          setBioLocked(true);
        }
      } catch (e) {
        console.warn('[auth] hydration failed', e);
      } finally {
        if (!cancelled) setAuthHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOnTokensRefreshed((tokens) => {
      useAuthStore.getState().updateTokens(tokens);
    });
    setOnAuthFailed(() => {
      useAuthStore.getState().clearAuth();
      router.replace('/(auth)/login');
      showToast('info', 'Session expired. Please sign in again.');
    });
    return () => {
      setOnTokensRefreshed(null);
      setOnAuthFailed(null);
    };
  }, []);

  const handleFinish = useCallback(() => {
    setAnimationDone(true);
  }, []);

  // Answering a call bypasses the splash gates (auth hydration / onboarding):
  // the full-screen call Modal covers the UI while those settle in the
  // background, so there is no reason to hold the marketing splash.
  const skipSplashForCall = callPresent;
  const splashVisible =
    !skipSplashForCall && (!animationDone || !authHydrated || hasSeenOnboarding === null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={getQueryClient()}>
          <Theme>
            <KeyboardProvider>
              <BottomSheetModalProvider>
                <NotificationsProvider>
                  <ThemedStatusBar />
                  <View style={{ flex: 1, paddingTop: callBarReserve }}>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="(public)" />
                      <Stack.Screen name="(app)" />
                    </Stack>
                  </View>
                  <AuthPromptModal />
                  <EnableMfaPrompt />
                  <EnablePushPrompt />
                  {!pathname.startsWith('/chat/') && <KeyboardToolbar />}
                  <PortalHost />
                  <InAppBannerHost />
                  {authHydrated && <PushTokenRegistrar />}
                  <ToastHost />
                  <CallProvider />
                  {splashVisible && <AnimatedSplash onFinish={handleFinish} />}
                  {bioLocked && <BiometricLock onUnlock={() => setBioLocked(false)} />}
                </NotificationsProvider>
              </BottomSheetModalProvider>
            </KeyboardProvider>
          </Theme>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
