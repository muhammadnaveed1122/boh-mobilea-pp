import * as React from 'react';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';

export function RequestChangesSheet({
  sheetRef,
  onSubmit,
  isSubmitting,
}: Readonly<{
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onSubmit: (note: string) => void;
  isSubmitting: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = React.useState('');
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const muted = useThemeColor('--muted-foreground');

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
      onDismiss={() => setNote('')}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        className="gap-3"
      >
        <Text className="pt-1 text-base font-semibold text-popover-foreground">
          Request changes
        </Text>
        <Text className="text-sm text-muted-foreground">
          Tell the agent what needs to change before this can be approved.
        </Text>
        <BottomSheetTextInput
          value={note}
          onChangeText={setNote}
          placeholder="Describe the required changes"
          placeholderTextColor={muted}
          multiline
          className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground"
          style={{ textAlignVertical: 'top' }}
        />
        <Button
          variant="destructive"
          disabled={note.trim() === '' || isSubmitting}
          loading={isSubmitting}
          onPress={() => onSubmit(note.trim())}
        >
          <Text>Send request</Text>
        </Button>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
