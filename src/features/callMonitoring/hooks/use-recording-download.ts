import { useCallback, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CONFIG } from '@/lib/config';
import { showErrorToast } from '@/lib/toast/toast.store';
import { useAuthStore } from '@/store/auth.store';

export interface RecordingDownload {
  /** Fetch a call's recording and hand it to the OS share/save sheet. */
  download: (uuid: string) => void;
  /** uuid currently downloading (drives the button spinner), or null. */
  downloadingId: string | null;
}

/**
 * Downloads a call recording by uuid. The web app streams the blob and triggers
 * a browser download; on mobile the equivalent is fetching the authed audio,
 * caching it to a file, then opening the share sheet (Save to Files / AirDrop /
 * etc.) — same pattern as the CSV export. The server enforces `calls:download`.
 */
export function useRecordingDownload(): RecordingDownload {
  const token = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(
    (uuid: string) => {
      if (downloadingId) return;
      setDownloadingId(uuid);
      (async () => {
        try {
          const res = await fetch(
            `${CONFIG.API_BASE_URL}/api/v1/call-service/calls/${encodeURIComponent(
              uuid,
            )}/recording/download`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          );
          if (!res.ok) {
            throw new Error(
              res.status === 404
                ? 'Recording not available for this call.'
                : res.status === 403
                  ? 'You do not have permission to download this recording.'
                  : `Could not download recording (${String(res.status)}).`,
            );
          }
          const bytes = new Uint8Array(await res.arrayBuffer());
          const file = new File(Paths.cache, `call-${uuid}.wav`);
          if (file.exists) file.delete();
          file.create();
          file.write(bytes);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
              mimeType: 'audio/wav',
              dialogTitle: 'Save recording',
              UTI: 'com.microsoft.waveform-audio',
            });
          }
        } catch (e) {
          showErrorToast(e instanceof Error ? e.message : 'Could not download recording.');
        } finally {
          setDownloadingId(null);
        }
      })().catch(() => {});
    },
    [downloadingId, token],
  );

  return { download, downloadingId };
}
