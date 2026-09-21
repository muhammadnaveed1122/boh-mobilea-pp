import { ActivityIndicator, Pressable } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import type { RecordingDownload } from '../hooks/use-recording-download';

interface Props {
  uuid: string;
  download: RecordingDownload;
  /** Compact icon-only for list rows; labeled for the detail screen. */
  labeled?: boolean;
}

/**
 * Downloads a call recording via {@link RecordingDownload}. Gated by
 * `calls:download` at the call site — mirrors the web download button.
 */
export function DownloadButton({ uuid, download, labeled }: Readonly<Props>) {
  const fg = useThemeColor('--foreground');
  const loading = download.downloadingId === uuid;

  return (
    <Pressable
      onPress={() => download.download(uuid)}
      hitSlop={8}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Download recording"
      className={cn(
        'flex-row items-center gap-1.5 rounded-lg border border-border bg-card active:opacity-70',
        labeled ? 'px-3 py-2' : 'px-2.5 py-1.5',
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon name="Download" size={16} color={fg} />
      )}
      {labeled ? <Text className="text-sm font-medium text-foreground">Download</Text> : null}
    </Pressable>
  );
}
