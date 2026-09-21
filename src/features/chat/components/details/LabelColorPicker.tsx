import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { LABEL_PRESET_COLORS } from '../../models/label';
import { useThemeColor } from '@theme';

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string {
  const v = value.trim();
  return (v.startsWith('#') ? v : `#${v}`).toUpperCase();
}

export function LabelColorPicker({
  color,
  onChange,
  usedColors = [],
}: Readonly<{ color: string; onChange: (c: string) => void; usedColors?: string[] }>) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color);
  const background = useThemeColor('--background');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));

  const commit = (next: string): void => {
    if (!usedSet.has(next.toLowerCase())) onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setHex(color);
          setOpen(true);
        }}
        accessibilityLabel="Pick colour"
        style={{
          height: 28,
          width: 28,
          borderRadius: 6,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: border,
        }}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: background, borderRadius: 16, padding: 16, gap: 12 }}
          >
            <Text className="text-base font-semibold">Label colour</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {LABEL_PRESET_COLORS.map((preset) => {
                const selected = preset.toLowerCase() === color.toLowerCase();
                const taken = usedSet.has(preset.toLowerCase()) && !selected;
                return (
                  <Pressable
                    key={preset}
                    disabled={taken}
                    onPress={() => commit(preset)}
                    accessibilityLabel={taken ? `${preset} (used)` : preset}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 16,
                      backgroundColor: preset,
                      borderWidth: selected ? 3 : 0,
                      borderColor: foreground,
                      opacity: taken ? 0.3 : 1,
                    }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={hex}
                onChangeText={setHex}
                autoCapitalize="characters"
                placeholder="#ED5F11"
                placeholderTextColor={border}
                style={{
                  flex: 1,
                  height: 40,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  color: foreground,
                }}
              />
              <Pressable
                onPress={() => {
                  const norm = normalizeHex(hex);
                  commit(HEX_RE.test(norm) ? norm : color);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text className="text-sm font-medium">OK</Text>
              </Pressable>
            </View>
            {usedColors.length > 0 ? (
              <Text className="text-xs text-muted-foreground">
                Greyed-out colours are used by other labels.
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
