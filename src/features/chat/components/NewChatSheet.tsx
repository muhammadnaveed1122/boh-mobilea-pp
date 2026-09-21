/**
 * Start a WhatsApp chat with a phone number the CRM may never have seen.
 *
 * Mirrors the web `NewMessageModal`. Once the typed number looks complete the
 * sheet debounces and asks the backend whether the 24h customer-service window
 * is open for it: open ⇒ keep the plain message box, closed ⇒ swap in the
 * template picker right there, before anything is sent. The post-send
 * `SELECT_TEMPLATE_FIRST` path stays as the backstop — the probe can be stale
 * (a window closing between check and send), and the server is authoritative.
 */

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useThemeColor } from '@theme';

import { apiErrorMessage, isSelectTemplateFirst } from '../api/error-message';
import { requiresHeaderImage } from '../api/template-header';
import type { ApiWhatsappTemplate } from '../api/types';
import { useStartChat } from '../hooks/use-start-chat';
import { useWhatsappTemplates } from '../hooks/use-whatsapp-templates';
import { useWhatsappWindowByPhone } from '../hooks/use-whatsapp-window';
import type { ListingCard } from '../models/contact';
import { ListingAttachment } from './contacts/ListingAttachment';
import { ListingPickerSheet, type ListingPickerSheetHandle } from './contacts/ListingPickerSheet';

export interface NewChatSheetHandle {
  open: () => void;
  close: () => void;
}

/** Digits only, `+`-prefixed. Matches the web client's normalization. */
export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits === '' ? '' : `+${digits}`;
}

/** Meta accepts 7–15 digit subscriber numbers; same bounds as the web schema. */
export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Whether the number is complete enough to spend a window-status request on.
 * Deliberately stricter than {@link isValidPhone} (which allows short national
 * numbers) so the probe doesn't fire on every keystroke of a country code —
 * the web modal uses the same 10-digit floor.
 */
function isProbeReady(raw: string): boolean {
  return raw.replace(/\D/g, '').length >= 10;
}

interface WindowProbe {
  /** No verdict yet for what's currently typed — a send must wait. */
  isChecking: boolean;
  /** Definite "24h window shut": WhatsApp will only deliver a template. */
  isClosed: boolean;
  /** Definite "window open": free text is allowed. */
  isOpen: boolean;
}

/**
 * Debounced pre-send window check for the number being typed. All three flags
 * are false while the number is too short to look up, and a failed request
 * resolves to neither open nor closed — the sheet then keeps its optimistic
 * free-text box and lets the send's SELECT_TEMPLATE_FIRST have the last word.
 */
function useWindowProbe(phone: string): WindowProbe {
  const debounced = useDebouncedValue(phone, 500);
  const probePhone = isProbeReady(debounced) ? toE164(debounced) : '';
  const { data, isError } = useWhatsappWindowByPhone(probePhone);

  // The debounce trails the input: any verdict we hold belongs to the previous
  // number, so it must not be shown against this one.
  const stale = toE164(phone) !== probePhone;
  const answered = !stale && probePhone !== '';
  const settled = answered && data !== undefined;

  return {
    isChecking: isProbeReady(phone) && !settled && !(answered && isError),
    isClosed: settled && data.withinWindow !== true,
    isOpen: settled && data.withinWindow,
  };
}

/**
 * Inline verdict under the phone field. Silent until the number is worth
 * probing, and silent again once the window is known to be closed — the
 * template picker that replaces the message box says it better than a hint
 * line would.
 */
function WindowProbeRow({ probe }: Readonly<{ probe: WindowProbe }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const success = useThemeColor('--success');

  if (probe.isChecking) {
    return (
      <View className="flex-row items-center gap-1.5">
        <ActivityIndicator size="small" color={mutedFg} />
        <Text variant="muted" className="text-xs">
          Checking messaging window…
        </Text>
      </View>
    );
  }

  if (!probe.isOpen) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name="CircleCheck" size={14} color={success} />
      <Text className="text-xs" style={{ color: success }}>
        Window open — you can send a message directly.
      </Text>
    </View>
  );
}

interface Props {
  /** Called with the resolved conversation id instead of navigating to it. */
  onStarted?: (conversationId: string) => void;
}

