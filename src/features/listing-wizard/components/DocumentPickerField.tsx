import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { isDocumentPickingAvailable, pickDocumentsMulti } from '../media/pickers';
import type { WizardDocItem } from '../media/types';

export function DocumentPickerField({
  items,
  onChange,
}: Readonly<{ items: WizardDocItem[]; onChange: (items: WizardDocItem[]) => void }>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!isDocumentPickingAvailable()) {
      Alert.alert('Unavailable', 'Document picking needs a native rebuild of the app.');
      return;
    }
    setBusy(true);
    try {
      const picked = await pickDocumentsMulti();
      if (picked.length > 0) onChange([...items, ...picked]);
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View className="gap-2">
      {items.map((doc, index) => (
        <View
          key={`${doc.uri}-${String(index)}`}
          className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <Icon name="FileText" size={16} color={mutedFg} />
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {doc.name}
          </Text>
          <Pressable
            onPress={() => remove(index)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${doc.name}`}
            className="h-8 w-8 items-center justify-center rounded-full bg-muted"
          >
            <Icon name="X" size={14} color={mutedFg} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={add}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Add documents"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-4 active:opacity-80"
      >
        <Icon name="Plus" size={18} color={brand} />
        <Text className="text-sm font-medium text-foreground">
          {busy ? 'Opening…' : 'Add documents'}
        </Text>
      </Pressable>
    </View>
  );
}
