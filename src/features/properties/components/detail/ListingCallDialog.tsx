import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { useMutation } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import { showToast } from '@/lib/toast/toast.store';
import {
  LISTING_CALLBACK_MAX_DAYS_AHEAD,
  LISTING_CALLBACK_TIME_SLOTS,
  listingCallbackTimeLabel,
  PROPERTY_CALL_DISPLAY,
  PROPERTY_CALL_TEL,
} from '../../constants';
import { useListingCallbackForm } from '../../forms/listing-callback.form';
import type { ListingCallbackFormValues } from '../../forms/listing-callback.schema';
import { createListingCallbackLead } from '../../services';
import type { ListingCallContext, ListingCallbackLeadPayload, PropertyAgent } from '../../types';

/** Which panel the dialog is showing. */
type Step = 'contact' | 'callback' | 'scheduled';

const PORTAL_HOST = 'listing-call-dialog';
const ENTRY_POINT_ID = 'listing.detail.call';
const CTA = 'Request Call back';
const COMPANY_NAME = 'RHK Properties';

const TIME_OPTIONS = LISTING_CALLBACK_TIME_SLOTS.map((slot) => ({
  value: slot.value,
  label: slot.label,
}));

interface Props {
  visible: boolean;
  onClose: () => void;
  agent?: PropertyAgent;
  context: ListingCallContext;
}

/** Listing/project attribution — mirrors web `buildAttribution`. */
function buildAttribution(context: ListingCallContext): Partial<ListingCallbackLeadPayload> {
  return {
    ...(context.projectId ? { projectIds: [context.projectId] } : {}),
    ...(context.projectSlug ? { projectSlug: context.projectSlug } : {}),
    ...(context.listingSlug ? { listingSlug: context.listingSlug } : {}),
    ...(context.listingId ? { listingIds: [context.listingId] } : {}),
    ...(context.opportunityListingSlug
      ? { opportunityListingSlug: context.opportunityListingSlug }
      : {}),
    ...(context.opportunityListingId
      ? { opportunityListingIds: [context.opportunityListingId] }
      : {}),
  };
}

