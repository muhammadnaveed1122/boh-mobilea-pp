import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Checkbox } from '@/components/atoms/Checkbox';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { resolveAmenityIcon } from '@/lib/amenities';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { MasterAmenity } from '../services';

export function AmenitiesSelector({
  options,
  selectedIds,
  onChange,
}: Readonly<{
  options: MasterAmenity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const [search, setSearch] = useState('');

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === '') return options;
    return options.filter((a) => a.name.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <View className="gap-3">
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search amenities"
        autoCapitalize="none"
      />
      {filtered.length === 0 ? (
        <Text className="py-2 text-sm text-muted-foreground">No amenities match your search.</Text>
      ) : (
        <View className="gap-2">
          {filtered.map((a) => {
            const isSelected = selected.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => toggle(a.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={a.name}
                className={cn(
                  'flex-row items-center gap-3 rounded-xl border p-3',
                  isSelected ? 'border-brand bg-brand/10' : 'border-border bg-background',
                )}
              >
                <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {a.iconUrl !== null ? (
                    <Image
                      source={{ uri: a.iconUrl }}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon
                      name={resolveAmenityIcon({ icon: a.icon, slug: a.slug, label: a.name })}
                      size={18}
                      color={mutedFg}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-foreground">{a.name}</Text>
                    {a.isPfAmenity ? (
                      <View className="flex-row items-center gap-0.5 rounded bg-muted px-1 py-0.5">
                        <Icon name="Globe" size={9} color={mutedFg} />
                        <Text className="text-[9px] text-muted-foreground">PF</Text>
                      </View>
                    ) : null}
                  </View>
                  {a.description !== '' ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                      {a.description}
                    </Text>
                  ) : null}
                </View>
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(a.id)} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
