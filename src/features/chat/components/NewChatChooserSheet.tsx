/**
 * New-chat chooser, mirroring the web client's three options. Shown only to
 * dedicated-number agents — shared-number agents have no phonebook or
 * broadcasts, so the inbox skips this and opens `NewChatSheet` directly rather
 * than presenting a menu with two dead entries.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import type * as icons from 'lucide-react-native/icons';

export interface NewChatChooserSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  onSendMessage: () => void;
  onMessageMultiple: () => void;
  onBroadcast: () => void;
}

export const NewChatChooserSheet = forwardRef<NewChatChooserSheetHandle, Props>(
  function NewChatChooserSheet(
    { onSendMessage, onMessageMultiple, onBroadcast }: Readonly<Props>,
    ref,
  ) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const background = useThemeColor('--background');
    const mutedFg = useThemeColor('--muted-foreground');
    const snapPoints = useMemo(() => ['42%'], []);

    useImperativeHandle(
      ref,
      () => ({
        open: () => sheetRef.current?.present(),
        close: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

    const pick = (fn: () => void) => () => {
      sheetRef.current?.dismiss();
      fn();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: background }}
        handleIndicatorStyle={{ backgroundColor: mutedFg }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <View style={{ padding: 16, gap: 8 }}>
            <Text variant="subheading" className="mb-2">
              New chat
            </Text>
            <ChooserRow
              icon="MessageSquarePlus"
              title="Send a message"
              subtitle="One-to-one chat from your number"
              onPress={pick(onSendMessage)}
            />
            <ChooserRow
              icon="Users"
              title="Message multiple contacts"
              subtitle="Pick contacts and send a template — each gets its own separate chat"
              onPress={pick(onMessageMultiple)}
            />
            <ChooserRow
              icon="Megaphone"
              title="Broadcast to channel"
              subtitle="Send a template to every contact in a channel"
              onPress={pick(onBroadcast)}
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

interface RowProps {
  icon: keyof typeof icons;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function ChooserRow({ icon, title, subtitle, onPress }: Readonly<RowProps>) {
  const primary = useThemeColor('--primary');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      className="flex-row items-center gap-3 rounded-2xl bg-card p-3 active:opacity-80"
      style={{ minHeight: 64 }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon name={icon} size={20} color={primary} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{subtitle}</Text>
      </View>
      <Icon name="ChevronRight" size={18} color={primary} />
    </Pressable>
  );
}
