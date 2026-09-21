import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';

import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { getLeads } from '@/features/leads/services';
import type { LeadListItem } from '@/features/leads/types';
import { useThemeColor } from '@theme';

export interface LeadPickerSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  onPick: (leadId: string) => void;
}

export const LeadPickerSheet = forwardRef<LeadPickerSheetHandle, Props>(function LeadPickerSheet(
  { onPick }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const background = useThemeColor('--background');
  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const snapPoints = useMemo(() => ['80%'], []);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.present(),
      close: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const { data, isFetching } = useQuery({
    queryKey: ['lead-picker', debounced],
    queryFn: () =>
      getLeads({
        search: debounced.trim() === '' ? undefined : debounced.trim(),
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
  });
  const leads: LeadListItem[] = data?.items ?? [];

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
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text className="mb-2 text-base font-semibold">Assign to a lead</Text>
          <BottomSheetTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email or phone"
            placeholderTextColor={mutedFg}
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: border,
              borderRadius: 10,
              paddingHorizontal: 12,
              color: foreground,
            }}
          />
        </View>
        <BottomSheetFlatList
          data={leads}
          keyExtractor={(l) => l.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 8 }}
          ListEmptyComponent={
            isFetching ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={foreground} />
            ) : (
              <Text className="mt-6 text-center text-sm text-muted-foreground">No leads found</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onPick(item.id);
                sheetRef.current?.dismiss();
              }}
              className="rounded-lg px-3 py-3 active:bg-muted-foreground/10"
            >
              <Text className="text-sm font-medium" numberOfLines={1}>
                {item.name ?? item.email ?? 'Unnamed lead'}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {item.phone && item.phone !== '' ? item.phone : (item.email ?? '')}
              </Text>
            </Pressable>
          )}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
