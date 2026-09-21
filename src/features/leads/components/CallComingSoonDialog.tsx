/**
 * CallComingSoonDialog — shown when the current user cannot place calls
 * because no SIP calling extension is assigned to their account.
 *
 * (Repurposed from the old "coming soon" placeholder now that in-app calling
 * ships — the shared copy still lives in one place.) Controlled component:
 * the parent owns the boolean and supplies `onClose`.
 */

import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';

interface CallComingSoonDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function CallComingSoonDialog({ visible, onClose }: Readonly<CallComingSoonDialogProps>) {
  return (
    <Dialog
      visible={visible}
      onRequestClose={onClose}
      title="Calling unavailable"
      description="Calling isn't enabled for your account. Ask an admin to assign you a calling extension, then sign in again."
    >
      <Button variant="default" onPress={onClose}>
        <Text>Close</Text>
      </Button>
    </Dialog>
  );
}
