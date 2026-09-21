import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ImageBackground, ScrollView, View, type LayoutChangeEvent } from 'react-native';

import { EmptyState } from '@/components/atoms/EmptyState';
import { useTheme } from '@theme';

import type { Message, MessageReplyRef } from '../models/message';
import { CANVAS_BG_DARK, CANVAS_BG_LIGHT } from './composer-colors';
import { DayDivider } from './DayDivider';
import { MessageBubble } from './MessageBubble';

const CHAT_BG_LIGHT = require('../../../../assets/whatsapp-chat-bg/whatsapp-bg-light.png');
const CHAT_BG_DARK = require('../../../../assets/whatsapp-chat-bg/whatsapp-bg-dark.jpg');

export interface MessageListHandle {
  /** Animates the list to the given message; briefly pulses it once landed. */
  scrollToMessage: (messageId: string) => void;
}

interface Props {
  messages: Message[];
  /** Invoked when the user taps the retry affordance on a failed bubble. */
  onRetry?: (messageId: string) => void;
  /** Invoked when the user swipe-replies on a bubble. */
  onReply?: (reply: MessageReplyRef) => void;
  /** When true, swipe-to-reply is disabled on every bubble (window closed). */
  replyDisabled?: boolean;
  /** Invoked when the user long-presses a bubble (opens reaction picker). */
  onLongPress?: (messageId: string, anchor: { x: number; y: number }) => void;
  /** Invoked when the user taps an existing reaction pill (toggles own). */
  onToggleReaction?: (messageId: string, emoji: string) => void;
}

export const MessageList = forwardRef<MessageListHandle, Props>(function MessageList(
  { messages, onRetry, onReply, replyDisabled, onLongPress, onToggleReaction }: Readonly<Props>,
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<Map<string, number>>(new Map());
  const viewportRef = useRef(0);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const chatBg = isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT;
  // Both backdrops are opaque, so this only covers the beat before the image
  // decodes — without it the parent view flashes through in the wrong colour.
  const canvasBg = isDark ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

  // Pin to the latest message whenever the viewport resizes — i.e. when the
  // keyboard OR the attachment panel opens/closes the list shrinks/grows, and
  // the chat should ride up to keep the last message just above it (WhatsApp).
  const handleViewportLayout = (e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    if (h !== viewportRef.current) {
      viewportRef.current = h;
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  const handleRowLayout = (id: string) => (e: LayoutChangeEvent) => {
    offsetsRef.current.set(id, e.nativeEvent.layout.y);
  };

  const jumpTo = (id: string): void => {
    const y = offsetsRef.current.get(id);
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
    setPulseId(id);
    setTimeout(() => setPulseId((curr) => (curr === id ? null : curr)), 1200);
  };

  useImperativeHandle(ref, () => ({ scrollToMessage: jumpTo }), []);

  if (messages.length === 0) {
    return (
      <ImageBackground
        source={chatBg}
        resizeMode="cover"
        style={{ flex: 1, backgroundColor: canvasBg }}
      >
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="MessageSquareDashed"
            title="No messages"
            description="Nothing on this channel yet."
          />
        </View>
      </ImageBackground>
    );
  }

  let lastDay = '';

  return (
    <ImageBackground
      source={chatBg}
      resizeMode="cover"
      style={{ flex: 1, backgroundColor: canvasBg }}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
        onLayout={handleViewportLayout}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message, index) => {
          const showDivider = message.dayLabel !== lastDay;
          lastDay = message.dayLabel;
          return (
            // `clientKey` keeps a bubble we just sent mounted when its id flips
            // from the optimistic `tmp_…` to the server's — otherwise the row
            // remounts and replays its entry animation on every delivery tick.
            <View key={message.clientKey ?? message.id} onLayout={handleRowLayout(message.id)}>
              {showDivider ? <DayDivider label={message.dayLabel} /> : null}
              <MessageBubble
                message={message}
                index={index}
                onRetry={onRetry}
                onReply={onReply}
                replyDisabled={replyDisabled}
                onJumpToParent={jumpTo}
                pulse={pulseId === message.id}
                onLongPress={onLongPress}
                onToggleReaction={onToggleReaction}
              />
            </View>
          );
        })}
      </ScrollView>
    </ImageBackground>
  );
});
