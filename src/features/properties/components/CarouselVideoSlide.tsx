import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '@/components/atoms/Icon';

/**
 * Inline video slide — deliberately not a full player.
 *
 * Playback is tap-to-start rather than autoplay: these slides live inside a
 * scrolling feed, where autoplaying every visible video burns battery and
 * stalls scrolling. The card surfaces only what the design calls for — a
 * play/pause toggle and a mute toggle — with `nativeControls` off so the
 * system scrubber/fullscreen chrome never appears.
 */
interface Props {
  url: string;
  width: number;
  height: number;
  /** False when the carousel has moved to another slide; forces a pause. */
  isActive: boolean;
}

const CONTROL_BG = 'rgba(0,0,0,0.55)';

export function CarouselVideoSlide({ url, width, height, isActive }: Readonly<Props>) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = false;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Swiping away must stop playback — otherwise audio keeps running from a
  // slide the user can no longer see.
  useEffect(() => {
    if (!isActive && isPlaying) {
      player.pause();
      setIsPlaying(false);
    }
  }, [isActive, isPlaying, player]);

  const togglePlay = (): void => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }
    player.play();
    setIsPlaying(true);
  };

  const toggleMute = (): void => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  };

  // Dimmed while playing so it stops covering the footage, but stays tappable.
  const playButtonOpacity = isPlaying ? 0.35 : 1;

  return (
    <View style={{ width, height }} className="relative bg-black">
      <VideoView
        player={player}
        style={{ width, height }}
        nativeControls={false}
        contentFit="cover"
        // Inline-only: no fullscreen handoff, no picture-in-picture.
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />

      {/* Centre play/pause. Stays mounted while playing so it doubles as pause. */}
      <Pressable
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
        hitSlop={8}
        style={({ pressed }) => [
          {
            position: 'absolute',
            top: height / 2 - 24,
            left: width / 2 - 24,
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: CONTROL_BG,
            opacity: pressed ? 0.7 : playButtonOpacity,
          },
        ]}
      >
        <Icon name={isPlaying ? 'Pause' : 'Play'} size={22} color="#FFFFFF" />
      </Pressable>

      {/* Top-right: bottom-right belongs to the media counter, bottom-left to
          the autoplay toggle, and the card's badge owns top-left. */}
      <Pressable
        onPress={toggleMute}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
        hitSlop={10}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: 10,
            top: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: CONTROL_BG,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name={isMuted ? 'VolumeX' : 'Volume2'} size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
