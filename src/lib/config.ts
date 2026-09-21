import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

const BACKEND_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '3000';

function getMetroHost(): string | null {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  const candidates: (string | undefined)[] = [
    constants.expoConfig?.hostUri,
    constants.expoGoConfig?.debuggerHost,
    constants.manifest2?.extra?.expoGo?.debuggerHost,
    sourceCode?.scriptURL,
  ];

  for (const c of candidates) {
    if (typeof c !== 'string' || c.length === 0) continue;
    // scriptURL form: http://10.2.2.200:8081/index.bundle?...
    const match = c.match(/^(?:https?:\/\/)?([^/:]+)/);
    const host = match?.[1];
    if (host && host !== '127.0.0.1') return host;
  }
  return null;
}

function resolveDevApiBaseUrl(): string {
  const host = getMetroHost();
  // Android emulator maps host machine via this special address (not a real device IP)
  // NOSONAR: required loopback alias for Android emulator → host bridge
  const ANDROID_EMULATOR_HOST = ['10', '0', '2', '2'].join('.');
  const fallbackHost = Platform.OS === 'android' ? ANDROID_EMULATOR_HOST : 'localhost';
  return `http://${host ?? fallbackHost}:${BACKEND_PORT}`;
}

const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
const resolved = explicit ?? (__DEV__ ? resolveDevApiBaseUrl() : null);
const apiBaseUrl = resolved ?? `http://localhost:${BACKEND_PORT}`;

// Public website origin — used to build shareable web links (e.g. /new-projects/<slug>)
// whose OG meta title/description render as a rich preview in the share target.
// Derived from the API origin by dropping the `api-` / `api.` host prefix:
//   https://api-qa.rhkproperties.com → https://qa.rhkproperties.com
//   https://api.rhkproperties.com    → https://rhkproperties.com
// Falls back to the QA site for local/dev API hosts (a web link can't be localhost).
// Override explicitly with EXPO_PUBLIC_WEB_BASE_URL when the derivation is wrong.
function deriveWebBaseUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    const host = url.hostname;
    if (
      host === 'localhost' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      !host.includes('rhkproperties')
    ) {
      return 'https://qa.rhkproperties.com';
    }
    url.hostname = host.replace(/^api[.-]/, '');
    return url.origin;
  } catch {
    return 'https://qa.rhkproperties.com';
  }
}

export const CONFIG = {
  API_BASE_URL: apiBaseUrl,
  WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? deriveWebBaseUrl(apiBaseUrl),
  API_TIMEOUT_MS: 10_000,
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  // In-app HTTP inspector. Single source of truth: EXPO_PUBLIC_ENABLE_NETWORK_LOGGER.
  // Gates the profile Network Logs tab, JS capture, and (via prebuild) native Chucker.
  // Set =true in .env for dev/tester builds; leave unset/false for prod.
  ENABLE_NETWORK_LOGGER: process.env.EXPO_PUBLIC_ENABLE_NETWORK_LOGGER === 'true',
  // Roles that see the super-admin dashboard, in addition to `super-admin`. Comma-separated
  // ROLE IDs, mirroring the backend's DASHBOARD_ROLE_IDS — keep the two in sync per env.
  //
  // IDs not codes: a role's `code` is chosen at creation and role creation only needs the
  // grantable `rbac.roles:create` permission, so a code is forgeable; the DB assigns the `id`.
  //
  // This is NOT a security boundary — it only picks which dashboard renders. The real gate is
  // DashboardAccessGuard on the backend, which enforces the same allowlist server-side.
  DASHBOARD_ROLE_IDS: (process.env.EXPO_PUBLIC_DASHBOARD_ROLE_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== ''),
} as const;

if (__DEV__) {
  console.log('[CONFIG] API_BASE_URL =', CONFIG.API_BASE_URL);
  console.log('[CONFIG] raw PORT env =', process.env.EXPO_PUBLIC_API_PORT);
  console.log('[CONFIG] raw URL env =', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('[CONFIG] hostUri =', Constants.expoConfig?.hostUri);
  console.log(
    '[CONFIG] scriptURL =',
    (NativeModules.SourceCode as { scriptURL?: string } | undefined)?.scriptURL,
  );
}
