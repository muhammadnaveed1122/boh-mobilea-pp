import { type ReactElement, type RefObject, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor, useThemeColorAlpha } from '@theme';

import { CHANNEL_META, type Channel } from '../models/channel';
import { capturePhotoOrVideo } from '../media/pick-media';
import {
  COMPOSER_BG_DARK,
  COMPOSER_BG_LIGHT,
  HAIRLINE_DARK,
  HAIRLINE_LIGHT,
  INPUT_BG_DARK,
  INPUT_BG_LIGHT,
} from './composer-colors';
import type { MessageReplyRef, PickedAsset, SendPayload } from '../models/message';
import { AttachmentPanel } from './AttachmentPanel';
import { VoiceRecorder } from './VoiceRecorder';

interface Props {
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  onSend: (payload: SendPayload) => void;
  /** When false, the Email send option is disabled (no linked lead). */
  emailEnabled?: boolean;
  /** When true, the whole composer is disabled (no chat read/write permission on either channel). */
  sendDisabled?: boolean;
  /**
   * Whether the WhatsApp 24h customer-service window is open. When closed,
   * free-text WhatsApp messages cannot be sent until the lead replies — the
   * WhatsApp input is locked and a hint banner is shown.
   */
  whatsappWindowOpen?: boolean;
  /** Current quote target. When set, a "replying to …" strip sits above the input. */
  replyTo?: MessageReplyRef | null;
  /** Dismiss the reply target without sending. */
  onCancelReply?: () => void;
  /**
   * Conversation has zero WhatsApp messages so far. The 24h window cannot be
   * opened with free text — the user must start with an approved template.
   * When true and `channel === 'whatsapp'`, the input is swapped for a
   * "Start with a template" CTA that calls `onStartTemplate`.
   */
  whatsappNeedsTemplate?: boolean;
  /** Open the template picker. Required when `whatsappNeedsTemplate` is true. */
  onStartTemplate?: () => void;
  /**
   * A template has already been sent while the window is closed and we are
   * waiting on the lead to reply. Swaps the template-gate copy from a cold
   * "start the thread" prompt to a "sent — waiting / send another" state so the
   * user knows their template went out. Only meaningful with
   * `whatsappNeedsTemplate`.
   */
  whatsappAwaitingReply?: boolean;
  /**
   * When true the composer is rendering inside a Messenger conversation.
   * The SendViaToggle is hidden (Messenger is single-channel) and no
   * WhatsApp 24h-window lock or template gating applies.
   */
  isMessenger?: boolean;
  /** Opens the location picker screen. Omitted → AttachmentSheet hides the Location tile. */
  onPickLocation?: () => void;
}

