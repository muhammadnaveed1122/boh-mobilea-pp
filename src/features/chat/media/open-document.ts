import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

const CACHE_DIR = 'chat-docs';
const DEFAULT_MIME = 'application/octet-stream';

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
};

/** Strip path separators / odd characters so the name is safe on disk. */
function safeFileName(name: string | undefined, mimeType: string): string {
  const base = (name ?? 'document').replace(/[^\w.\-() ]+/g, '_').slice(0, 80);
  if (base.includes('.')) return base;
  return `${base}${EXTENSION_BY_MIME[mimeType] ?? ''}`;
}

/** Download the document into the cache (re-used on a second tap). */
async function cacheDocument(url: string, fileName: string): Promise<File> {
  const dir = new Directory(Paths.cache, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, fileName);
  if (target.exists) target.delete();
  await File.downloadFileAsync(url, target);
  return target;
}

/**
 * Opens a chat document in whatever app the OS has for it.
 *
 * Remote documents are signed Azure SAS URLs — handing those to the browser
 * just downloads them again, so the file is cached locally first and then
 * handed to a viewer: an `ACTION_VIEW` intent on Android (needs a `content://`
 * uri, hence the legacy helper) and the share/Quick Look sheet on iOS.
 * Throws with a user-facing message on failure.
 */
export async function openDocument(url: string, name?: string, mimeType?: string): Promise<void> {
  const mime = mimeType ?? DEFAULT_MIME;
  const isLocal = url.startsWith('file:') || url.startsWith('content:');

  if (Platform.OS === 'android' && url.startsWith('content:')) {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: url,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: mime,
    });
    return;
  }

  const fileUri = isLocal ? url : (await cacheDocument(url, safeFileName(name, mime))).uri;

  if (Platform.OS === 'android') {
    const contentUri = await getContentUriAsync(fileUri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mime,
      });
      return;
    } catch {
      // No app registered for this mime type — fall through to the share sheet.
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('No app available to open this document.');
  }
  await Sharing.shareAsync(fileUri, { mimeType: mime, dialogTitle: name ?? 'Document' });
}