/** Only build `callPreference` when the caller actually picked a slot. */
function buildCallPreference(
  values: ListingCallbackFormValues,
): { date: string; time: string; timezone: string } | undefined {
  const date = values.preferredDate ?? '';
  const time = values.preferredTime ?? '';
  if (date === '' && time === '') return undefined;
  return { date, time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

function DialogHeader({ title, onClose }: Readonly<{ title: string; onClose: () => void }>) {
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-foreground">{title}</Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
        <Icon name="X" size={20} />
      </Pressable>
    </View>
  );
}

/**
 * The public listing "Call" popup — the mobile port of web's `ListingCallModal`. Three steps in one
 * dialog: contact (agent + company number + the reference to quote) → callback form → scheduled
 * confirmation. The lead it creates carries the listing attribution so it links back to the record.
 */
export function ListingCallDialog({ visible, onClose, agent, context }: Readonly<Props>) {
  const [step, setStep] = useState<Step>('contact');
  const [scheduled, setScheduled] = useState<{ date: string; time: string } | null>(null);

  const maxDate = useMemo(() => {
    const max = new Date();
    max.setDate(max.getDate() + LISTING_CALLBACK_MAX_DAYS_AHEAD);
    return max;
  }, []);

  const submit = useMutation({ mutationFn: createListingCallbackLead });

  const handleSubmit = async (values: ListingCallbackFormValues) => {
    const callPreference = buildCallPreference(values);
    try {
      await submit.mutateAsync({
        leadType: 'request_a_call_back',
        name: values.name.trim(),
        phone: values.phone.trim(),
        channel: 'public_website',
        channelMeta: { page: context.pageUrl, cta: CTA, entryPointId: ENTRY_POINT_ID },
        ...buildAttribution(context),
        ...(callPreference ? { callPreference } : {}),
      });
    } catch {
      showToast('error', 'Could not submit your request. Please try again.');
      return;
    }
    // Only show the confirmation card when there's a slot to echo; a bare callback request
    // closes out with a toast instead — same as web.
    if (callPreference) {
      setScheduled({ date: callPreference.date, time: callPreference.time });
      setStep('scheduled');
      return;
    }
    showToast('success', "Request submitted. We'll get back to you soon!");
    close();
  };

  const form = useListingCallbackForm({ onSubmit: handleSubmit });

  const close = useCallback(() => {
    if (submit.isPending) return;
    onClose();
    // Reset after the dialog is gone so the reset isn't visible mid-dismiss.
    setStep('contact');
    setScheduled(null);
    form.reset();
  }, [form, onClose, submit.isPending]);

  const title = step === 'contact' ? 'Contact Us' : 'Request Call back';
  const callerName = agent?.name?.trim() || COMPANY_NAME;

  return (
    // Scrollable so the callback step (4 fields + actions) survives a small screen with the
    // keyboard up — the atom's scrollable branch is keyboard-aware.
    <Dialog
      visible={visible}
      onRequestClose={close}
      dismissOnBackdropPress={!submit.isPending}
      scrollable
    >
      <GestureHandlerRootView>
        <BottomSheetModalProvider>
          <DialogHeader title={title} onClose={close} />

          {step === 'contact' ? (
            <View className="gap-4">
              {agent?.name ? (
                <View className="flex-row items-center gap-3">
                  <Avatar alt={agent.name} className="h-14 w-14 bg-muted">
                    {agent.avatarUrl ? <AvatarImage source={{ uri: agent.avatarUrl }} /> : null}
                    <AvatarFallback className="bg-muted">
                      <Text className="text-base font-bold text-foreground">
                        {initials(agent.name)}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {agent.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {agent.role?.trim() || 'Listing Agent'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View className="gap-2">
                <Button
                  variant="outline"
                  onPress={() => {
                    Linking.openURL(`tel:${PROPERTY_CALL_TEL}`).catch(() => undefined);
                  }}
                >
                  <Icon name="Phone" size={16} />
                  <Text>Call Now {PROPERTY_CALL_DISPLAY}</Text>
                </Button>
                <Button
                  onPress={() => {
                    setStep('callback');
                  }}
                >
                  <Text>Request Call back</Text>
                </Button>
              </View>

              {context.reference?.trim() ? (
                <View className="items-center rounded-xl bg-muted px-4 py-3">
                  <Text className="text-center text-sm text-muted-foreground">
                    Please quote reference number when calling us
                  </Text>
                  <Text className="mt-1 text-base font-medium text-foreground">
                    {context.reference.trim()}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 'callback' ? (
            <View className="gap-4">
              <form.AppField name="name">
                {(field) => <field.Input label="Name" required placeholder="Your Name" />}
              </form.AppField>
              <form.AppField name="phone">
                {(field) => (
                  <field.PhoneInput label="Phone Number" required placeholder="(000) 000-000" />
                )}
              </form.AppField>
              <form.AppField name="preferredDate">
                {(field) => (
                  <field.DatePicker
                    label="Preferred Date"
                    placeholder="Select preferred date"
                    minimumDate={new Date()}
                    maximumDate={maxDate}
                  />
                )}
              </form.AppField>
              <form.AppField name="preferredTime">
                {(field) => (
                  <field.Select
                    label="Preferred Time"
                    placeholder="Select preferred Time"
                    options={TIME_OPTIONS}
                    portalHost={PORTAL_HOST}
                  />
                )}
              </form.AppField>

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={submit.isPending}
                  onPress={() => {
                    setStep('contact');
                  }}
                >
                  <Text>Back</Text>
                </Button>
                <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      className="flex-1"
                      disabled={!canSubmit || submit.isPending}
                      loading={isSubmitting || submit.isPending}
                      onPress={() => {
                        form.handleSubmit().catch(() => {});
                      }}
                    >
                      <Text>Submit Request</Text>
                    </Button>
                  )}
                </form.Subscribe>
              </View>
            </View>
          ) : null}

          {step === 'scheduled' && scheduled ? (
            <View className="items-center gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success">
                <Icon name="Check" size={20} color="#fff" />
              </View>
              <View className="items-center">
                <Text className="text-base font-medium text-foreground">Callback Scheduled!</Text>
                <Text className="mt-1 text-center text-sm text-muted-foreground">
                  {callerName} will contact you on scheduled time.
                </Text>
              </View>
              <View className="w-full flex-row justify-between gap-4 rounded-xl bg-muted px-4 py-3">
                {scheduled.date ? (
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="Calendar" size={20} />
                    <View className="min-w-0">
                      <Text className="text-[11px] text-muted-foreground">Date</Text>
                      <Text className="text-sm font-medium text-foreground">{scheduled.date}</Text>
                    </View>
                  </View>
                ) : null}
                {scheduled.time ? (
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="Clock" size={20} />
                    <View className="min-w-0">
                      <Text className="text-[11px] text-muted-foreground">Time</Text>
                      <Text className="text-sm font-medium text-foreground">
                        {listingCallbackTimeLabel(scheduled.time)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <Button className="w-full" onPress={close}>
                <Text>Done</Text>
              </Button>
            </View>
          ) : null}

          <PortalHost name={PORTAL_HOST} />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Dialog>
  );
}