export const NewChatSheet = forwardRef<NewChatSheetHandle, Props>(function NewChatSheet(
  { onStarted }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const background = useThemeColor('--background');
  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const primaryForeground = useThemeColor('--primary-foreground');
  const snapPoints = useMemo(() => ['75%'], []);

  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  // Set only by a send the server rejected with SELECT_TEMPLATE_FIRST. Kept
  // apart from the probe result so a later "window open" response can't unlock
  // free text for a number the server has already refused it for.
  const [serverForcedTemplate, setServerForcedTemplate] = useState(false);
  const [template, setTemplate] = useState<ApiWhatsappTemplate | null>(null);
  const [listing, setListing] = useState<ListingCard | null>(null);
  const listingSheet = useRef<ListingPickerSheetHandle>(null);

  const startChat = useStartChat();
  const { data: templateRows } = useWhatsappTemplates();
  const templates = useMemo(
    () => (templateRows ?? []).filter((t) => t.status === 'APPROVED'),
    [templateRows],
  );

  const reset = useCallback(() => {
    setPhone('');
    setMessage('');
    setServerForcedTemplate(false);
    setTemplate(null);
    setListing(null);
  }, []);

  // Editing the number invalidates whatever the server said about the previous
  // one; the probe below re-decides once the new number settles.
  const onChangePhone = useCallback((next: string) => {
    setPhone(next);
    setServerForcedTemplate(false);
    setTemplate(null);
    setListing(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        reset();
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }),
    [reset],
  );

  const phoneOk = isValidPhone(phone);

  // Window closed (or never opened) ⇒ WhatsApp only delivers an approved
  // template, so the message box is replaced by the picker before any send.
  const probe = useWindowProbe(phone);
  const needsTemplate = serverForcedTemplate || probe.isClosed;

  // A listing-card template carries an IMAGE header; Meta rejects the send with
  // 131008 when no media accompanies it, so block rather than let it fail.
  const needsListing = requiresHeaderImage(template);
  const missingListing = needsListing && listing === null;
  const canSend =
    phoneOk &&
    !startChat.isPending &&
    !probe.isChecking &&
    !missingListing &&
    (needsTemplate ? template !== null : message.trim() !== '');

  const onSend = useCallback(() => {
    if (!canSend) return;
    // Template sends wait on Meta, which is seconds long. Hand the send to the
    // pending-chat screen so the sheet closes at once and the user watches a
    // real bubble go from "sending" to the opened thread. Free-text sends stay
    // inline: the server can still answer SELECT_TEMPLATE_FIRST, and that
    // backstop needs this sheet's template picker to still be on screen.
    if (needsTemplate && template !== null && !onStarted) {
      sheetRef.current?.dismiss();
      const params = {
        to: toE164(phone),
        templateName: template.name,
        templateLanguage: template.language,
        templateBody: template.body ?? '',
        headerImageUrl: listing?.imageUrl ?? '',
      };
      reset();
      router.push({ pathname: '/chat/new', params });
      return;
    }
    startChat.mutate(
      {
        to: toE164(phone),
        // Template sends carry no free text — Meta renders the approved body.
        ...(needsTemplate && template !== null
          ? {
              templateName: template.name,
              templateLanguage: template.language,
              templateHeaderImageUrl: listing?.imageUrl,
            }
          : { content: message.trim() }),
      },
      {
        onSuccess: ({ conversationId }) => {
          sheetRef.current?.dismiss();
          reset();
          // The backend's findOrCreate hands back the existing thread when
          // there already is one, so this opens it rather than duplicating.
          if (onStarted) onStarted(conversationId);
          else router.push(`/chat/${conversationId}`);
        },
        onError: (error) => {
          // Not a failure the user caused — the window shut between the probe
          // and the send, so switch to template mode and let them pick one.
          if (isSelectTemplateFirst(error)) {
            setServerForcedTemplate(true);
            return;
          }
          Alert.alert('Could not start chat', apiErrorMessage(error));
        },
      },
    );
  }, [canSend, listing, message, needsTemplate, onStarted, phone, reset, startChat, template]);

  const inputStyle = {
    height: 48,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: foreground,
  } as const;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: mutedFg }}
    >
      <View className="flex-1">
        {/* BottomSheetScrollView, not ScrollView: the sheet's own pan handler
            swallows a plain ScrollView's gesture, so the template list — which
            can easily outgrow the sheet — would not scroll at all. */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text variant="subheading">New chat</Text>
            <Text variant="muted">
              Send a WhatsApp message to any number from your business number.
            </Text>
          </View>

          <View className="gap-2">
            <Text variant="label">Phone number</Text>
            <BottomSheetTextInput
              value={phone}
              onChangeText={onChangePhone}
              placeholder="+9715XXXXXXX"
              placeholderTextColor={mutedFg}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={inputStyle}
            />
            <WindowProbeRow probe={probe} />
            <Text variant="muted" className="text-xs">
              Include the country code.
            </Text>
          </View>

          {needsTemplate ? (
            <View className="gap-2">
              <View className="flex-row items-start gap-2 rounded-xl bg-muted p-3">
                <Icon name="Info" size={16} color={mutedFg} />
                <Text className="flex-1 text-xs text-muted-foreground">
                  This number has not messaged you in the last 24 hours, so WhatsApp only allows an
                  approved template.
                </Text>
              </View>
              <Text variant="label">Template</Text>
              {templates.length === 0 ? (
                <Text variant="error" className="text-xs">
                  No approved templates available. Ask an admin to create one.
                </Text>
              ) : (
                templates.map((t) => {
                  const isActive = template?.id === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setTemplate(t);
                        setListing(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityLabel={t.name}
                      accessibilityState={{ selected: isActive }}
                      className={
                        isActive
                          ? 'rounded-2xl border-2 border-primary bg-card p-3'
                          : 'rounded-2xl border border-border bg-card p-3'
                      }
                    >
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {t.name}
                      </Text>
                      {t.body ? (
                        <Text variant="muted" numberOfLines={3} className="mt-1">
                          {t.body}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}

              {needsListing ? (
                <ListingAttachment
                  listing={listing}
                  required
                  onPick={() => listingSheet.current?.open()}
                  onClear={() => setListing(null)}
                />
              ) : null}
            </View>
          ) : (
            <View className="gap-2">
              <Text variant="label">Message</Text>
              <BottomSheetTextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Type your message"
                placeholderTextColor={mutedFg}
                multiline
                textAlignVertical="top"
                style={{ ...inputStyle, height: undefined, minHeight: 100, paddingTop: 12 }}
              />
            </View>
          )}
        </BottomSheetScrollView>

        {/* Pinned action bar. The template list can run far past the fold, so a
            send button living at the end of the scroll content is effectively
            invisible the moment a template is picked. */}
        <View
          className="border-t border-border px-4 pt-3"
          style={{ backgroundColor: background, paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {needsTemplate && template !== null ? (
            <View className="mb-2 flex-row items-center gap-2">
              <Text variant="muted" className="text-xs">
                Template
              </Text>
              <Text
                className="flex-1 text-xs font-semibold text-foreground"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {template.name}
              </Text>
            </View>
          ) : null}
          {/* Why the button is dead, said next to the button — the listing
              prompt itself is up in the scroll area and easily off-screen. */}
          {missingListing ? (
            <Pressable
              onPress={() => listingSheet.current?.open()}
              accessibilityRole="button"
              accessibilityLabel="Attach a listing"
              className="mb-2 flex-row items-center gap-1.5 active:opacity-70"
            >
              <Icon name="TriangleAlert" size={14} color={mutedFg} />
              <Text variant="muted" className="flex-1 text-xs">
                This template sends a listing card — tap to attach a listing.
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
            style={{ opacity: canSend ? 1 : 0.5 }}
          >
            {startChat.isPending ? (
              <ActivityIndicator color={primaryForeground} />
            ) : (
              <>
                <Icon name="Send" size={18} color={primaryForeground} />
                <Text className="font-semibold text-primary-foreground">
                  {needsTemplate ? 'Send template' : 'Send message'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
        <ListingPickerSheet ref={listingSheet} onPick={setListing} />
      </View>
    </BottomSheetModal>
  );
});
