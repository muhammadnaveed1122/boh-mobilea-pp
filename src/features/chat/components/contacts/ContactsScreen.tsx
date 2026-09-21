/**
 * Agent phonebook. Mobile counterpart of the web client's contacts panel —
 * the web three-panel layout collapses here into one screen: a horizontal
 * channel strip on top, the contact list below, and a selection action bar
 * that rises when contacts are ticked.
 *
 * Dedicated-number only; the backend 403s shared-number agents and the entry
 * points hide accordingly (`useContactsAvailable`).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { isDedicatedNumberDenied } from '../../api/contacts';
import { apiErrorMessage } from '../../api/error-message';
import { useAgentContacts, useDeleteContact } from '../../hooks/use-agent-contacts';
import { useContactGroups, useDeleteContactGroup } from '../../hooks/use-contact-groups';
import type { AgentContact } from '../../models/contact';
import { AddContactSheet, type AddContactSheetHandle } from './AddContactSheet';
import { ContactAvatar } from './ContactAvatar';
import { CreateGroupSheet, type CreateGroupSheetHandle } from './CreateGroupSheet';
import { ImportContactsSheet, type ImportContactsSheetHandle } from './ImportContactsSheet';

export function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const foreground = useThemeColor('--foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const destructive = useThemeColor('--destructive');
  const primaryForeground = useThemeColor('--primary-foreground');

  const addSheet = useRef<AddContactSheetHandle>(null);
  const groupSheet = useRef<CreateGroupSheetHandle>(null);
  const importSheet = useRef<ImportContactsSheetHandle>(null);

  const contactsQuery = useAgentContacts();
  const { data: contacts, isLoading, isError, error, refetch, isRefetching } = contactsQuery;
  const { data: groups } = useContactGroups();
  const deleteContact = useDeleteContact();
  const deleteGroup = useDeleteContactGroup();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = contacts ?? [];
    if (needle === '') return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(needle) || c.phone.includes(needle));
  }, [contacts, search]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const confirmDelete = useCallback(
    (contact: AgentContact) => {
      Alert.alert('Delete contact', `Remove ${contact.name} from your contacts?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteContact.mutate(contact.id, {
              onError: (err) => Alert.alert('Delete failed', apiErrorMessage(err)),
            }),
        },
      ]);
    },
    [deleteContact],
  );

  const confirmDeleteGroup = useCallback(
    (groupId: string, name: string) => {
      Alert.alert('Delete channel', `Delete "${name}"? Contacts themselves are kept.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteGroup.mutate(groupId, {
              onError: (err) => Alert.alert('Delete failed', apiErrorMessage(err)),
            }),
        },
      ]);
    },
    [deleteGroup],
  );

  const startBroadcast = useCallback(() => {
    router.push({
      pathname: '/chat/broadcast',
      params: { contactIds: Array.from(selected).join(',') },
    });
  }, [selected]);

  const renderItem = useCallback(
    ({ item }: { item: AgentContact }) => (
      <ContactListRow
        contact={item}
        selected={selected.has(item.id)}
        onToggle={toggle}
        onLongPress={confirmDelete}
      />
    ),
    [confirmDelete, selected, toggle],
  );

  // A 403 here is the dedicated-number gate, not a fault — explain rather than
  // offering a retry that can never succeed.
  if (isDedicatedNumberDenied(error)) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
        <ScreenHeader title="Contacts" />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Lock"
            title="Contacts need your own number"
            description="Saved contacts and broadcasts are available to agents with a dedicated WhatsApp number."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScreenHeader
        title="Contacts"
        action={{
          icon: 'Upload',
          label: 'Import contacts',
          onPress: () => importSheet.current?.open(),
        }}
      />

      <View className="px-4 pb-2">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts"
          placeholderTextColor={mutedFg}
          autoCorrect={false}
        />
      </View>

      <ChannelStrip
        groups={groups ?? []}
        onOpen={(id) => router.push(`/chat/channels/${id}`)}
        onCreate={() => groupSheet.current?.open()}
        onDelete={confirmDeleteGroup}
      />

      <ContactsList
        contacts={filtered}
        isLoading={isLoading}
        isError={isError}
        isRefetching={isRefetching}
        isSearching={search.trim() !== ''}
        bottomInset={insets.bottom}
        onRefetch={refetch}
        renderItem={renderItem}
      />

      {selected.size > 0 ? (
        <View
          className="flex-row items-center gap-3 border-t border-border bg-card"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <Pressable
            onPress={clearSelection}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
          >
            <Icon name="X" size={20} color={foreground} />
          </Pressable>
          <Pressable
            onPress={startBroadcast}
            accessibilityRole="button"
            accessibilityLabel={`Message ${selected.size} contacts`}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
          >
            <Icon name="Send" size={18} color={primaryForeground} />
            <Text className="font-semibold text-primary-foreground">
              Message {selected.size} contact{selected.size === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => addSheet.current?.open()}
          accessibilityRole="button"
          accessibilityLabel="Add contact"
          // Colour + press feedback via classes (useThemeColor returns
          // `rgb(R G B)`, which RN's parser rejects for backgroundColor);
          // computed offset via an object-form style (a function-form style
          // would discard the class-derived layout).
          className="h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-80"
          style={{
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 24,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Icon name="UserPlus" size={24} color={primaryForeground} />
        </Pressable>
      )}

      <AddContactSheet ref={addSheet} />
      <CreateGroupSheet ref={groupSheet} onCreated={(id) => router.push(`/chat/channels/${id}`)} />
      <ImportContactsSheet
        ref={importSheet}
        onImported={(count) =>
          Alert.alert('Import complete', `${count} contact${count === 1 ? '' : 's'} added.`)
        }
      />
      {deleteContact.isPending || deleteGroup.isPending ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator color={destructive} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

interface ListProps {
  contacts: AgentContact[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  /** Drives the empty-state copy: "no contacts yet" vs "no matches". */
  isSearching: boolean;
  bottomInset: number;
  onRefetch: () => void;
  renderItem: (info: { item: AgentContact }) => React.ReactElement;
}

