import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { pickSingleImage } from '../media/pickers';
import type { WizardMediaItem } from '../media/types';

export function SingleImageField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: WizardMediaItem | null;
  onChange: (v: WizardMediaItem | null) => void;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const picked = await pickSingleImage();
      if (picked !== null) onChange(picked);
    } finally {
      setBusy(false);
    }
  };

  const previewUri = value?.uri ?? value?.url;

  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {value !== null ? (
        <View className="rounded-xl border border-border bg-background p-3">
          <View className="flex-row gap-3">
            <View className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
              {previewUri !== undefined ? (
                <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
              ) : null}
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row justify-end">
                <Pressable
                  onPress={() => onChange(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${label}`}
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="X" size={14} color={mutedFg} />
                </Pressable>
              </View>
              <Input
                value={value.altText}
                onChangeText={(t) => onChange({ ...value, altText: t })}
                placeholder="Alt text"
              />
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-6 active:opacity-80"
        >
          <Icon name="Plus" size={18} color={brand} />
          <Text className="text-sm font-medium text-foreground">
            {busy ? 'Opening library…' : 'Add image'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
