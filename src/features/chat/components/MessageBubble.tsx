import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor, useThemeColorAlpha } from '@theme';

import { CHANNEL_META } from '../models/channel';
import type { Message, MessageReplyRef } from '../models/message';
import { ContactMessage } from './ContactMessage';
import { LinkedText } from './LinkedText';
import { LocationMessage } from './LocationMessage';
import { MediaMessage } from './MediaMessage';
import { ReactionBar } from './ReactionBar';

const SWIPE_REPLY_THRESHOLD = 64;
const LONG_PRESS_MS = 280;

interface Props {
  message: Message;
  index: number;
  onRetry?: (messageId: string) => void;
  /** Triggered when the user drag-releases past the swipe threshold. */
  onReply?: (reply: MessageReplyRef) => void;
  /** When true, swipe-to-reply (message mention) is disabled — e.g. the
   *  WhatsApp 24h window is closed so a reply couldn't be sent. */
  replyDisabled?: boolean;
  /** Triggered when the user taps the quoted strip of a reply bubble. */
  onJumpToParent?: (parentId: string) => void;
  /** When true, the bubble plays a brief pulse highlight (jump-to landing). */
  pulse?: boolean;
  /** Triggered on long-press; anchor is the touch coords in screen space. */
  onLongPress?: (messageId: string, anchor: { x: number; y: number }) => void;
  /** Toggle the caller's reaction on this message (same emoji removes). */
  onToggleReaction?: (messageId: string, emoji: string) => void;
}

function QuotedParentStrip({
  reply,
  accent,
  tint,
  onJump,
}: Readonly<{
  reply: MessageReplyRef;
  accent: string;
  tint: string;
  onJump?: (id: string) => void;
}>) {
  const handlePress = (): void => onJump?.(reply.id);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Jump to quoted message"
      className="mb-1.5 rounded-lg px-2 py-1.5 active:opacity-70"
      style={{ backgroundColor: tint, borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: accent }}>
        {reply.author === 'self' ? 'You' : 'Replying to'}
      </Text>
      <Text className="text-xs text-foreground" numberOfLines={1}>
        {reply.snippet}
      </Text>
    </Pressable>
  );
}

/** Renders the message body: a location card, media (+caption), or plain text. */
function BubbleContent({ message }: Readonly<{ message: Message }>) {
  const textNode = (
    <LinkedText text={message.text} className="text-[15px] leading-5 text-foreground" />
  );
  if (message.location) {
    return <LocationMessage location={message.location} />;
  }
  // The card carries the names, so the backend's "Contacts: <names>" text
  // would only repeat them — drop it.
  if (message.contacts && message.contacts.length > 0) {
    return <ContactMessage contacts={message.contacts} />;
  }
  if (message.media) {
    return (
      <View className="gap-1">
        <MediaMessage media={message.media} />
        {message.text ? textNode : null}
      </View>
    );
  }
  return textNode;
}

interface BubbleBodyProps {
  message: Message;
  isOut: boolean;
  outboundBg: string;
  inboundBg: string;
  accent: string;
  meta: (typeof CHANNEL_META)[keyof typeof CHANNEL_META];
  replyAccent: string;
  replyTint: string;
  failedRetryColor: string;
  onJumpToParent?: (parentId: string) => void;
  onRetry?: (messageId: string) => void;
}

function BubbleBody({
  message,
  isOut,
  outboundBg,
  inboundBg,
  accent,
  meta,
  replyAccent,
  replyTint,
  failedRetryColor,
  onJumpToParent,
  onRetry,
}: Readonly<BubbleBodyProps>) {
  const showFailed = isOut && message.status === 'failed' && onRetry;
  return (
    <View
      className={cn('rounded-2xl px-3.5 py-2.5', isOut ? 'rounded-br-md' : 'rounded-bl-md')}
      style={{ backgroundColor: isOut ? outboundBg : inboundBg }}
    >
      <View className="mb-1.5 flex-row items-center">
        <Badge variant={meta.chipVariant} className="px-2 py-0.5">
          <Icon name={meta.icon} size={11} color={accent} />
          <Text className="ml-1">{meta.label}</Text>
        </Badge>
        {isOut && message.senderName ? (
          <Text className="ml-2 flex-1 text-xs font-medium text-foreground/70" numberOfLines={1}>
            {message.senderName}
            {message.senderRole ? (
              <Text className="text-xs font-normal text-muted-foreground">
                {' '}
                ({message.senderRole})
              </Text>
            ) : null}
          </Text>
        ) : null}
      </View>

      {message.replyTo ? (
        <QuotedParentStrip
          reply={message.replyTo}
          accent={replyAccent}
          tint={replyTint}
          onJump={onJumpToParent}
        />
      ) : null}

      {message.subject ? (
        <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/70">
          {message.subject}
        </Text>
      ) : null}

      <BubbleContent message={message} />

      <View className="mt-1.5 flex-row items-center justify-end">
        <Text className="text-[11px] text-muted-foreground">{message.time}</Text>
        {isOut ? (
          <View className="ml-1">
            <ReadTicks status={message.status} />
          </View>
        ) : null}
      </View>

      {showFailed ? (
        <RetryRow color={failedRetryColor} onPress={() => onRetry(message.id)} />
      ) : null}
    </View>
  );
}

function RetryRow({ color, onPress }: Readonly<{ color: string; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Retry sending message"
      hitSlop={6}
      className="mt-1 flex-row items-center justify-end active:opacity-70"
    >
      <Icon name="RotateCw" size={12} color={color} />
      <Text className="ml-1 text-[11px] font-medium text-destructive">Tap to retry</Text>
    </Pressable>
  );
}

