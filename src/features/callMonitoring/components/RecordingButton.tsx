import { ActivityIndicator, Pressable } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import type { RecordingPlayer } from '../hooks/use-recording-player';

interface Props {
  uuid: string;
  player: RecordingPlayer;
  /** Compact icon-only for list rows; labeled for the detail screen. */
  labeled?: boolean;
}

/**
 * Collapsed trigger that loads a recording. Once loaded, callers swap this for
 * the full {@link AudioPlayer}, so this only ever shows "load / play".
 */
export function RecordingButton({ uuid, player, labeled }: Readonly<Props>) {
  const primary = useThemeColor('--primary');
  const loading = player.loadingId === uuid;

  return (
    <Pressable
      onPress={() => player.toggle(uuid)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Play recording"
      className={cn(
        'flex-row items-center gap-1.5 rounded-lg border border-border bg-card active:opacity-70',
        labeled ? 'px-3 py-2' : 'px-2.5 py-1.5',
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary} />
      ) : (
        <Icon name="Play" size={16} color={primary} fill={primary} />
      )}
      {labeled ? <Text className="text-sm font-medium text-foreground">Play recording</Text> : null}
    </Pressable>
  );
}
