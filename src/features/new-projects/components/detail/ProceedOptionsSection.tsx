import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import {
  getIWantToOptionsForPersona,
  INTEREST_OPTIONS,
  I_WANT_TO_OTHER,
  isIWantToValidForPersona,
  LEAD_TYPE_REQUEST_CALLBACK,
  PHONE_NUMBERS,
  PROPERTY_TYPE_OPTIONS,
} from '../../constants/contact-options';
import { useCallbackContactForm } from '../../forms/callback-contact.form';
import { useCreateLead } from '../../hooks/use-create-lead';
import { ENTRY_POINT_PROJECT_DETAIL, LEAD_CHANNEL_MOBILE } from '../../services/leads';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string | undefined;
  projectSlug: string | null | undefined;
  projectName: string;
}

function fieldError(meta: { isTouched: boolean; errors: unknown[] }): string | null {
  if (!meta.isTouched || meta.errors.length === 0) return null;
  const first = meta.errors[0];
  if (typeof first === 'object' && first !== null && 'message' in first) {
    return String(first.message);
  }
  return String(first);
}

interface ChipGroupProps {
  label: string;
  required?: boolean;
  options: readonly { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  error?: string | null;
  /** allow tapping the active chip to clear it (optional fields) */
  clearable?: boolean;
  onSelect: (value: string) => void;
}

function ChipGroup({
  label,
  required,
  options,
  value,
  disabled,
  error,
  clearable,
  onSelect,
}: Readonly<ChipGroupProps>) {
  return (
    <View className={disabled ? 'opacity-50' : undefined}>
      <Text variant="label" className="mb-2">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              onPress={() => onSelect(clearable && active ? '' : o.value)}
              className={`rounded-full px-4 py-2 ${
                active ? 'bg-brand' : 'border border-border bg-card'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  active ? 'text-brand-foreground' : 'text-foreground'
                }`}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="error" className="mt-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function ProceedOptionsSection({
  visible,
  onClose,
  projectId,
  projectSlug,
  projectName,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState('callback');
  const createLead = useCreateLead();

  const form = useCallbackContactForm(async (values) => {
    try {
      await createLead.mutateAsync({
        leadType: LEAD_TYPE_REQUEST_CALLBACK,
        name: values.name,
        email: values.email,
        phone: values.phone,
        interest: values.interest,
        propertyType: values.propertyType || undefined,
        interestType: values.iWantTo ? [values.iWantTo] : undefined,
        additionalNotes: values.interestReason || undefined,
        projectIds: projectId ? [projectId] : undefined,
        projectSlug: projectSlug ?? undefined,
        channel: LEAD_CHANNEL_MOBILE,
        channelMeta: {
          entryPointId: ENTRY_POINT_PROJECT_DETAIL,
          platform: 'mobile',
          cta: 'Request a call back',
          projectSlug: projectSlug ?? undefined,
        },
      });
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not submit. Please try again.';
      Alert.alert('Submission failed', msg);
    }
  });

  function handleClose() {
    setSubmitted(false);
    setTab('callback');
    form.reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="rounded-t-3xl bg-background"
          style={{ maxHeight: '92%', paddingBottom: insets.bottom }}
        >
          <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <Text className="text-lg font-bold text-foreground">
              {submitted ? 'All set' : 'Contact'}
            </Text>
            <Pressable
              onPress={handleClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-muted"
              accessibilityLabel="Close"
            >
              <Icon name="X" size={18} />
            </Pressable>
          </View>

          {submitted ? (
            <View className="px-5 py-8">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-brand">
                  <Icon name="Check" size={28} color="#fff" />
                </View>
                <Text className="text-center text-lg font-bold text-foreground">Thanks!</Text>
                <Text className="mt-1 text-center text-sm text-muted-foreground">
                  Our team will reach out about {projectName} shortly.
                </Text>
              </View>
              <View className="mt-6">
                <Button onPress={handleClose} size="lg">
                  <Text>Done</Text>
                </Button>
              </View>
            </View>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="shrink">
              <View className="px-5 pt-4">
                <TabsList>
                  <TabsTrigger value="callback">
                    <Text>Request a call back</Text>
                  </TabsTrigger>
                  <TabsTrigger value="call">
                    <Text>Call us now</Text>
                  </TabsTrigger>
                </TabsList>
              </View>

              <TabsContent value="callback" className="shrink">
                <KeyboardAwareScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
                  bottomOffset={24}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text className="mb-1 text-base font-semibold text-foreground">
                    Request a call back
                  </Text>
                  <Text className="mb-4 text-sm text-muted-foreground">
                    Leave your contact details and our team will reach out to you.
                  </Text>

                  <View className="mb-3">
                    <form.AppField name="name">
                      {(field) => (
                        <field.Input label="Full Name" required placeholder="Enter your name" />
                      )}
                    </form.AppField>
                  </View>
                  <View className="mb-3">
                    <form.AppField name="email">
                      {(field) => (
                        <field.Input
                          label="Email"
                          required
                          placeholder="Enter your email"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      )}
                    </form.AppField>
                  </View>
                  <View className="mb-4">
                    <form.AppField name="phone">
                      {(field) => (
                        <field.PhoneInput
                          label="Phone number"
                          required
                          defaultCode="AE"
                          placeholder="50 123 4567"
                        />
                      )}
                    </form.AppField>
                  </View>

                  <View className="mb-4">
                    <form.AppField name="interest">
                      {(field) => (
                        <ChipGroup
                          label="I am a"
                          required
                          options={INTEREST_OPTIONS}
                          value={field.state.value}
                          error={fieldError(field.state.meta)}
                          onSelect={(v) => {
                            field.handleChange(v);
                            const cur = form.getFieldValue('iWantTo');
                            if (cur && !isIWantToValidForPersona(cur, v)) {
                              form.setFieldValue('iWantTo', '');
                            }
                          }}
                        />
                      )}
                    </form.AppField>
                  </View>

                  <form.Subscribe selector={(s) => s.values.interest}>
                    {(interest) => (
                      <>
                        <View className="mb-4">
                          <form.AppField name="propertyType">
                            {(field) => (
                              <ChipGroup
                                label="My property use is"
                                options={PROPERTY_TYPE_OPTIONS}
                                value={field.state.value}
                                disabled={!interest}
                                clearable
                                onSelect={field.handleChange}
                              />
                            )}
                          </form.AppField>
                        </View>

                        <View className="mb-4">
                          <form.AppField name="iWantTo">
                            {(field) => (
                              <ChipGroup
                                label="I want to"
                                required
                                options={getIWantToOptionsForPersona(interest)}
                                value={field.state.value}
                                disabled={!interest}
                                error={fieldError(field.state.meta)}
                                onSelect={field.handleChange}
                              />
                            )}
                          </form.AppField>
                        </View>
                      </>
                    )}
                  </form.Subscribe>

                  <View className="mb-5">
                    <form.Subscribe selector={(s) => s.values.iWantTo === I_WANT_TO_OTHER}>
                      {(isOther) => (
                        <form.AppField name="interestReason">
                          {(field) => (
                            <field.Textarea
                              label={isOther ? 'Message' : 'Message (optional)'}
                              required={isOther}
                              placeholder="Tell us how we can help..."
                              maxLength={500}
                            />
                          )}
                        </form.AppField>
                      )}
                    </form.Subscribe>
                  </View>

                  <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        onPress={form.handleSubmit}
                        disabled={!canSubmit}
                        loading={isSubmitting}
                        size="lg"
                      >
                        <Text>Request a call back</Text>
                      </Button>
                    )}
                  </form.Subscribe>
                </KeyboardAwareScrollView>
              </TabsContent>

              <TabsContent value="call">
                <View className="px-5 pb-8 pt-5">
                  <Text className="mb-1 text-base font-semibold text-foreground">Call us now</Text>
                  <Text className="mb-4 text-sm text-muted-foreground">
                    Our team is available to help with your enquiry.
                  </Text>
                  <View className="gap-3">
                    {PHONE_NUMBERS.map((p) => (
                      <Pressable
                        key={p.display}
                        onPress={() => Linking.openURL(`tel:${p.tel}`).catch(() => undefined)}
                        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4"
                      >
                        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand">
                          <Icon name="Phone" size={18} color="#fff" />
                        </View>
                        <Text className="text-base font-semibold text-foreground">{p.display}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </TabsContent>
            </Tabs>
          )}
        </View>
      </View>
    </Modal>
  );
}