/**
 * List body with its own loading / error / empty branches. Split out of
 * `ContactsScreen` so neither component carries the combined branching.
 */
function ContactsList({
  contacts,
  isLoading,
  isError,
  isRefetching,
  isSearching,
  bottomInset,
  onRefetch,
  renderItem,
}: Readonly<ListProps>) {
  const primary = useThemeColor('--primary');

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
          icon="CircleAlert"
          title="Couldn't load contacts"
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
          icon="Users"
          title={isSearching ? 'No matches' : 'No contacts yet'}
          description={
            isSearching
              ? 'Try a different name or number.'
              : 'Save a customer to reach them again without typing their number.'
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
      ItemSeparatorComponent={ContactSeparator}
      contentContainerStyle={{ paddingBottom: 160 + bottomInset }}
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

/** Inset divider aligned past the avatar, matching the inbox rows. */
function ContactSeparator() {
  return <View className="ml-[68px] h-px bg-border" />;
}

function ScreenHeader({
  title,
  action,
}: Readonly<{
  title: string;
  action?: { icon: 'Upload'; label: string; onPress: () => void };
}>) {
  const fg = useThemeColor('--foreground');
  return (
    <View className="flex-row items-center px-3 pb-2 pt-2">
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
      >
        <Icon name="ArrowLeft" size={22} color={fg} />
      </Pressable>
      <Text variant="heading" className="ml-1 flex-1">
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
        >
          <Icon name={action.icon} size={22} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface StripProps {
  groups: { id: string; name: string; contactCount: number }[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string, name: string) => void;
}

/** Horizontal channel chips. Long-press deletes, matching the contact rows. */
function ChannelStrip({ groups, onOpen, onCreate, onDelete }: Readonly<StripProps>) {
  const primary = useThemeColor('--primary');
  const mutedFg = useThemeColor('--muted-foreground');

  return (
    <FlatList
      horizontal
      data={groups}
      keyExtractor={(g) => g.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
      ListHeaderComponent={
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="New channel"
          className="mr-2 h-10 flex-row items-center gap-1.5 rounded-full border border-dashed border-border px-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="Plus" size={16} color={primary} />
          <Text className="text-sm font-medium text-foreground">Channel</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen(item.id)}
          onLongPress={() => onDelete(item.id, item.name)}
          accessibilityRole="button"
          accessibilityLabel={`Open channel ${item.name}, ${item.contactCount} members`}
          accessibilityHint="Long press to delete this channel"
          className="h-10 flex-row items-center gap-2 rounded-full bg-muted px-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="Megaphone" size={15} color={primary} />
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-muted-foreground">{item.contactCount}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text className="py-2 text-xs text-muted-foreground" style={{ color: mutedFg }}>
          No channels yet
        </Text>
      }
    />
  );
}

interface RowProps {
  contact: AgentContact;
  selected: boolean;
  onToggle: (id: string) => void;
  onLongPress: (contact: AgentContact) => void;
}

function ContactListRow({ contact, selected, onToggle, onLongPress }: Readonly<RowProps>) {
  const primaryForeground = useThemeColor('--primary-foreground');

  return (
    <Pressable
      onPress={() => onToggle(contact.id)}
      onLongPress={() => onLongPress(contact)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${contact.name}, ${contact.phone}`}
      accessibilityHint="Long press to delete"
      className="flex-row items-center px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 64 })}
    >
      <ContactAvatar name={contact.name} seed={contact.phone} size={44} />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-foreground" numberOfLines={1}>
          {contact.name}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {contact.phone}
          {contact.group ? ` · ${contact.group.name}` : ''}
        </Text>
      </View>
      <View
        className={
          selected
            ? 'h-6 w-6 items-center justify-center rounded-full bg-primary'
            : 'h-6 w-6 items-center justify-center rounded-full border border-border'
        }
      >
        {selected ? <Icon name="Check" size={14} color={primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}
