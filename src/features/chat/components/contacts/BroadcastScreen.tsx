/**
 * Ad-hoc broadcast — send one template to a hand-picked set of contacts with no
 * channel involved. Each recipient gets their own 1-1 thread, so this shows up
 * in the inbox as N separate conversations, not a group.
 *
 * Recipients arrive as a comma-joined id list in the route params (the contacts
 * screen ticks them), so the screen is deep-linkable and survives a back-nav.
 */

import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { apiErrorMessage } from '../../api/error-message';
import { useAgentContacts } from '../../hooks/use-agent-contacts';
import { useSendMultiTemplate } from '../../hooks/use-broadcast';
import type { BroadcastTemplateInput } from '../../models/contact';
import { alertBroadcastResult } from './broadcast-result';
import { BroadcastForm } from './BroadcastForm';
import { ContactAvatar } from './ContactAvatar';

interface Props {
  /** Comma-joined contact ids selected on the contacts screen. */
  contactIds: string;
}

export function BroadcastScreen({ contactIds }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const foreground = useThemeColor('--foreground');
  const { data: contacts } = useAgentContacts();
  const sendMutation = useSendMultiTemplate();

  const ids = useMemo(() => contactIds.split(',').filter((id) => id !== ''), [contactIds]);
  const recipients = useMemo(
    () => (contacts ?? []).filter((c) => ids.includes(c.id)),
    [contacts, ids],
  );

  const onSend = useCallback(
    (input: BroadcastTemplateInput) => {
      sendMutation.mutate(
        { ...input, contactIds: ids },
        {
          onSuccess: (result) =>
            alertBroadcastResult(result, () => {
              if (router.canGoBack()) router.back();
            }),
          onError: (error) => Alert.alert('Broadcast failed', apiErrorMessage(error)),
        },
      );
    },
    [ids, sendMutation],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pb-2 pt-2">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat/contacts'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
        >
          <Icon name="ArrowLeft" size={22} color={foreground} />
        </Pressable>
        <View className="ml-1 flex-1">
          <Text variant="subheading">New broadcast</Text>
          <Text variant="muted" className="text-xs">
            {ids.length} recipient{ids.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {ids.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Users"
            title="No recipients"
            description="Pick contacts on the contacts screen to start a broadcast."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RecipientStrip recipients={recipients} total={ids.length} />
          <View className="px-4">
            <BroadcastForm
              compact
              recipientCount={ids.length}
              isSending={sendMutation.isPending}
              onSend={onSend}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

interface StripProps {
  recipients: { id: string; name: string; phone: string }[];
  total: number;
}

/**
 * Avatar strip so the sender can sanity-check who they are about to message.
 * Falls back to a plain count while the phonebook is still loading.
 */
function RecipientStrip({ recipients, total }: Readonly<StripProps>) {
  if (recipients.length === 0) {
    return (
      <Text variant="muted" className="px-4 pb-2 text-xs">
        Loading recipients…
      </Text>
    );
  }

  const shown = recipients.slice(0, 12);
  const hidden = total - shown.length;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}
    >
      {shown.map((r) => (
        <View key={r.id} className="w-16 items-center gap-1">
          <ContactAvatar name={r.name} seed={r.phone} size={44} />
          <Text className="text-center text-[11px] text-muted-foreground" numberOfLines={1}>
            {r.name}
          </Text>
        </View>
      ))}
      {hidden > 0 ? (
        <View className="w-16 items-center gap-1">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Text className="text-sm font-semibold text-foreground">+{hidden}</Text>
          </View>
          <Text className="text-center text-[11px] text-muted-foreground">more</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
