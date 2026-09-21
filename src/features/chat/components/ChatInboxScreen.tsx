import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { CHAT_WHATSAPP_CONTACTS, useCan } from '@/lib/rbac';
import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';

import { useChatInbox, type InboxTab } from '../hooks/use-chat-inbox';
import { useContactsAvailable } from '../hooks/use-agent-contacts';
import { useContactNames } from '../hooks/use-contact-names';
import type { ChatContact } from '../models/conversation';
import { ContactRow } from './ContactRow';
import { InboxFabStack } from './InboxFabStack';
import { InboxTabBar } from './InboxTabBar';
import { NewChatChooserSheet, type NewChatChooserSheetHandle } from './NewChatChooserSheet';
import { NewChatSheet, type NewChatSheetHandle } from './NewChatSheet';

export function ChatInboxScreen({ initialTab = 'all' }: Readonly<{ initialTab?: InboxTab }>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');
  const mutedFg = useThemeColor('--muted-foreground');
  // Starting a chat by number only needs the WhatsApp read/write gate — it is
  // NOT dedicated-number only. The phonebook is, so it decides whether the FAB
  // opens the three-option chooser or goes straight to the number sheet.
  const canStartChat = useCan(CHAT_WHATSAPP_CONTACTS);
  const contactsAvailable = useContactsAvailable();

  const chooserSheet = useRef<NewChatChooserSheetHandle>(null);
  const newChatSheet = useRef<NewChatSheetHandle>(null);

  const onNewChat = useCallback(() => {
    if (contactsAvailable) chooserSheet.current?.open();
    else newChatSheet.current?.open();
  }, [contactsAvailable]);

  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const inboxQuery = useChatInbox(tab);
  const { data, isLoading, isError, refetch, isRefetching } = inboxQuery;
  useRefetchOnTabFocus([inboxQuery]);

  const { resolve } = useContactNames();

  const openConversation = useCallback((id: string) => {
    router.push(`/chat/${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatContact }) => <ContactRow contact={item} onPress={openConversation} />,
    [openConversation],
  );

  // Client-side filter, matching the web inbox. Matches the *resolved* name so
  // searching a saved contact name works even when WhatsApp only knows a number.
  const contacts = useMemo(() => {
    const rows = data ?? [];
    const needle = debouncedSearch.trim().toLowerCase();
    if (needle === '') return rows;
    return rows.filter((c) => {
      const name = resolve(c.phone, c.name).toLowerCase();
      return (
        name.includes(needle) ||
        (c.phone ?? '').toLowerCase().includes(needle) ||
        c.lastMessage.toLowerCase().includes(needle)
      );
    });
  }, [data, debouncedSearch, resolve]);

  const isSearching = debouncedSearch.trim() !== '';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 pb-2 pt-4">
        <Text variant="heading" className="flex-1">
          Messages
        </Text>
        {contactsAvailable ? (
          <Pressable
            onPress={() => router.push('/chat/contacts')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Contacts and broadcasts"
            className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
          >
            <Icon name="Users" size={22} color={mutedFg} />
          </Pressable>
        ) : null}
      </View>

      <View className="px-4 pb-1">
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
          <Icon name="Search" size={16} color={mutedFg} />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations"
            className="h-11 flex-1 border-0 bg-transparent px-0 text-sm"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="X" size={14} color={mutedFg} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <InboxTabBar active={tab} onChange={setTab} />

      <InboxBody
        contacts={contacts}
        isLoading={isLoading}
        isError={isError}
        isRefetching={isRefetching}
        isSearching={isSearching}
        bottomInset={insets.bottom}
        primary={primary}
        onRefetch={refetch}
        renderItem={renderItem}
      />

      <InboxFabStack showNewChat={canStartChat} onNewChat={onNewChat} />

      <NewChatChooserSheet
        ref={chooserSheet}
        onSendMessage={() => newChatSheet.current?.open()}
        onMessageMultiple={() => router.push('/chat/contacts')}
        onBroadcast={() => router.push('/chat/contacts')}
      />
      <NewChatSheet ref={newChatSheet} />
    </View>
  );
}

interface BodyProps {
  contacts: ChatContact[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isSearching: boolean;
  bottomInset: number;
  primary: string;
  onRefetch: () => void;
  renderItem: (info: { item: ChatContact }) => React.ReactElement;
}

/** List body with its own loading / error / empty branches. */
function InboxBody({
  contacts,
  isLoading,
  isError,
  isRefetching,
  isSearching,
  bottomInset,
  primary,
  onRefetch,
  renderItem,
}: Readonly<BodyProps>) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState
          icon="MessageSquareDashed"
          title="Couldn't load conversations"
          description="Check your connection and try again."
        />
        <Pressable
          onPress={onRefetch}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-primary px-5 py-2 active:opacity-80"
        >
          <Text className="font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (contacts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState
          icon="MessageSquareDashed"
          title={isSearching ? 'No matches' : 'No conversations yet'}
          description={
            isSearching
              ? 'Try a different name, number or message text.'
              : 'Conversations will appear here.'
          }
        />
      </View>
    );
  }

  return (
    <FlatList
      data={contacts}
      keyExtractor={(c) => c.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={RowSeparator}
      contentContainerStyle={{ paddingBottom: 120 + bottomInset }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefetch}
          tintColor={primary}
          colors={[primary]}
        />
      }
    />
  );
}

/** Inset divider aligned past the avatar. */
function RowSeparator() {
  return <View className="ml-[68px] h-px bg-border" />;
}
