import { Redirect, useLocalSearchParams } from 'expo-router';

import { PendingChatScreen } from '@/features/chat';
import { CHAT_WRITE, useRequirePermission } from '@/lib/rbac';

/**
 * In-flight template send to a number with no thread yet. The New chat sheet
 * pushes here the moment the user taps Send, so the wait is spent in a
 * conversation view with a pending bubble instead of on the sheet.
 */
export default function PendingChatRoute() {
  const { to, templateName, templateLanguage, templateBody, headerImageUrl } =
    useLocalSearchParams<{
      to: string;
      templateName: string;
      templateLanguage: string;
      templateBody?: string;
      headerImageUrl?: string;
    }>();
  const state = useRequirePermission(CHAT_WRITE);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;
  // A direct hit on this route without a template has nothing to send.
  if (!to || !templateName) return <Redirect href="/chat" />;

  return (
    <PendingChatScreen
      to={to}
      templateName={templateName}
      templateLanguage={templateLanguage}
      templateBody={templateBody === '' ? undefined : templateBody}
      headerImageUrl={headerImageUrl === '' ? undefined : headerImageUrl}
    />
  );
}
