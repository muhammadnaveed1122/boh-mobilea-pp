import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  useChatLabels,
  useConversationLabels,
  useSetConversationLabels,
} from '../../hooks/use-chat-labels';

export interface LabelAssignSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  conversationId: string;
  onManage: () => void;
}

export const LabelAssignSheet = forwardRef<LabelAssignSheetHandle, Props>(function LabelAssignSheet(
  { conversationId, onManage }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const background = useThemeColor('--background');
  const handle = useThemeColor('--muted-foreground');
  const info = useThemeColor('--info');
  const snapPoints = useMemo(() => ['60%'], []);

  const { data: all = [] } = useChatLabels();
  const { data: assigned = [] } = useConversationLabels(conversationId);
  const setLabels = useSetConversationLabels(conversationId);
  const assignedIds = new Set(assigned.map((l) => l.id));

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.present(),
      close: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const toggle = (id: string): void => {
    const next = assignedIds.has(id)
      ? assigned.filter((l) => l.id !== id).map((l) => l.id)
      : [...assigned.map((l) => l.id), id];
    setLabels.mutate(next, {
      onError: () => Alert.alert('Update failed', 'Could not update labels. Please try again.'),
    });
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: handle }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-semibold">Labels</Text>
          <Pressable onPress={onManage} hitSlop={8} className="active:opacity-70">
            <Text className="text-sm font-medium" style={{ color: info }}>
              Manage
            </Text>
          </Pressable>
        </View>
        {all.length === 0 ? (
          <Text className="py-4 text-center text-sm text-muted-foreground">
            No labels yet. Tap Manage to create some.
          </Text>
        ) : (
          all.map((label) => {
            const on = assignedIds.has(label.id);
            return (
              <Pressable
                key={label.id}
                onPress={() => toggle(label.id)}
                className="flex-row items-center gap-2 rounded-lg px-2 py-3 active:bg-muted-foreground/10"
              >
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                <Text className="flex-1 text-sm">{label.name}</Text>
                {on ? <Icon name="Check" size={18} color={info} /> : null}
              </Pressable>
            );
          })
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