function SendViaToggle({
  channel,
  onChannelChange,
  emailEnabled = true,
}: Readonly<Pick<Props, 'channel' | 'onChannelChange' | 'emailEnabled'>>) {
  const successColor = useThemeColor('--success');
  const infoColor = useThemeColor('--info');

  return (
    <View className="flex-row items-center px-4 pb-2 pt-3">
      <Text className="mr-3 text-sm font-medium text-muted-foreground">Send via</Text>
      {(['whatsapp', 'email'] as const).map((c) => {
        const meta = CHANNEL_META[c];
        const isActive = channel === c;
        const accent = c === 'whatsapp' ? successColor : infoColor;
        const disabled = c === 'email' && !emailEnabled;
        return (
          <Pressable
            key={c}
            onPress={() => !disabled && onChannelChange(c)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            className={cn(
              'mr-2 flex-row items-center rounded-full border px-3 py-1.5 active:opacity-80',
              isActive ? 'border-transparent' : 'border-border bg-card',
              disabled ? 'opacity-40' : '',
            )}
            style={isActive ? { backgroundColor: accent } : undefined}
          >
            <Icon name={meta.icon} size={14} color={isActive ? '#FFFFFF' : accent} />
            <Text
              className={cn(
                'ml-1.5 text-sm font-semibold',
                isActive ? 'text-white' : 'text-foreground',
              )}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToolbarButton({
  icon,
  label,
}: Readonly<{ icon: 'Bold' | 'Italic' | 'Underline' | 'Link2' | 'Paperclip'; label: string }>) {
  const color = useThemeColor('--muted-foreground');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="mr-1 h-9 w-9 items-center justify-center rounded-lg active:bg-muted"
    >
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

function AttachmentPreview({
  asset,
  onClear,
}: Readonly<{ asset: PickedAsset; onClear: () => void }>) {
  const mutedColor = useThemeColor('--muted-foreground');
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      className="mx-3 mb-1 mt-1 flex-row items-center rounded-xl border border-border bg-background p-2"
    >
      {asset.kind === 'image' ? (
        <Image source={{ uri: asset.uri }} className="h-12 w-12 rounded-lg" resizeMode="cover" />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-muted">
          <Icon name={asset.kind === 'video' ? 'Video' : 'File'} size={20} color={mutedColor} />
        </View>
      )}
      <Text className="ml-2 flex-1 text-sm text-foreground" numberOfLines={1}>
        {asset.name}
      </Text>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel="Remove attachment"
        hitSlop={8}
        className="ml-2 h-7 w-7 items-center justify-center rounded-full active:bg-muted"
      >
        <Icon name="X" size={16} color={mutedColor} />
      </Pressable>
    </Animated.View>
  );
}

function ReplyPreview({
  reply,
  onCancel,
}: Readonly<{ reply: MessageReplyRef; onCancel?: () => void }>) {
  const accent = useThemeColor(CHANNEL_META[reply.channel].accentToken);
  const tint = useThemeColorAlpha(CHANNEL_META[reply.channel].accentToken, 0.12);
  const mutedColor = useThemeColor('--muted-foreground');
  const authorLabel = reply.author === 'self' ? 'You' : 'Replying to';
  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(100)}
      className="mx-3 mb-1 mt-1 flex-row items-center rounded-xl p-2"
      style={{ backgroundColor: tint, borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <View className="flex-1 pl-1">
        <Text className="text-[11px] font-semibold" style={{ color: accent }}>
          {authorLabel}
        </Text>
        <Text className="text-xs text-foreground" numberOfLines={1}>
          {reply.snippet}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        hitSlop={8}
        className="ml-2 h-7 w-7 items-center justify-center rounded-full active:bg-muted"
      >
        <Icon name="X" size={14} color={mutedColor} />
      </Pressable>
    </Animated.View>
  );
}

function ChannelHint({
  icon,
  message,
  color,
}: Readonly<{ icon: 'Clock' | 'MessageCircle'; message: string; color: string }>) {
  return (
    <View
      className="mx-3 mb-1 flex-row items-center rounded-xl border border-border bg-background p-2"
      accessibilityLiveRegion="polite"
    >
      <Icon name={icon} size={16} color={color} />
      <Text className="ml-2 flex-1 text-xs text-muted-foreground">{message}</Text>
    </View>
  );
}

/** The two mutually-exclusive WhatsApp gating banners above the input row. */
function ComposerBanners({
  lockedHint,
  showTemplateCta,
  whatsappAwaitingReply,
  warningColor,
}: Readonly<{
  lockedHint: boolean;
  showTemplateCta: boolean;
  whatsappAwaitingReply: boolean;
  warningColor: string;
}>) {
  if (lockedHint) {
    return (
      <ChannelHint
        icon="Clock"
        color={warningColor}
        message="Customer window closed. Wait for the lead to reply before sending a free message."
      />
    );
  }
  if (!showTemplateCta) return null;
  const message = whatsappAwaitingReply
    ? 'Template sent — waiting for the lead to reply. You can send another template until they do.'
    : 'Outside the 24h window — start with an approved template to message this contact.';
  return (
    <ChannelHint
      icon={whatsappAwaitingReply ? 'MessageCircle' : 'Clock'}
      color={warningColor}
      message={message}
    />
  );
}

function SendButton({
  canSend,
  primaryFg,
  mutedColor,
  onPress,
}: Readonly<{ canSend: boolean; primaryFg: string; mutedColor: string; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!canSend}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      className={cn(
        'h-8 w-8 items-center justify-center rounded-full active:opacity-80',
        canSend ? 'bg-primary' : 'bg-muted',
      )}
    >
      <Icon name="Send" size={18} color={canSend ? primaryFg : mutedColor} />
    </Pressable>
  );
}

function StartTemplateCta({
  onPress,
  primaryFg,
  label,
}: Readonly<{ onPress?: () => void; primaryFg: string; label: string }>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'h-11 flex-1 flex-row items-center justify-center rounded-full px-4 active:opacity-80',
        onPress ? 'bg-primary' : 'bg-muted',
      )}
    >
      <Icon name="MessageCircle" size={16} color={primaryFg} />
      <Text className="ml-2 text-sm font-semibold text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

interface WhatsAppRowProps {
  text: string;
  setText: (v: string) => void;
  whatsappLocked: boolean;
  placeholder: string;
  onInputFocus: () => void;
  inputRef: RefObject<TextInput | null>;
}

function WhatsAppRow({
  text,
  setText,
  whatsappLocked,
  placeholder,
  onInputFocus,
  inputRef,
}: Readonly<WhatsAppRowProps>) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const inputBg = isDark ? INPUT_BG_DARK : INPUT_BG_LIGHT;
  return (
    <View
      className="mr-1 flex-1 flex-row items-center rounded-3xl px-3"
      style={{
        backgroundColor: inputBg,
        borderWidth: 1,
        borderColor: isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT,
        opacity: whatsappLocked ? 0.5 : 1,
      }}
    >
      <Input
        ref={inputRef}
        value={text}
        onChangeText={setText}
        onFocus={onInputFocus}
        editable={!whatsappLocked}
        placeholder={placeholder}
        className="h-9 flex-1 border-0 bg-transparent px-1 text-sm"
      />
    </View>
  );
}

/**
 * WhatsApp-style attach toggle sitting OUTSIDE the input pill on its left:
 * a `+` when closed (opens the attach panel), a keyboard glyph when open
 * (tap to bring the OS keyboard back).
 */
function AttachToggleButton({
  open,
  onPress,
  disabled,
  color,
}: Readonly<{ open: boolean; onPress: () => void; disabled: boolean; color: string }>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Show keyboard' : 'Attach'}
      hitSlop={8}
      className="mr-1 h-8 w-8 items-center justify-center rounded-full active:bg-muted"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Icon name={open ? 'Keyboard' : 'Plus'} size={26} color={color} />
    </Pressable>
  );
}

/** Quick-camera button in the composer trailing (WhatsApp), plain grey glyph. */
function CameraButton({ onPress, color }: Readonly<{ onPress: () => void; color: string }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Camera"
      hitSlop={8}
      className="mr-1 h-8 w-8 items-center justify-center rounded-full active:bg-muted"
    >
      <Icon name="Camera" size={24} color={color} />
    </Pressable>
  );
}

function EmailToolbar() {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(120)}
      className="flex-row items-center border-t border-border px-3 py-2"
    >
      <ToolbarButton icon="Bold" label="Bold" />
      <ToolbarButton icon="Italic" label="Italic" />
      <ToolbarButton icon="Underline" label="Underline" />
      <ToolbarButton icon="Link2" label="Insert link" />
      <ToolbarButton icon="Paperclip" label="Attach file" />
    </Animated.View>
  );
}

