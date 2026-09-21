import { Alert } from 'react-native';

import type { BroadcastResult } from '../../models/contact';

/**
 * Report a blast outcome. Partial failure is the common case (one number is
 * unreachable, one template param is rejected), so failures are listed
 * explicitly instead of collapsing the whole send into "failed".
 */
export function alertBroadcastResult(result: BroadcastResult, onDone?: () => void): void {
  const { total, sent, failed } = result;

  if (failed.length === 0) {
    Alert.alert('Broadcast sent', `Delivered to ${sent} of ${total} contacts.`, [
      { text: 'OK', onPress: onDone },
    ]);
    return;
  }

  const preview = failed
    .slice(0, 5)
    .map((f) => `${f.phone}: ${f.error}`)
    .join('\n');
  const more = failed.length > 5 ? `\n…and ${failed.length - 5} more.` : '';

  Alert.alert(
    'Sent with errors',
    `Delivered to ${sent} of ${total}.\n\nFailed:\n${preview}${more}`,
    [{ text: 'OK', onPress: onDone }],
  );
}
