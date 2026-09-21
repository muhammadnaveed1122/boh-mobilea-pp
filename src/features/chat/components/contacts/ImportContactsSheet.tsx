/**
 * Bulk contact import. Accepts either a picked CSV file or pasted text — the
 * paste path exists because sharing a CSV into a phone is often more friction
 * than copying a column out of a spreadsheet app.
 *
 * Parsing is client-side (matching the web client); the backend receives a
 * plain `{ contacts: [{name, phone}] }` array.
 */

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { apiErrorMessage } from '../../api/error-message';
import { useImportContacts } from '../../hooks/use-agent-contacts';
import { useContactGroups } from '../../hooks/use-contact-groups';
import { parseContactsCsv, pickCsvText } from '../../media/pick-csv';

export interface ImportContactsSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  defaultGroupId?: string;
  onImported?: (count: number) => void;
}

export const ImportContactsSheet = forwardRef<ImportContactsSheetHandle, Props>(
  function ImportContactsSheet({ defaultGroupId, onImported }: Readonly<Props>, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const background = useThemeColor('--background');
    const mutedFg = useThemeColor('--muted-foreground');
    const foreground = useThemeColor('--foreground');
    const border = useThemeColor('--border');
    const primary = useThemeColor('--primary');
    const primaryForeground = useThemeColor('--primary-foreground');
    const snapPoints = useMemo(() => ['80%'], []);

    const [raw, setRaw] = useState('');
    const [groupId, setGroupId] = useState<string | undefined>(defaultGroupId);
    const { data: groups } = useContactGroups();
    const importMutation = useImportContacts();

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          setRaw('');
          setGroupId(defaultGroupId);
          sheetRef.current?.present();
        },
        close: () => sheetRef.current?.dismiss(),
      }),
      [defaultGroupId],
    );

    const parsed = useMemo(() => parseContactsCsv(raw), [raw]);
    const canImport = parsed.rows.length > 0 && !importMutation.isPending;

    const onPickFile = useCallback(async () => {
      try {
        const text = await pickCsvText();
        if (text !== null) setRaw(text);
      } catch (error) {
        Alert.alert('Could not read file', apiErrorMessage(error, 'The CSV could not be opened.'));
      }
    }, []);

    const onImport = useCallback(() => {
      if (!canImport) return;
      importMutation.mutate(
        { contacts: parsed.rows, groupId },
        {
          onSuccess: (result) => {
            sheetRef.current?.dismiss();
            onImported?.(result.imported);
          },
          onError: (error) => {
            Alert.alert('Import failed', apiErrorMessage(error));
          },
        },
      );
    }, [canImport, groupId, importMutation, onImported, parsed.rows]);

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
            <View className="gap-1">
              <Text variant="subheading">Import contacts</Text>
              <Text variant="muted">One contact per line: name, phone.</Text>
            </View>

            <Pressable
              onPress={onPickFile}
              accessibilityRole="button"
              accessibilityLabel="Choose a CSV file"
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border active:opacity-70"
            >
              <Icon name="FileUp" size={18} color={primary} />
              <Text className="font-medium text-foreground">Choose a CSV file</Text>
            </Pressable>

            <View className="gap-2">
              <Text variant="label">Or paste rows</Text>
              <BottomSheetTextInput
                value={raw}
                onChangeText={setRaw}
                placeholder={'Sara Ahmed, +971501234567\nOmar Khan, +971509876543'}
                placeholderTextColor={mutedFg}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 140,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 12,
                  padding: 12,
                  color: foreground,
                }}
              />
            </View>

            {raw.trim() !== '' ? (
              <View className="gap-1 rounded-xl bg-muted p-3">
                <Text className="text-sm font-medium text-foreground">
                  {parsed.rows.length} contact{parsed.rows.length === 1 ? '' : 's'} ready
                </Text>
                {parsed.invalidLines.length > 0 ? (
                  <Text variant="error" className="text-xs">
                    Skipping {parsed.invalidLines.length} unreadable line
                    {parsed.invalidLines.length === 1 ? '' : 's'} (line{' '}
                    {parsed.invalidLines.slice(0, 5).join(', ')}
                    {parsed.invalidLines.length > 5 ? '…' : ''}).
                  </Text>
                ) : null}
              </View>
            ) : null}

            {groups && groups.length > 0 ? (
              <View className="gap-2">
                <Text variant="label">Add all to channel (optional)</Text>
                <View className="flex-row flex-wrap gap-2">
                  <ChoiceChip
                    label="None"
                    selected={groupId === undefined}
                    onPress={() => setGroupId(undefined)}
                  />
                  {groups.map((g) => (
                    <ChoiceChip
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
              onPress={onImport}
              disabled={!canImport}
              accessibilityRole="button"
              accessibilityLabel="Import contacts"
              accessibilityState={{ disabled: !canImport }}
              className="h-12 flex-row items-center justify-center rounded-xl bg-primary active:opacity-80"
              style={{ opacity: canImport ? 1 : 0.5 }}
            >
              {importMutation.isPending ? (
                <ActivityIndicator color={primaryForeground} />
              ) : (
                <Text className="font-semibold text-primary-foreground">
                  Import {parsed.rows.length > 0 ? parsed.rows.length : ''}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

function ChoiceChip({
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
