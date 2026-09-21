/**
 * Bottom sheet wrapper around TemplatePicker. Used when a conversation has
 * no WhatsApp messages yet — the 24h window is closed, so free-text is
 * locked, but the user can still kick off the thread with an approved
 * template.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

import { useThemeColor } from '@theme';

import { TemplatePicker } from './TemplatePicker';

export interface TemplateSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  leadId: string;
  leadName: string;
  phone: string;
}

export const TemplateSheet = forwardRef<TemplateSheetHandle, Props>(function TemplateSheet(
  { leadId, leadName, phone }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const background = useThemeColor('--background');
  const handle = useThemeColor('--muted-foreground');
  const snapPoints = useMemo(() => ['70%'], []);

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: handle }}
    >
      <View className="flex-1">
        <TemplatePicker leadId={leadId} leadName={leadName} phone={phone} inSheet />
      </View>
    </BottomSheet>
  );
});