function ReadTicks({ status }: Readonly<{ status: Message['status'] }>) {
  // Bubble background is now a tinted channel accent (~22% alpha), so ticks
  // need a foreground-derived neutral that adapts to both themes. `read`
  // flips to `--info` blue, `failed` to `--destructive` red.
  const mutedTick = useThemeColor('--muted-foreground');
  const readColor = useThemeColor('--info');
  const failedColor = useThemeColor('--destructive');
  if (!status) return null;
  if (status === 'failed') {
    return <Icon name="CircleAlert" size={14} color={failedColor} />;
  }
  if (status === 'pending') {
    return <Icon name="Clock" size={14} color={mutedTick} />;
  }
  const isRead = status === 'read';
  return (
    <Icon
      name={status === 'sent' ? 'Check' : 'CheckCheck'}
      size={14}
      color={isRead ? readColor : mutedTick}
    />
  );
}

export function MessageBubble({
  message,
  index,
  onRetry,
  onReply,
  replyDisabled = false,
  onJumpToParent,
  pulse,
  onLongPress,
  onToggleReaction,
}: Readonly<Props>) {
  const isOut = message.direction === 'out';
  const isEmail = message.channel === 'email';
  const meta = CHANNEL_META[message.channel];
  const accent = useThemeColor(meta.accentToken);
  // Solid WhatsApp-style bubbles (opaque so the chat backdrop doesn't bleed
  // through): outbound green, inbound white/dark, per theme.
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const outboundBg = isDark ? '#005C4B' : '#D9FDD3';
  const inboundBg = isDark ? '#1F2C34' : '#FFFFFF';
  const failedRetryColor = useThemeColor('--destructive');
  const replyChannelToken = message.replyTo
    ? CHANNEL_META[message.replyTo.channel].accentToken
    : meta.accentToken;
  const replyAccent = useThemeColor(replyChannelToken);
  const replyTint = useThemeColorAlpha(meta.accentToken, 0.18);
  const pulseTint = useThemeColorAlpha(meta.accentToken, 0.45);

  // Pan to reply: drag right (inbound) or left (outbound) past threshold, fire
  // onReply, then settle back. Translation is shown via translateX. The return
  // uses a plain ease-out timing rather than a spring — the spring's overshoot
  // read as bounce on every swipe, which is noise on a gesture this frequent.
  const translateX = useSharedValue(0);
  const pulseProgress = useSharedValue(0);

  const direction = isOut ? -1 : 1;
  const fireReply = (): void => {
    if (!onReply) return;
    onReply({
      id: message.id,
      snippet:
        message.text.length > 80 ? `${message.text.slice(0, 80)}…` : message.text || '[Media]',
      author: isOut ? 'self' : 'them',
      channel: message.channel,
    });
  };

  const panGesture = Gesture.Pan()
    .enabled(!isEmail && !replyDisabled)
    .activeOffsetX(isOut ? [-12, 0] : [0, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet';
      const dx = e.translationX * direction;
      if (dx > 0) translateX.value = direction * Math.min(dx, 96);
    })
    .onEnd((e) => {
      'worklet';
      const passed = e.translationX * direction >= SWIPE_REPLY_THRESHOLD;
      translateX.value = withTiming(0, {
        duration: 160,
        easing: Easing.out(Easing.quad),
      });
      if (passed) scheduleOnRN(fireReply);
    });

  const fireLongPress = (x: number, y: number): void => {
    onLongPress?.(message.id, { x, y });
  };

  const longPressGesture = Gesture.LongPress()
    .enabled(!isEmail)
    .minDuration(LONG_PRESS_MS)
    .maxDistance(12)
    .onStart((e) => {
      'worklet';
      scheduleOnRN(fireLongPress, e.absoluteX, e.absoluteY);
    });

  // Race the two gestures so a swipe past the activeOffsetX cancels an
  // in-flight long press, and a 280ms hold without significant movement
  // cancels the pan. This matches WhatsApp's "either reply OR react" feel.
  // Email bubbles disable both via `.enabled(!isEmail)` on each gesture.
  const composedGesture = Gesture.Race(panGesture, longPressGesture);

  useEffect(() => {
    if (!pulse) return;
    pulseProgress.value = withSequence(
      withTiming(1, { duration: 220 }),
      withTiming(0, { duration: 520 }),
    );
  }, [pulse, pulseProgress]);

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    backgroundColor: pulseProgress.value > 0 ? pulseTint : 'transparent',
    borderRadius: 16,
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        entering={FadeInDown.duration(260).delay(Math.min(index, 8) * 28)}
        className={cn('mb-2 max-w-[82%]', isOut ? 'self-end' : 'self-start')}
      >
        <Animated.View style={translateStyle}>
          <Animated.View style={pulseStyle}>
            <BubbleBody
              message={message}
              isOut={isOut}
              outboundBg={outboundBg}
              inboundBg={inboundBg}
              accent={accent}
              meta={meta}
              replyAccent={replyAccent}
              replyTint={replyTint}
              failedRetryColor={failedRetryColor}
              onJumpToParent={onJumpToParent}
              onRetry={onRetry}
            />
          </Animated.View>
          {message.reactions && message.reactions.length > 0 ? (
            <ReactionBar
              reactions={message.reactions}
              channel={message.channel}
              isOut={isOut}
              onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
