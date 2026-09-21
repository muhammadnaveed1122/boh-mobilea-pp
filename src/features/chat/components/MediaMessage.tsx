import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { ImageViewer } from '@/components/organisms/ImageViewer';
import { showErrorToast } from '@/lib/toast/toast.store';
import { useThemeColor } from '@theme';

import { useMediaUrl } from '../hooks/use-media-url';
import { openDocument } from '../media/open-document';
import type { MessageMedia } from '../models/message';
import { AudioMessage } from './AudioMessage';

const MEDIA_W = 220;
const MEDIA_H = 220;

function VideoMedia({ url }: Readonly<{ url: string }>) {
  const player = useVideoPlayer(url);
  return (
    <VideoView player={player} style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 12 }} />
  );
}

/** Chat image thumbnail — tap opens the full-screen zoomable viewer. */
function ImageMedia({ url }: Readonly<{ url: string }>) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open image full screen"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Image
          source={{ uri: url }}
          style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 12 }}
          resizeMode="cover"
        />
      </Pressable>
      <ImageViewer visible={open} uri={url} onClose={hide} />
    </>
  );
}

/** Document chip — tap downloads (if remote) then opens it in a viewer app. */
function DocumentMedia({
  url,
  name,
  mimeType,
  tint,
}: Readonly<{ url: string; name?: string; mimeType?: string; tint: string }>) {
  const [opening, setOpening] = useState(false);
  const open = useCallback(() => {
    if (opening) return;
    setOpening(true);
    openDocument(url, name, mimeType)
      .catch((e: unknown) => {
        showErrorToast(e instanceof Error ? e.message : 'Could not open this document.');
      })
      .finally(() => setOpening(false));
  }, [mimeType, name, opening, url]);
  return (
    <Pressable
      onPress={open}
      disabled={opening}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name ?? 'document'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="flex-row items-center rounded-xl border border-border bg-background/40 p-2.5"
    >
      {opening ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Icon name="File" size={22} color={tint} />
      )}
      <Text className="ml-2 max-w-[180px] text-sm" numberOfLines={1}>
        {name ?? 'Document'}
      </Text>
    </Pressable>
  );
}

export function MediaMessage({ media }: Readonly<{ media: MessageMedia }>) {
  const tint = useThemeColor('--muted-foreground');
  // A local optimistic asset (file://, content://) is used as-is. A remote
  // (https) url is a signed Azure SAS URL that EXPIRES, so always re-resolve a
  // fresh one by messageId and prefer it — the stored url is only a fallback
  // while the fresh one loads.
  const isLocal =
    !!media.url && (media.url.startsWith('file:') || media.url.startsWith('content:'));
  const { data: fetchedUrl } = useMediaUrl(media.messageId, !isLocal);
  // For remote media use ONLY the freshly-signed url — never fall back to the
  // stored (expired-prone) SAS url, or the video player would mount with a dead
  // url and never reload. Show the loader until the fresh url resolves.
  const url = isLocal ? media.url! : (fetchedUrl ?? '');

  if (!url) {
    return (
      <View
        className="items-center justify-center rounded-xl bg-muted"
        style={{
          width: MEDIA_W,
          height: media.kind === 'document' || media.kind === 'audio' ? 56 : MEDIA_H,
        }}
      >
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (media.kind === 'image') {
    return <ImageMedia url={url} />;
  }
  if (media.kind === 'video') {
    return <VideoMedia url={url} />;
  }
  if (media.kind === 'audio') {
    return <AudioMessage url={url} tint={tint} />;
  }
  return <DocumentMedia url={url} name={media.name} mimeType={media.mimeType} tint={tint} />;
}
