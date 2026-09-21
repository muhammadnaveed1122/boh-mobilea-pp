import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';
import { useContactCtaForm } from '../../forms/contact-cta.form';
import { useDownloadBrochure } from '../../hooks/use-create-lead';
import { ENTRY_POINT_BROCHURE, LEAD_CHANNEL_MOBILE } from '../../services/leads';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string | undefined;
  projectSlug: string | null | undefined;
  projectName: string;
  brochureUrl?: string | null;
}

export function BrochureDownloadModal({
  visible,
  onClose,
  projectId,
  projectSlug,
  projectName,
  brochureUrl,
}: Readonly<Props>) {
  const download = useDownloadBrochure();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) setSubmitted(false);
  }, [visible]);

  const form = useContactCtaForm(async (values) => {
    try {
      const resp = await download.mutateAsync({
        leadType: 'brochure_download',
        name: values.name,
        email: values.email,
        phone: values.phone,
        projectIds: projectId ? [projectId] : undefined,
        projectSlug: projectSlug ?? undefined,
        channel: LEAD_CHANNEL_MOBILE,
        channelMeta: {
          entryPointId: ENTRY_POINT_BROCHURE,
          platform: 'mobile',
          projectSlug: projectSlug ?? undefined,
        },
      });
      const fileUrl = resp.fileUrl || brochureUrl;
      if (fileUrl) Linking.openURL(fileUrl).catch(() => undefined);
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not request brochure.';
      Alert.alert('Request failed', msg);
    }
  });

  return (
    <Dialog
      visible={visible}
      onRequestClose={onClose}
      title={submitted ? 'Brochure sent' : `Download Brochure — ${projectName}`}
      description={submitted ? undefined : 'Enter your details to receive the brochure.'}
    >
      {submitted ? (
        <View>
          <Text className="mb-4 text-sm text-muted-foreground">
            Check your email for the brochure link.
          </Text>
          <Button onPress={onClose}>
            <Text>Done</Text>
          </Button>
        </View>
      ) : (
        <View>
          <View className="mb-3">
            <form.AppField name="name">
              {(field) => <field.Input label="Name" required placeholder="Your name" />}
            </form.AppField>
          </View>
          <View className="mb-3">
            <form.AppField name="email">
              {(field) => (
                <field.Input
                  label="Email"
                  required
                  placeholder="you@example.com"
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
                  label="Phone"
                  required
                  defaultCode="AE"
                  placeholder="50 123 4567"
                />
              )}
            </form.AppField>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button variant="outline" onPress={onClose}>
                <Text>Cancel</Text>
              </Button>
            </View>
            <View className="flex-1">
              <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button onPress={form.handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
                    <Text>Send</Text>
                  </Button>
                )}
              </form.Subscribe>
            </View>
          </View>
        </View>
      )}
    </Dialog>
  );
}