function computeCanSend(args: {
  sendDisabled: boolean;
  whatsappLocked: boolean;
  isEmail: boolean;
  hasText: boolean;
  subjectTrimmed: string;
  hasAttachment: boolean;
}): boolean {
  if (args.sendDisabled || args.whatsappLocked) return false;
  if (args.isEmail) return args.hasText && args.subjectTrimmed.length > 0;
  return args.hasText || args.hasAttachment;
}

function templateCtaLabelFor(awaitingReply: boolean): string {
  return awaitingReply ? 'Send another template' : 'Start with a template';
}

function buildInputPlaceholder(channel: Channel, locked: boolean, hasAttachment: boolean): string {
  if (locked) return 'Waiting for lead to reply…';
  if (hasAttachment) return 'Add a caption...';
  return channel === 'messenger' ? 'Type a Messenger message...' : 'Type a WhatsApp message...';
}

function makeSendPayload(args: {
  channel: 'whatsapp' | 'email' | 'messenger';
  text: string;
  subject: string;
  attachment: PickedAsset | null;
  quote: MessageReplyRef | undefined;
}): SendPayload {
  const { channel, text, subject, attachment, quote } = args;
  if (channel === 'email') {
    return {
      channel: 'email',
      subject: subject.trim(),
      text: text.trim(),
      ...(quote ? { replyTo: quote } : {}),
    };
  }
  if (channel === 'messenger') {
    return {
      channel: 'messenger',
      text: text.trim(),
      ...(attachment ? { attachment } : {}),
      ...(quote ? { replyTo: quote } : {}),
    };
  }
  return {
    channel: 'whatsapp',
    text: text.trim(),
    ...(attachment ? { attachment } : {}),
    ...(quote ? { replyTo: quote } : {}),
  };
}

