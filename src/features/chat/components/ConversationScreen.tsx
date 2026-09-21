import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useFocusEffect, useRouter } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useTheme, useThemeColor } from '@theme';

import type { MessageReplyRef } from '../models/message';
import { useConversation } from '../hooks/use-conversation';
import { useSetReaction } from '../hooks/use-set-reaction';
import { useLocationDraft } from '../store/location-draft';
import { ChannelFilterBar } from './ChannelFilterBar';
import { CANVAS_BG_DARK, CANVAS_BG_LIGHT } from './composer-colors';
import { Composer } from './Composer';
import { ConversationHeader } from './ConversationHeader';
import { DismissKeyboardButton } from './DismissKeyboardButton';
import { EmojiSheet, type EmojiSheetHandle } from './EmojiSheet';
import { MessageList, type MessageListHandle } from './MessageList';
import { ReactionPickerMenu } from './ReactionPickerMenu';
import { TemplateSheet, type TemplateSheetHandle } from './TemplateSheet';

interface Props {
  conversationId: string;
  /**
   * `true` (default) shows the WhatsApp + email unified thread (lead chats).
   * `false` locks a non-Messenger conversation to WhatsApp only (inbox chats).
   */
  unified?: boolean;
}

export function ConversationScreen({ conversationId, unified = true }: Readonly<Props>) {
  const router = useRouter();
  const primary = useThemeColor('--primary');
  const { colorScheme } = useTheme();
  // Channel-level permissions. The route guard already confirmed "any chat
  // access"; here we split it per channel so a user only reads/sends on the
  // channels they hold rights to.
  const canWhatsapp = useCan(PERMISSIONS.CHAT_WHATSAPP_RW);
  const canMessenger = useCan(PERMISSIONS.CHAT_MESSENGER_RW);

  const templateSheetRef = useRef<TemplateSheetHandle>(null);
  const openTemplateSheet = useCallback(() => {
    Keyboard.dismiss();
    templateSheetRef.current?.open();
  }, []);

  const {
    contact,
    subtitle,
    messages,
    activeFilter,
    setActiveFilter,
    availableFilters,
    sendChannel,
    setSendChannel,
    counts,
    send,
    retry,
    isLoading,
    isError,
    refetch,
    emailEnabled,
    leadId,
    phone,
    isMessenger,
    lockWhatsapp,
    windowExpiresAt,
    whatsappWindowOpen,
    whatsappNeedsTemplate,
    whatsappAwaitingReply,
  } = useConversation(conversationId, {
    unified,
    onTemplateRequired: openTemplateSheet,
    canWhatsapp,
    canMessenger,
  });

  // Send is gated by the channel the composer is currently pointed at — not a
  // blanket chat gate. Email is not chat-permissioned (lead-email path).
  const canSendSelected =
    sendChannel === 'email' || (sendChannel === 'whatsapp' ? canWhatsapp : canMessenger);

  const listRef = useRef<MessageListHandle>(null);
  const emojiSheetRef = useRef<EmojiSheetHandle>(null);
  const [replyTarget, setReplyTarget] = useState<MessageReplyRef | null>(null);
  const onPickReply = useCallback((ref: MessageReplyRef) => setReplyTarget(ref), []);
  const onCancelReply = useCallback(() => setReplyTarget(null), []);

  // Reaction picker state. `pickerAnchor.messageId` keeps the target id
  // around while the user transitions from the quick row to the full sheet.
  const [pickerAnchor, setPickerAnchor] = useState<{
    x: number;
    y: number;
    messageId: string;
  } | null>(null);
  const reactionMutation = useSetReaction(conversationId);

  const onLongPressBubble = useCallback(
    (messageId: string, anchor: { x: number; y: number }) =>
      setPickerAnchor({ ...anchor, messageId }),
    [],
  );
  const closePicker = useCallback(() => setPickerAnchor(null), []);
  const onQuickPick = useCallback(
    (emoji: string) => {
      if (!pickerAnchor) return;
      reactionMutation.mutate({ messageId: pickerAnchor.messageId, emoji });
      setPickerAnchor(null);
    },
    [pickerAnchor, reactionMutation],
  );
  const onSheetPick = useCallback(
    (emoji: string) => {
      if (!pickerAnchor) return;
      reactionMutation.mutate({ messageId: pickerAnchor.messageId, emoji });
      setPickerAnchor(null);
    },
    [pickerAnchor, reactionMutation],
  );
  const onOpenSheet = useCallback(() => {
    emojiSheetRef.current?.open();
  }, []);
  const onToggleReaction = useCallback(
    (messageId: string, emoji: string) => reactionMutation.mutate({ messageId, emoji }),
    [reactionMutation],
  );

  const pickerCurrent = pickerAnchor
    ? messages.find((m) => m.id === pickerAnchor.messageId)?.reactions?.find((r) => r.mine)?.emoji
    : undefined;

  const handleSend = useCallback(
    (payload: Parameters<typeof send>[0]) => {
      send(payload);
      setReplyTarget(null);
    },
    [send],
  );

  const onPickLocation = useCallback(() => {
    router.push({ pathname: '/(app)/chat/location-picker', params: { conversationId } });
  }, [router, conversationId]);

  // One-shot hand-off from the location-picker screen: when it sets a draft
  // matching this conversation, send it and clear so it doesn't resend on
  // subsequent focus events.
  const locationDraft = useLocationDraft((s) => s.draft);
  const clearLocationDraft = useLocationDraft((s) => s.clear);
  useFocusEffect(
    useCallback(() => {
      if (locationDraft && locationDraft.conversationId === conversationId) {
        handleSend({
          channel: 'whatsapp',
          text: '',
          location: locationDraft.location,
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        });
        clearLocationDraft();
      }
    }, [locationDraft, conversationId, handleSend, replyTarget, clearLocationDraft]),
  );

  // Keep the composer's send channel valid: messenger threads are single-channel
  // (pin to messenger); otherwise fall back off email when email is unavailable.
  useEffect(() => {
    if (isMessenger) {
      if (sendChannel !== 'messenger') setSendChannel('messenger');
    } else if (lockWhatsapp) {
      if (sendChannel !== 'whatsapp') setSendChannel('whatsapp');
    } else if (!emailEnabled && sendChannel === 'email') {
      setSendChannel('whatsapp');
    }
  }, [isMessenger, lockWhatsapp, emailEnabled, sendChannel, setSendChannel]);

  // The chat is a WhatsApp-palette surface end to end — leaving the root on the
  // app's navy `--background` makes it flash behind the composer while the
  // keyboard animates.
  const canvasBg = colorScheme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

  return (
    <View className="flex-1" style={{ backgroundColor: canvasBg }}>
      <ConversationHeader
        name={contact.name}
        subtitle={subtitle}
        leadId={leadId}
        phone={phone}
        conversationId={conversationId}
        channel={isMessenger ? 'messenger' : 'whatsapp'}
        windowExpiresAt={windowExpiresAt}
        withinWindow={isMessenger ? undefined : whatsappWindowOpen}
      />
      {isMessenger || lockWhatsapp || isLoading ? null : (
        <ChannelFilterBar
          active={activeFilter}
          counts={counts}
          onChange={setActiveFilter}
          filters={availableFilters}
        />
      )}

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Relative wrapper so the dismiss-keyboard glyph can float over the
            bottom-right of the thread instead of taking a full-width row. */}
        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center bg-background">
              <ActivityIndicator color={primary} />
            </View>
          ) : isError ? (
            <View className="flex-1 items-center justify-center bg-background px-8">
              <EmptyState
                icon="MessageSquareDashed"
                title="Couldn't load this conversation"
                description="Check your connection and try again."
              />
              <Pressable
                onPress={refetch}
                accessibilityRole="button"
                className="mt-4 rounded-full bg-primary px-5 py-2 active:opacity-80"
              >
                <Text className="font-semibold text-primary-foreground">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <MessageList
              ref={listRef}
              messages={messages}
              onRetry={retry}
              onReply={onPickReply}
              replyDisabled={whatsappWindowOpen === false}
              onLongPress={onLongPressBubble}
              onToggleReaction={onToggleReaction}
            />
          )}
          <DismissKeyboardButton />
        </View>
        <Composer
          channel={sendChannel}
          onChannelChange={setSendChannel}
          onSend={handleSend}
          onPickLocation={onPickLocation}
          emailEnabled={emailEnabled}
          sendDisabled={!canSendSelected}
          replyTo={replyTarget}
          onCancelReply={onCancelReply}
          isMessenger={isMessenger}
          whatsappWindowOpen={whatsappWindowOpen}
          whatsappNeedsTemplate={whatsappNeedsTemplate}
          whatsappAwaitingReply={whatsappAwaitingReply}
          onStartTemplate={openTemplateSheet}
        />
      </KeyboardAvoidingView>

      <ReactionPickerMenu
        visible={pickerAnchor !== null}
        anchor={pickerAnchor}
        myCurrent={pickerCurrent}
        onPick={onQuickPick}
        onOpenSheet={onOpenSheet}
        onClose={closePicker}
      />
      <EmojiSheet ref={emojiSheetRef} onPick={onSheetPick} />
      {leadId !== undefined && phone !== undefined ? (
        <TemplateSheet
          ref={templateSheetRef}
          leadId={leadId}
          leadName={contact.name}
          phone={phone}
        />
      ) : null}
    </View>
  );
}
