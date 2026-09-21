/**
 * Add one contact to the agent's phonebook. A name is compulsory — the whole
 * point of the phonebook is that saved names replace raw numbers everywhere,
 * so a nameless row would be dead weight.
 */

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { apiErrorMessage } from '../../api/error-message';
import { useCreateContact } from '../../hooks/use-agent-contacts';
import { useContactGroups } from '../../hooks/use-contact-groups';

export interface AddContactSheetHandle {
  open: (prefill?: { name?: string; phone?: string }) => void;
  close: () => void;
}

interface Props {
  /** Preselects a group when opened from inside a channel. */
  defaultGroupId?: string;
  onSaved?: () => void;
}

export const AddContactSheet = forwardRef<AddContactSheetHandle, Props>(function AddContactSheet(
  { defaultGroupId, onSaved }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const background = useThemeColor('--background');
  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const primaryForeground = useThemeColor('--primary-foreground');
  const snapPoints = useMemo(() => ['65%'], []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>(defaultGroupId);

  const { data: groups } = useContactGroups();
  const createMutation = useCreateContact();

  useImperativeHandle(
    ref,
    () => ({
      open: (prefill) => {
        setName(prefill?.name ?? '');
        setPhone(prefill?.phone ?? '');
        setGroupId(defaultGroupId);
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }),
    [defaultGroupId],
  );

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const canSave = trimmedName !== '' && trimmedPhone !== '' && !createMutation.isPending;

  const onSave = useCallback(() => {
    if (!canSave) return;
    createMutation.mutate(
      { name: trimmedName, phone: trimmedPhone, groupId },
      {
        onSuccess: () => {
          sheetRef.current?.dismiss();
          onSaved?.();
        },
        onError: (error) => {
          Alert.alert('Could not save contact', apiErrorMessage(error));
        },
      },
    );
  }, [canSave, createMutation, groupId, onSaved, trimmedName, trimmedPhone]);

  const inputStyle = {
    height: 48,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: foreground,
  } as const;

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
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="subheading">New contact</Text>

          <View className="gap-2">
            <Text variant="label">Name</Text>
            <BottomSheetTextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sara Ahmed"
              placeholderTextColor={mutedFg}
              autoCapitalize="words"
              autoComplete="name"
              style={inputStyle}
            />
          </View>

          <View className="gap-2">
            <Text variant="label">Phone</Text>
            <BottomSheetTextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+9715XXXXXXX"
              placeholderTextColor={mutedFg}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={inputStyle}
            />
            <Text variant="muted" className="text-xs">
              Include the country code.
            </Text>
          </View>

          {groups && groups.length > 0 ? (
            <View className="gap-2">
              <Text variant="label">Channel (optional)</Text>
              <View className="flex-row flex-wrap gap-2">
                <GroupChip
                  label="None"
                  selected={groupId === undefined}
                  onPress={() => setGroupId(undefined)}
                />
                {groups.map((g) => (
                  <GroupChip
                    key={g.id}
                    label={g.name}
                    selected={groupId === g.id}
                    onPress={() => setGroupId(g.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save contact"
            accessibilityState={{ disabled: !canSave }}
            className="h-12 flex-row items-center justify-center rounded-xl bg-primary active:opacity-80"
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={primaryForeground} />
            ) : (
              <Text className="font-semibold text-primary-foreground">Save contact</Text>
            )}
          </Pressable>
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function GroupChip({
  label,
  selected,
  onPress,
}: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      className={
        selected
          ? 'rounded-full border border-primary bg-primary px-4 py-2'
          : 'rounded-full border border-border px-4 py-2'
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 36 })}
    >
      <Text
        className={
          selected ? 'text-sm font-medium text-primary-foreground' : 'text-sm text-foreground'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
