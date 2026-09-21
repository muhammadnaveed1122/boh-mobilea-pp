/**
 * TemplatePicker — shown when a lead has no WhatsApp messages yet. Lists
 * approved templates; selecting one sends it to the lead's number. v1 supports
 * templates with 0 or 1 placeholder (the single placeholder is auto-filled with
 * the lead name); templates with more are listed but disabled.
 */

import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { isAxiosError } from 'axios';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { CHAT_WRITE, useCan } from '@/lib/rbac';

import type { ApiWhatsappTemplate } from '../api/types';
import { useSendTemplate } from '../hooks/use-send-template';
import { useWhatsappTemplates } from '../hooks/use-whatsapp-templates';

interface TemplatePickerProps {
  leadId: string;
  leadName: string;
  phone: string;
  /**
   * Set when rendered inside a @gorhom/bottom-sheet. A plain RN ScrollView
   * loses its pan gesture to the sheet's own handler, so the list has to use
   * BottomSheetScrollView to scroll at all.
   */
  inSheet?: boolean;
}

function placeholderCount(t: ApiWhatsappTemplate): number {
  return t.placeholdersCount ?? 0;
}

/** Pull the backend error message out of an axios error so QA sees the real cause. */
function sendErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string' && msg.length > 0) return msg;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Could not send the template.';
}

export function TemplatePicker({
  leadId,
  leadName,
  phone,
  inSheet = false,
}: Readonly<TemplatePickerProps>) {
  const canWrite = useCan(CHAT_WRITE);
  const List = inSheet ? BottomSheetScrollView : ScrollView;
  const { data, isLoading, isError, refetch } = useWhatsappTemplates();
  const sendMutation = useSendTemplate(leadId);

  const templates = useMemo(() => (data ?? []).filter((t) => t.status === 'APPROVED'), [data]);

  const onSelect = useCallback(
    (t: ApiWhatsappTemplate) => {
      if (sendMutation.isPending) return;
      const count = placeholderCount(t);
      if (count > 1) return;
      sendMutation.mutate(
        {
          to: phone,
          leadId,
          templateName: t.name,
          languageCode: t.language,
          parameters: count === 1 ? [leadName] : [],
        },
        {
          onError: (error) => {
            Alert.alert('Send failed', sendErrorMessage(error));
          },
        },
      );
    },
    [leadId, leadName, phone, sendMutation],
  );

  if (!canWrite) {
    return (
      <EmptyState
        icon="Lock"
        title="No send permission"
        description="You don't have permission to start a WhatsApp conversation with this lead."
      />
    );
  }

  if (!phone) {
    return (
      <EmptyState
        icon="Phone"
        title="No phone number"
        description="This lead has no phone number to start a WhatsApp conversation."
      />
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState icon="CircleAlert" title="Couldn't load templates" />
        <Pressable
          onPress={() => {
            refetch().catch(() => {});
          }}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-primary px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon="Inbox"
        title="No approved templates"
        description="Ask an admin to create and approve a WhatsApp template."
      />
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 pb-2 pt-4">
        <Text variant="subheading">Start on WhatsApp</Text>
        <Text variant="muted">Pick a WhatsApp template to open this conversation.</Text>
      </View>
      <List
        contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {templates.map((t) => {
          const count = placeholderCount(t);
          const disabled = count > 1 || sendMutation.isPending;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t.name}
              className="rounded-2xl bg-card p-4 active:opacity-80"
              style={{ opacity: disabled ? 0.5 : 1 }}
            >
              <Text className="text-sm font-semibold text-foreground">{t.name}</Text>
              {t.body ? (
                <Text variant="muted" numberOfLines={3} className="mt-1">
                  {t.body}
                </Text>
              ) : null}
              {count > 1 ? (
                <Text variant="error" className="mt-1 text-xs">
                  Needs more info — not supported yet
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </List>
      {sendMutation.isPending ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}
