import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { LABEL_PRESET_COLORS } from '../../models/label';
import { useChatLabels, useSaveChatLabels } from '../../hooks/use-chat-labels';
import { LabelColorPicker } from './LabelColorPicker';

export interface ManageLabelsSheetHandle {
  open: () => void;
  close: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- forwardRef props: component takes no props
interface ManageLabelsSheetProps {}

interface DraftLabel {
  localId: string;
  serverId?: string;
  name: string;
  color: string;
}

let tempCounter = 0;
function nextTempId(): string {
  tempCounter += 1;
  return `new-${tempCounter}`;
}

function LabelRow({
  row,
  index,
  rows,
  mutedFg,
  foreground,
  border,
  onMove,
  onUpdate,
  onRemove,
}: Readonly<{
  row: DraftLabel;
  index: number;
  rows: DraftLabel[];
  mutedFg: string;
  foreground: string;
  border: string;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdate: (localId: string, patch: Partial<DraftLabel>) => void;
  onRemove: (localId: string) => void;
}>) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-border p-2">
      <View>
        <Pressable onPress={() => onMove(index, -1)} hitSlop={6} accessibilityLabel="Move up">
          <Icon name="ChevronUp" size={16} color={mutedFg} />
        </Pressable>
        <Pressable onPress={() => onMove(index, 1)} hitSlop={6} accessibilityLabel="Move down">
          <Icon name="ChevronDown" size={16} color={mutedFg} />
        </Pressable>
      </View>
      <LabelColorPicker
        color={row.color}
        onChange={(c) => onUpdate(row.localId, { color: c })}
        usedColors={rows.filter((r) => r.localId !== row.localId).map((r) => r.color)}
      />
      <BottomSheetTextInput
        value={row.name}
        onChangeText={(v) => onUpdate(row.localId, { name: v })}
        placeholder="Label name"
        placeholderTextColor={border}
        style={{ flex: 1, height: 40, paddingHorizontal: 8, color: foreground }}
      />
      <Pressable
        onPress={() => onRemove(row.localId)}
        hitSlop={8}
        accessibilityLabel="Remove label"
      >
        <Icon name="X" size={16} color={mutedFg} />
      </Pressable>
    </View>
  );
}

export const ManageLabelsSheet = forwardRef<ManageLabelsSheetHandle, ManageLabelsSheetProps>(
  function ManageLabelsSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const background = useThemeColor('--background');
    const handle = useThemeColor('--muted-foreground');
    const mutedFg = useThemeColor('--muted-foreground');
    const foreground = useThemeColor('--foreground');
    const border = useThemeColor('--border');
    const snapPoints = useMemo(() => ['85%'], []);

    const { data: labels = [] } = useChatLabels();
    const save = useSaveChatLabels();
    const [rows, setRows] = useState<DraftLabel[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          // Seed from the latest server labels each open.
          setRows(
            labels.map((l) => ({ localId: l.id, serverId: l.id, name: l.name, color: l.color })),
          );
          sheetRef.current?.present();
        },
        close: () => sheetRef.current?.dismiss(),
      }),
      [labels],
    );

    const update = (localId: string, patch: Partial<DraftLabel>): void =>
      setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));

    const move = (index: number, dir: -1 | 1): void =>
      setRows((prev) => {
        const next = [...prev];
        const target = index + dir;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });

    const addRow = (): void =>
      setRows((prev) => {
        const used = new Set(prev.map((r) => r.color.toLowerCase()));
        const free = LABEL_PRESET_COLORS.find((c) => !used.has(c.toLowerCase()));
        return [
          ...prev,
          { localId: nextTempId(), name: '', color: free ?? LABEL_PRESET_COLORS[0] },
        ];
      });

    const removeRow = (localId: string): void =>
      setRows((prev) => prev.filter((r) => r.localId !== localId));

    const onSave = (): void => {
      const named = rows.filter((r) => r.name.trim() !== '');
      const colors = named.map((r) => r.color.toLowerCase());
      if (new Set(colors).size !== colors.length) {
        Alert.alert('Duplicate colour', 'Each label must have a unique colour.');
        return;
      }
      save.mutate(
        named.map((r) => ({
          ...(r.serverId ? { id: r.serverId } : {}),
          name: r.name.trim(),
          color: r.color,
        })),
        {
          onSuccess: () => sheetRef.current?.dismiss(),
          onError: () => Alert.alert('Save failed', 'Could not save labels. Please try again.'),
        },
      );
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: background }}
        handleIndicatorStyle={{ backgroundColor: handle }}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
        >
          <Text className="mb-1 text-base font-semibold">Manage labels</Text>
          {rows.map((row, index) => (
            <LabelRow
              key={row.localId}
              row={row}
              index={index}
              rows={rows}
              mutedFg={mutedFg}
              foreground={foreground}
              border={border}
              onMove={move}
              onUpdate={update}
              onRemove={removeRow}
            />
          ))}
          {rows.length === 0 ? (
            <Text className="py-2 text-center text-sm text-muted-foreground">
              No labels yet. Add your first below.
            </Text>
          ) : null}
          <Pressable
            onPress={addRow}
            className="flex-row items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 active:opacity-70"
          >
            <Icon name="Plus" size={16} color={mutedFg} />
            <Text className="text-sm text-muted-foreground">Add</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={save.isPending}
            className="mt-2 items-center rounded-lg bg-primary py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              {save.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
