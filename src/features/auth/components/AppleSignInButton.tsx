import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@theme';

/**
 * Official "Sign in with Apple" button. Apple's Human Interface Guidelines
 * require the system-rendered button (color/label/corner radius are the only
 * permitted customizations), so this wraps the native
 * `AppleAuthenticationButton` rather than a custom Pressable. Height/loading
 * overlay mirror GoogleSignInButton so the two stack consistently.
 */
const HEIGHT = 48;
// Matches the outline buttons' rendered `rounded-2xl` (Tailwind default 16px).
const CORNER_RADIUS = 16;

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function AppleSignInButton({ onPress, loading = false, disabled = false }: Readonly<Props>) {
  const { colorScheme } = useTheme();
  const buttonStyle =
    colorScheme === 'dark'
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <View
      style={{
        width: '100%',
        height: HEIGHT,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={buttonStyle}
        cornerRadius={CORNER_RADIUS}
        style={{ width: '100%', height: '100%', opacity: loading ? 0 : 1 }}
        onPress={() => {
          if (disabled || loading) return;
          onPress();
        }}
      />
      {loading ? <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center' }} /> : null}
    </View>
  );
}
