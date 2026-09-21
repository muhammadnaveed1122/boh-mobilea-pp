import { Image, Modal, Pressable } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { Icon } from '@/components/atoms/Icon';

export function SharedMediaViewer({
  url,
  isVideo,
  onClose,
}: Readonly<{ url: string | null; isVideo: boolean; onClose: () => void }>) {
  const player = useVideoPlayer(isVideo && url ? url : '', (p) => {
    if (isVideo && url) p.play();
  });
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          isVideo ? (
            <VideoView
              player={player}
              style={{ width: '90%', height: '70%' }}
              contentFit="contain"
              nativeControls
            />
          ) : (
            <Image
              source={{ uri: url }}
              style={{ width: '90%', height: '70%' }}
              resizeMode="contain"
            />
          )
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: 48,
            right: 20,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 20,
            padding: 8,
          }}
        >
          <Icon name="X" size={22} color="#FFFFFF" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
