import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';

/**
 * Keyboard-aware dialog for a reviewer to request changes with a required note.
 * Mirrors the web wizard's RequestChangesModal. The note is sent as
 * `changeNotes`, flipping the listing to `changes_requested` and unlocking the
 * agent's form. Uses the shared Dialog atom (KeyboardAwareScrollView inside).
 */
export function RequestChangesDialog({
  visible,
  submitting,
  onSubmit,
  onClose,
}: Readonly<{
  visible: boolean;
  submitting: boolean;
  onSubmit: (notes: string) => void;
  onClose: () => void;
}>) {
  const [notes, setNotes] = useState('');
  const trimmed = notes.trim();

  const close = () => {
    setNotes('');
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onRequestClose={close}
      dismissOnBackdropPress={!submitting}
      scrollable
      title="Request changes"
      description="Tell the agent what needs updating. They'll be able to edit and resubmit."
    >
      <Textarea
        value={notes}
        onChangeText={setNotes}
        placeholder="Describe the changes needed…"
        className="min-h-32"
        autoFocus
      />

      <View className="mt-4 flex-row gap-3">
        <Button variant="ghost" className="flex-1" onPress={close} disabled={submitting}>
          <Text>Cancel</Text>
        </Button>
        <Button
          className="flex-1"
          onPress={() => onSubmit(trimmed)}
          disabled={trimmed === '' || submitting}
          loading={submitting}
        >
          <Text>Send Request</Text>
        </Button>
      </View>
    </Dialog>
  );
}
