import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useConversationMedia } from '../../hooks/use-conversation-media';
import { useMediaUrl } from '../../hooks/use-media-url';
import type { Message } from '../../models/message';
import { SharedMediaViewer } from './SharedMediaViewer';

const INITIAL_LIMIT = 12;

function Thumb({
  message,
  onOpen,
}: Readonly<{ message: Message; onOpen: (url: string, isVideo: boolean) => void }>) {
  const isVideo = message.media?.kind === 'video';
  const known = message.media?.url;
  const { data } = useMediaUrl(message.id, !known);
  const url = known ?? data;
  if (!url) {
    return <View className="aspect-square flex-1 rounded-lg bg-muted-foreground/15" />;
  }
  return (
    <Pressable
      onPress={() => onOpen(url, isVideo)}
      className="aspect-square flex-1 overflow-hidden rounded-lg bg-muted-foreground/15"
      accessibilityLabel={isVideo ? 'Play video' : 'View image'}
    >
      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {isVideo ? (
        <View className="absolute inset-0 items-center justify-center">
          <Icon name="CirclePlay" size={32} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

function DocRow({ message }: Readonly<{ message: Message }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-muted-foreground/15 px-2.5 py-2">
      <Icon name="FileText" size={16} color={mutedFg} />
      <Text className="flex-1 text-sm" numberOfLines={1}>
        {message.media?.name ?? message.text ?? 'Document'}
      </Text>
    </View>
  );
}

function MediaGridRow({
  row,
  onOpen,
}: Readonly<{ row: Message[]; onOpen: (url: string, isVideo: boolean) => void }>) {
  return (
    <View className="flex-row gap-1.5">
      {row.map((m) => (
        <Thumb key={m.id} message={m} onOpen={onOpen} />
      ))}
      {row.length < 3
        ? Array.from({ length: 3 - row.length }).map((_, k) => (
            <View key={`sp-${k}`} className="flex-1" />
          ))
        : null}
    </View>
  );
}

export function SharedMediaCard({ conversationId }: Readonly<{ conversationId: string }>) {
  const { data: messages = [] } = useConversationMedia(conversationId);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; isVideo: boolean } | null>(null);

  const grid = messages.filter((m) => m.media?.kind === 'image' || m.media?.kind === 'video');
  const docs = messages.filter((m) => m.media?.kind === 'document');
  const total = grid.length + docs.length;
  const visibleGrid = showAll ? grid : grid.slice(0, INITIAL_LIMIT);
  const docsBudget = Math.max(0, INITIAL_LIMIT - visibleGrid.length);
  const visibleDocs = showAll ? docs : docs.slice(0, docsBudget);
  const hasMore = total > visibleGrid.length + visibleDocs.length;

  // Chunk the grid into rows of 3 for a simple 3-col layout.
  const rows: Message[][] = [];
  for (let i = 0; i < visibleGrid.length; i += 3) rows.push(visibleGrid.slice(i, i + 3));

  return (
    <View className="gap-3 px-4 py-3">
      <Text className="text-base font-semibold">Shared media</Text>
      {total === 0 ? (
        <Text className="text-sm text-muted-foreground">No shared media yet.</Text>
      ) : (
        <View className="gap-3">
          {rows.map((row, i) => (
            <MediaGridRow
              key={i}
              row={row}
              onOpen={(url, isVideo) => setViewer({ url, isVideo })}
            />
          ))}
          {visibleDocs.map((m) => (
            <DocRow key={m.id} message={m} />
          ))}
          {hasMore ? (
            <Pressable onPress={() => setShowAll(true)} className="self-start active:opacity-70">
              <Text className="text-sm font-medium text-info">Show all ({total})</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <SharedMediaViewer
        url={viewer?.url ?? null}
        isVideo={viewer?.isVideo ?? false}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}
