import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { pickMediaMulti } from '../media/pickers';
import type { WizardMediaItem } from '../media/types';

/** Re-index order sequentially and ensure exactly one hero (the first, unless one is flagged). */
function normalize(items: WizardMediaItem[]): WizardMediaItem[] {
  const heroIdx = items.findIndex((m) => m.isHero);
  const heroPos = heroIdx >= 0 ? heroIdx : 0;
  return items.map((m, i) => ({ ...m, order: i, isHero: i === heroPos }));
}

export function MediaGallery({
  items,
  onChange,
}: Readonly<{ items: WizardMediaItem[]; onChange: (items: WizardMediaItem[]) => void }>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const previewUri = (m: WizardMediaItem): string | undefined => m.uri ?? m.url;

  const add = async () => {
    setBusy(true);
    try {
      const picked = await pickMediaMulti();
      if (picked.length > 0) onChange(normalize([...items, ...picked]));
    } finally {
      setBusy(false);
    }
  };

  const update = (index: number, patch: Partial<WizardMediaItem>) => {
    onChange(normalize(items.map((m, i) => (i === index ? { ...m, ...patch } : m))));
  };

  const remove = (index: number) => {
    onChange(normalize(items.filter((_, i) => i !== index)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(normalize(next));
  };

  const setHero = (index: number) => {
    onChange(normalize(items.map((m, i) => ({ ...m, isHero: i === index }))));
  };

  return (
    <View className="gap-3">
      {items.map((m, index) => (
        <View
          key={m.id ?? m.uri ?? String(index)}
          className="rounded-xl border border-border bg-background p-3"
        >
          <View className="flex-row gap-3">
            <View className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
              {previewUri(m) !== undefined ? (
                <Image source={{ uri: previewUri(m) }} style={{ width: '100%', height: '100%' }} />
              ) : null}
              {m.type === 'video' ? (
                <View className="absolute inset-0 items-center justify-center">
                  <Icon name="Play" size={20} color="white" />
                </View>
              ) : null}
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setHero(index)}
                  accessibilityRole="button"
                  accessibilityLabel={m.isHero ? 'Hero image' : 'Set as hero image'}
                  className={cn(
                    'flex-row items-center gap-1 rounded-full px-2 py-1',
                    m.isHero ? 'bg-brand/10' : 'bg-muted',
                  )}
                >
                  <Icon name="Star" size={12} color={m.isHero ? brand : mutedFg} />
                  <Text
                    className={cn(
                      'text-[10px] font-semibold',
                      m.isHero ? 'text-brand' : 'text-muted-foreground',
                    )}
                  >
                    {m.isHero ? 'Hero' : 'Set hero'}
                  </Text>
                </Pressable>
                <View className="flex-1" />
                <Pressable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="ArrowUp" size={14} color={index === 0 ? mutedFg : brand} />
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon
                    name="ArrowDown"
                    size={14}
                    color={index === items.length - 1 ? mutedFg : brand}
                  />
                </Pressable>
                <Pressable
                  onPress={() => remove(index)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove media"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="X" size={14} color={mutedFg} />
                </Pressable>
              </View>
              <Input
                value={m.altText}
                onChangeText={(t) => update(index, { altText: t })}
                placeholder="Alt text"
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={add}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Add images or videos"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-4 active:opacity-80"
      >
        <Icon name="Plus" size={18} color={brand} />
        <Text className="text-sm font-medium text-foreground">
          {busy ? 'Opening library…' : 'Add images / videos'}
        </Text>
      </Pressable>
    </View>
  );
}
