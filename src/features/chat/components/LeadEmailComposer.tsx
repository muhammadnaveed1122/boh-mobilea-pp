/**
 * LeadEmailComposer — minimal subject+body email form shown when the user
 * chooses Email to start a conversation with a lead that has no thread yet.
 * Sends via `useSendLeadEmail` (no conversation needed; the backend creates
 * the lead's unified conversation). On success the hook invalidates the chat
 * caches, the gate re-resolves, and ConversationScreen mounts.
 */

import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { isAxiosError } from 'axios';

import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';

import { useSendLeadEmail } from '../hooks/use-send-lead-email';

interface LeadEmailComposerProps {
  leadId: string;
  email: string;
  onBack: () => void;
}

function emailErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string' && msg.length > 0) return msg;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Could not send the email.';
}

export function LeadEmailComposer({ leadId, email, onBack }: Readonly<LeadEmailComposerProps>) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const sendMutation = useSendLeadEmail();

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sendMutation.isPending;

  const onSend = useCallback(() => {
    if (!canSend) return;
    sendMutation.mutate(
      { channel: 'unified', leadId, subject: subject.trim(), content: body.trim() },
      {
        onError: (error) => {
          Alert.alert('Send failed', emailErrorMessage(error));
        },
      },
    );
  }, [canSend, leadId, subject, body, sendMutation]);

  if (!email) {
    return (
      <EmptyState
        icon="Mail"
        title="No email address"
        description="This lead has no email address on record."
      />
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4" showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="flex-row items-center gap-1 active:opacity-70"
      >
        <Icon name="ChevronLeft" size={18} />
        <Text className="text-sm font-medium text-foreground">Back</Text>
      </Pressable>

      <View>
        <Text variant="subheading">Email {email}</Text>
        <Text variant="muted">Send an email to start this conversation.</Text>
      </View>

      <View className="gap-1.5">
        <Text variant="label">Subject</Text>
        <Input
          value={subject}
          onChangeText={setSubject}
          placeholder="Subject"
          editable={!sendMutation.isPending}
        />
      </View>

      <View className="gap-1.5">
        <Text variant="label">Message</Text>
        <Textarea
          value={body}
          onChangeText={setBody}
          placeholder="Write your email…"
          className="min-h-40"
          editable={!sendMutation.isPending}
        />
      </View>

      <Button onPress={onSend} disabled={!canSend} loading={sendMutation.isPending}>
        <Text>Send email</Text>
      </Button>
    </ScrollView>
  );
}
