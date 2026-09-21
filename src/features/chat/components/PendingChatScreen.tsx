/**
 * PendingChatScreen — the conversation view for a template send whose thread
 * does not exist yet.
 *
 * `POST /chat/whatsapp/messages` only answers once Meta has accepted the
 * template, which is seconds of dead time. Rather than hold the New chat sheet
 * open on a spinner, the sheet hands the send over here: this screen renders
 * the outgoing bubble immediately with a `pending` tick, fires the send itself,
 * and `replace`s the route with the real `/chat/[id]` once the backend hands
 * back the conversation id — so the user lands in the thread, not back on a
 * sheet. A failed send stays here with a retry, since there is no thread to
 * fall back to.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useTheme, useThemeColor } from '@theme';

import { formatClockTime } from '../api/transforms';
import { apiErrorMessage, isSelectTemplateFirst } from '../api/error-message';
import { useStartChat } from '../hooks/use-start-chat';
import type { Message } from '../models/message';
import {
  COMPOSER_BG_DARK,
  COMPOSER_BG_LIGHT,
  HAIRLINE_DARK,
  HAIRLINE_LIGHT,
  INPUT_BG_DARK,
  INPUT_BG_LIGHT,
} from './composer-colors';
import { MessageList } from './MessageList';

export interface PendingChatScreenProps {
  /** Recipient in E.164. */
  to: string;
  /** Approved template being sent. */
  templateName: string;
  templateLanguage: string;
  /** Template body, rendered as the bubble text so the user sees what went out. */
  templateBody?: string;
  /** Listing image for a media-header template. */
  headerImageUrl?: string;
}

/** Minimal header: the real one needs a conversation id we do not have yet. */
function PendingHeader({ title, subtitle }: Readonly<{ title: string; subtitle: string }>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const fg = useThemeColor('--foreground');
  const avatarIcon = useThemeColor('--muted-foreground');

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        backgroundColor: isDark ? COMPOSER_BG_DARK : COMPOSER_BG_LIGHT,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT,
      }}
    >
      <View className="flex-row items-center px-3 pb-3 pt-1">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
        >
          <Icon name="ArrowLeft" size={22} color={fg} />
        </Pressable>

        <Avatar alt={title} className="ml-1 h-10 w-10">
          <AvatarFallback
            style={{ backgroundColor: isDark ? INPUT_BG_DARK : INPUT_BG_LIGHT }}
            textClassName="text-foreground"
          >
            <Icon name="User" size={22} color={avatarIcon} />
          </AvatarFallback>
        </Avatar>

        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PendingChatScreen({
  to,
  templateName,
  templateLanguage,
  templateBody,
  headerImageUrl,
}: Readonly<PendingChatScreenProps>) {
  const startChat = useStartChat();
  const canvasBg = useThemeColor('--background');
  const destructive = useThemeColor('--destructive');
  const primaryForeground = useThemeColor('--primary-foreground');

  // Built once: the bubble's clock time must not drift while the send is in
  // flight, and the row identity must stay stable across retries.
  const [bubble] = useState<Message>(() => ({
    id: 'pending_template_send',
    channel: 'whatsapp',
    direction: 'out',
    text: templateBody ?? templateName,
    time: formatClockTime(new Date().toISOString()),
    status: 'pending',
    dayLabel: 'Today',
    ...(headerImageUrl === undefined
      ? {}
      : {
          media: {
            messageId: 'pending_template_send',
            kind: 'image' as const,
            url: headerImageUrl,
          },
        }),
  }));

  const send = useCallback(() => {
    startChat.mutate(
      { to, templateName, templateLanguage, templateHeaderImageUrl: headerImageUrl },
      {
        // A Meta-side rejection still returns 200 with the message row marked
        // FAILED, so the thread exists either way — open it and let the real
        // conversation show the failed bubble and its reason.
        onSuccess: ({ conversationId }) => router.replace(`/chat/${conversationId}`),
      },
    );
    // `startChat` is a new object each render; depending on it would re-fire the
    // send on every state change of the mutation itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerImageUrl, templateLanguage, templateName, to]);

  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    send();
  }, [send]);

  const failed = startChat.isError;
  const messages: Message[] = [{ ...bubble, status: failed ? 'failed' : 'pending' }];
  const reason = failed
    ? isSelectTemplateFirst(startChat.error)
      ? 'This number needs an approved template. Go back and pick one.'
      : apiErrorMessage(startChat.error)
    : '';

  return (
    <View className="flex-1" style={{ backgroundColor: canvasBg }}>
      <PendingHeader title={to} subtitle={failed ? 'Not sent' : 'Sending…'} />
      <View className="flex-1">
        <MessageList messages={messages} onRetry={send} />
      </View>
      {failed ? (
        <View className="gap-2 border-t border-border px-4 py-3">
          <View className="flex-row items-start gap-2">
            <Icon name="TriangleAlert" size={16} color={destructive} />
            <Text className="flex-1 text-xs" style={{ color: destructive }}>
              {reason}
            </Text>
          </View>
          <Pressable
            onPress={send}
            accessibilityRole="button"
            accessibilityLabel="Retry sending the template"
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
          >
            <Icon name="RefreshCw" size={16} color={primaryForeground} />
            <Text className="font-semibold text-primary-foreground">Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