export function Composer({
  channel,
  onChannelChange,
  onSend,
  emailEnabled = true,
  sendDisabled = false,
  whatsappWindowOpen = true,
  replyTo = null,
  onCancelReply,
  whatsappNeedsTemplate = false,
  onStartTemplate,
  whatsappAwaitingReply = false,
  isMessenger = false,
  onPickLocation,
}: Readonly<Props>) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [attachment, setAttachment] = useState<PickedAsset | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  // While a voice note is being recorded the recording bar owns the whole row —
  // the attach button, text input and camera are unmounted so nothing is
  // squeezed and the cancel/send controls stay on screen.
  const [voiceRecording, setVoiceRecording] = useState(false);
  // Panel height tracks the keyboard so swapping keyboard ↔ attach panel is
  // seamless (the panel occupies exactly the space the keyboard vacated).
  const [kbHeight, setKbHeight] = useState(300);
  const inputRef = useRef<TextInput>(null);
  // Animated panel height (0 = closed/below viewport). Growing it pushes the
  // whole chat up; the inner view slides up from below as it grows.
  const panelH = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const { colorScheme } = useTheme();
  const composerBg = colorScheme === 'dark' ? COMPOSER_BG_DARK : COMPOSER_BG_LIGHT;
  const composerBorder = colorScheme === 'dark' ? HAIRLINE_DARK : HAIRLINE_LIGHT;
  const mutedColor = useThemeColor('--muted-foreground');
  // Composer action icons: use the foreground so they read dark on the light
  // bar and light on the dark bar.
  const iconColor = useThemeColor('--foreground');
  const primaryFg = useThemeColor('--primary-foreground');
  const warningColor = useThemeColor('--warning');

  const messengerMode = isMessenger || channel === 'messenger';
  const isEmail = channel === 'email';
  const whatsappLocked = channel === 'whatsapp' && !whatsappWindowOpen;
  const showTemplateCta = channel === 'whatsapp' && whatsappNeedsTemplate;
  const templateCtaLabel = templateCtaLabelFor(whatsappAwaitingReply);
  const hasText = text.trim().length > 0;
  const hasAttachment = attachment !== null;
  const canSend = computeCanSend({
    sendDisabled,
    whatsappLocked,
    isEmail,
    hasText,
    subjectTrimmed: subject.trim(),
    hasAttachment,
  });

  useEffect(() => {
    setAttachment(null);
    setAttachOpen(false);
    panelH.value = 0;
  }, [channel, panelH]);

  // Capture the live keyboard height so the attach panel matches it exactly.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 0;
      if (h > 0) setKbHeight(h);
    });
    return () => sub.remove();
  }, []);

  const placeholder = buildInputPlaceholder(channel, whatsappLocked, hasAttachment);
  // Custom slide-up: opening dismisses the keyboard and grows the panel height
  // from 0 → keyboard height (pushing the chat up); closing reverses it. Timing
  // roughly matches the keyboard so the swap feels like one continuous motion.
  const openPanel = (): void => {
    Keyboard.dismiss();
    setAttachOpen(true);
    panelH.value = withTiming(kbHeight, { duration: 260, easing: Easing.out(Easing.cubic) });
  };
  const closePanel = (): void => {
    setAttachOpen(false);
    panelH.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
  };
  // Toggle button: `+` when closed → open panel; keyboard icon when open →
  // focus the input (opens the OS keyboard) and slide the panel away.
  const onTogglePress = (): void => {
    if (attachOpen) {
      inputRef.current?.focus();
      closePanel();
    } else {
      openPanel();
    }
  };
  const onInputFocus = (): void => {
    if (attachOpen) closePanel();
  };
  const onCamera = (): void => {
    capturePhotoOrVideo()
      .then((a) => {
        if (a) setAttachment(a);
      })
      .catch(() => {});
  };

  const sendVoice = (asset: PickedAsset): void => {
    if (isEmail || sendDisabled || whatsappLocked) return;
    onSend(
      makeSendPayload({
        channel,
        text: '',
        subject,
        attachment: asset,
        quote: replyTo ?? undefined,
      }),
    );
    onCancelReply?.();
  };

  const handleSend = (): void => {
    if (!canSend) return;
    onSend(
      makeSendPayload({
        channel: isEmail ? 'email' : channel,
        text,
        subject,
        attachment,
        quote: replyTo ?? undefined,
      }),
    );
    setText('');
    setSubject('');
    setAttachment(null);
    onCancelReply?.();
  };

  const lockedHint = whatsappLocked && !showTemplateCta;

  return (
    <Animated.View
      style={{
        backgroundColor: composerBg,
        borderTopWidth: 1,
        borderTopColor: composerBorder,
        paddingBottom: keyboardVisible || attachOpen ? 0 : insets.bottom,
      }}
    >
      {messengerMode || !emailEnabled ? null : (
        <SendViaToggle
          channel={channel}
          onChannelChange={onChannelChange}
          emailEnabled={emailEnabled}
        />
      )}

      <ComposerBanners
        lockedHint={lockedHint}
        showTemplateCta={showTemplateCta}
        whatsappAwaitingReply={whatsappAwaitingReply}
        warningColor={warningColor}
      />

      {replyTo ? <ReplyPreview reply={replyTo} onCancel={onCancelReply} /> : null}

      {isEmail ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
          className="px-4 pb-1"
        >
          <Input
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            className="mb-2 bg-background"
          />
        </Animated.View>
      ) : null}

      {hasAttachment && !isEmail ? (
        <AttachmentPreview asset={attachment} onClear={() => setAttachment(null)} />
      ) : null}

      <View className="flex-row items-center px-1.5 pb-2 pt-1">
        {!isEmail && !showTemplateCta && !voiceRecording ? (
          <AttachToggleButton
            open={attachOpen}
            onPress={onTogglePress}
            disabled={whatsappLocked}
            color={iconColor}
          />
        ) : null}

        {voiceRecording
          ? null
          : renderInputArea({
              isEmail,
              text,
              setText,
              subject: undefined,
              whatsappLocked,
              placeholder,
              onInputFocus,
              inputRef,
              showTemplateCta,
              onStartTemplate,
              templateCtaLabel,
              primaryFg,
            })}

        {renderTrailingControl({
          showTemplateCta,
          showSendButton: isEmail || hasText || hasAttachment,
          canSend,
          primaryFg,
          mutedColor,
          iconColor,
          onSend: handleSend,
          onVoice: sendVoice,
          onCamera,
          showCamera: !isEmail && !voiceRecording,
          voiceDisabled: sendDisabled || whatsappLocked,
          voiceRecording,
          onVoiceRecordingChange: setVoiceRecording,
        })}
      </View>

      {isEmail ? <EmailToolbar /> : null}

      {!isEmail ? (
        <AttachSlide
          progress={panelH}
          height={kbHeight}
          onPicked={setAttachment}
          onClose={closePanel}
          onPickLocation={onPickLocation}
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * Custom slide-up attachment panel: always mounted. Its height animates
 * 0 → keyboard height (pushing the chat up); the inner view slides up from
 * below as it grows. Selecting anything closes it.
 */
function AttachSlide({
  progress,
  height,
  onPicked,
  onClose,
  onPickLocation,
}: Readonly<{
  progress: SharedValue<number>;
  height: number;
  onPicked: (asset: PickedAsset) => void;
  onClose: () => void;
  onPickLocation?: () => void;
}>) {
  const containerStyle = useAnimatedStyle(() => ({ height: progress.value }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: height - progress.value }],
  }));
  return (
    <Animated.View style={[containerStyle, { overflow: 'hidden' }]}>
      <Animated.View style={[{ height }, slideStyle]}>
        <AttachmentPanel
          onPicked={(a) => {
            onPicked(a);
            onClose();
          }}
          onPickLocation={
            onPickLocation
              ? () => {
                  onClose();
                  onPickLocation();
                }
              : undefined
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

interface RenderTrailingControlArgs {
  showTemplateCta: boolean;
  showSendButton: boolean;
  canSend: boolean;
  primaryFg: string;
  mutedColor: string;
  iconColor: string;
  onSend: () => void;
  onVoice: (asset: PickedAsset) => void;
  onCamera: () => void;
  showCamera: boolean;
  voiceDisabled: boolean;
  voiceRecording: boolean;
  onVoiceRecordingChange: (recording: boolean) => void;
}

function renderTrailingControl(args: RenderTrailingControlArgs): ReactElement | null {
  if (args.showTemplateCta) return null;
  if (args.showSendButton && !args.voiceRecording) {
    return (
      <SendButton
        canSend={args.canSend}
        primaryFg={args.primaryFg}
        mutedColor={args.mutedColor}
        onPress={args.onSend}
      />
    );
  }
  // WhatsApp idle trailing: camera + mic, both compact and centered. While
  // recording the wrapper stretches so the recording bar fills the row that the
  // input pill just vacated.
  return (
    <View className={cn('flex-row items-center', args.voiceRecording && 'flex-1')}>
      {args.showCamera ? <CameraButton onPress={args.onCamera} color={args.iconColor} /> : null}
      <VoiceRecorder
        onSend={args.onVoice}
        disabled={args.voiceDisabled}
        onRecordingChange={args.onVoiceRecordingChange}
      />
    </View>
  );
}

interface RenderInputAreaArgs {
  isEmail: boolean;
  text: string;
  setText: (v: string) => void;
  subject?: string;
  whatsappLocked: boolean;
  placeholder: string;
  onInputFocus: () => void;
  inputRef: RefObject<TextInput | null>;
  showTemplateCta: boolean;
  onStartTemplate?: () => void;
  templateCtaLabel: string;
  primaryFg: string;
}

function renderInputArea(args: RenderInputAreaArgs): ReactElement {
  if (args.isEmail) {
    return (
      <Textarea
        value={args.text}
        onChangeText={args.setText}
        placeholder="Compose your email..."
        className="mr-2 max-h-32 min-h-20 flex-1 bg-background"
      />
    );
  }
  if (args.showTemplateCta) {
    return (
      <StartTemplateCta
        onPress={args.onStartTemplate}
        primaryFg={args.primaryFg}
        label={args.templateCtaLabel}
      />
    );
  }
  return (
    <WhatsAppRow
      text={args.text}
      setText={args.setText}
      whatsappLocked={args.whatsappLocked}
      placeholder={args.placeholder}
      onInputFocus={args.onInputFocus}
      inputRef={args.inputRef}
    />
  );
}
