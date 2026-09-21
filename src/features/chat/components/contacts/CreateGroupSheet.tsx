/** Create a broadcast group ("channel"). Name only — members are attached separately. */

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { apiErrorMessage } from '../../api/error-message';
import { useCreateContactGroup } from '../../hooks/use-contact-groups';

export interface CreateGroupSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  onCreated?: (groupId: string) => void;
}

export const CreateGroupSheet = forwardRef<CreateGroupSheetHandle, Props>(function CreateGroupSheet(
  { onCreated }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const background = useThemeColor('--background');
  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const primaryForeground = useThemeColor('--primary-foreground');
  const snapPoints = useMemo(() => ['45%'], []);
  const [name, setName] = useState('');
  const createMutation = useCreateContactGroup();

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setName('');
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const trimmed = name.trim();
  const canSave = trimmed !== '' && !createMutation.isPending;

  const onSave = useCallback(() => {
    if (!canSave) return;
    createMutation.mutate(trimmed, {
      onSuccess: (group) => {
        sheetRef.current?.dismiss();
        onCreated?.(group.id);
      },
      onError: (error) => {
        Alert.alert('Could not create channel', apiErrorMessage(error));
      },
    });
  }, [canSave, createMutation, onCreated, trimmed]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: mutedFg }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 16 }}>
          <View className="gap-1">
            <Text variant="subheading">New channel</Text>
            <Text variant="muted">
              Group contacts so you can send one template to all of them at once.
            </Text>
          </View>

          <View className="gap-2">
            <Text variant="label">Channel name</Text>
            <BottomSheetTextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Downtown buyers"
              placeholderTextColor={mutedFg}
              autoCapitalize="sentences"
              style={{
                height: 48,
                borderWidth: 1,
                borderColor: border,
                borderRadius: 12,
                paddingHorizontal: 12,
                color: foreground,
              }}
            />
          </View>

          <Pressable
            onPress={onSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Create channel"
            accessibilityState={{ disabled: !canSave }}
            className="h-12 flex-row items-center justify-center rounded-xl bg-primary active:opacity-80"
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={primaryForeground} />
            ) : (
              <Text className="font-semibold text-primary-foreground">Create channel</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
