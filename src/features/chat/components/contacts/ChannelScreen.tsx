/**
 * Channel view — a broadcast feed for one contact group. Reads like a WhatsApp
 * thread where every bubble is a blast the agent sent, annotated with its
 * delivery count.
 *
 * The composer is a sheet rather than an inline bar: a broadcast needs a
 * template, an optional parameter and possibly a listing, which is far more
 * than a chat composer's worth of controls.
 */

import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useTheme, useThemeColor } from '@theme';

import { apiErrorMessage } from '../../api/error-message';
import { useChannelBroadcasts, useSendGroupTemplate } from '../../hooks/use-broadcast';
import { useContactGroups } from '../../hooks/use-contact-groups';
import type { BroadcastTemplateInput, ChannelBroadcast } from '../../models/contact';
import { COMPOSER_BG_DARK, COMPOSER_BG_LIGHT } from '../composer-colors';
import { alertBroadcastResult } from './broadcast-result';
import { BroadcastForm } from './BroadcastForm';

interface Props {
  groupId: string;
}

export function ChannelScreen({ groupId }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const headerBg = colorScheme === 'dark' ? COMPOSER_BG_DARK : COMPOSER_BG_LIGHT;
  const foreground = useThemeColor('--foreground');
  const primaryForeground = useThemeColor('--primary-foreground');
  const background = useThemeColor('--background');
  const mutedFg = useThemeColor('--muted-foreground');

  const composerRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const { data: groups } = useContactGroups();
  const group = useMemo(() => (groups ?? []).find((g) => g.id === groupId), [groups, groupId]);
  const { data: broadcasts, isLoading } = useChannelBroadcasts(groupId);
  const sendMutation = useSendGroupTemplate(groupId);

  const memberCount = group?.contactCount ?? 0;

  const onSend = useCallback(
    (input: BroadcastTemplateInput) => {
      sendMutation.mutate(input, {
        onSuccess: (result) => {
          composerRef.current?.close();
          alertBroadcastResult(result);
        },
        onError: (error) => Alert.alert('Broadcast failed', apiErrorMessage(error)),
      });
    },
    [sendMutation],
  );

  // Newest broadcast at the bottom, like a chat thread.
  const feed = useMemo(
    () =>
      [...(broadcasts ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [broadcasts],
  );

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center border-b border-border px-3 pb-3"
        style={{ paddingTop: insets.top + 8, backgroundColor: headerBg }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat/contacts'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70"
        >
          <Icon name="ArrowLeft" size={22} color={foreground} />
        </Pressable>

        <View className="ml-1 h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Icon name="Megaphone" size={20} color={primaryForeground} />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {group?.name ?? 'Channel'}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <ChannelFeed feed={feed} isLoading={isLoading} bottomInset={insets.bottom} />

      <View
        className="border-t border-border px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12, backgroundColor: headerBg }}
      >
        <Pressable
          onPress={() => composerRef.current?.expand()}
          disabled={memberCount === 0}
          accessibilityRole="button"
          accessibilityLabel="New broadcast"
          accessibilityState={{ disabled: memberCount === 0 }}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
          style={{ opacity: memberCount === 0 ? 0.5 : 1 }}
        >
          <Icon name="Send" size={18} color={primaryForeground} />
          <Text className="font-semibold text-primary-foreground">
            {memberCount === 0 ? 'Add members to broadcast' : 'New broadcast'}
          </Text>
        </Pressable>
      </View>

      <BottomSheet
        ref={composerRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: background }}
        handleIndicatorStyle={{ backgroundColor: mutedFg }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="subheading" className="mb-4">
            Broadcast to {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
          <BroadcastForm
            compact
            recipientCount={memberCount}
            isSending={sendMutation.isPending}
            onSend={onSend}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

interface FeedProps {
  feed: ChannelBroadcast[];
  isLoading: boolean;
  bottomInset: number;
}

function ChannelFeed({ feed, isLoading, bottomInset }: Readonly<FeedProps>) {
  const primary = useThemeColor('--primary');

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  if (feed.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState
          icon="Megaphone"
          title="No broadcasts yet"
          description="Send a template to everyone in this channel and it will appear here."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={(b) => b.id}
      renderItem={renderBroadcast}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 + bottomInset, gap: 8 }}
    />
  );
}

function renderBroadcast({ item }: { item: ChannelBroadcast }) {
  return <BroadcastBubble broadcast={item} />;
}

/** Outbound-styled bubble, right-aligned like the agent's own chat messages. */
function BroadcastBubble({ broadcast }: Readonly<{ broadcast: ChannelBroadcast }>) {
  const border = useThemeColor('--border');
  const time = new Date(broadcast.createdAt).toLocaleString('en-AE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-primary p-3">
      {broadcast.headerImageUrl !== null && broadcast.headerImageUrl !== '' ? (
        <Image
          source={{ uri: broadcast.headerImageUrl }}
          accessibilityIgnoresInvertColors
          accessibilityLabel="Attached listing photo"
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 12,
            marginBottom: 8,
            backgroundColor: border,
          }}
        />
      ) : null}

      <Text className="text-xs font-semibold text-primary-foreground opacity-80">
        {broadcast.templateName}
      </Text>
      {broadcast.content !== null && broadcast.content !== '' ? (
        <Text className="mt-1 text-sm text-primary-foreground">{broadcast.content}</Text>
      ) : null}

      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text className="text-[11px] text-primary-foreground opacity-70">{time}</Text>
        <Text className="text-[11px] font-medium text-primary-foreground opacity-90">
          {broadcast.sent}/{broadcast.total} sent
        </Text>
      </View>
    </View>
  );
}
