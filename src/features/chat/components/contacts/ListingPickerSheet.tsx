/**
 * Attach a property listing to a broadcast. The chosen listing's hero image is
 * sent as the template's `headerImageUrl` and rides its IMAGE header component.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { useThemeColor } from '@theme';

import { useListingSearch } from '../../hooks/use-listing-search';
import type { ListingCard } from '../../models/contact';

export interface ListingPickerSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  onPick: (listing: ListingCard) => void;
}

export const ListingPickerSheet = forwardRef<ListingPickerSheetHandle, Props>(
  function ListingPickerSheet({ onPick }: Readonly<Props>, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const background = useThemeColor('--background');
    const mutedFg = useThemeColor('--muted-foreground');
    const foreground = useThemeColor('--foreground');
    const border = useThemeColor('--border');
    const snapPoints = useMemo(() => ['85%'], []);

    const [search, setSearch] = useState('');
    const debounced = useDebouncedValue(search, 300);
    const { data, isFetching } = useListingSearch(debounced);
    const listings = data ?? [];

    useImperativeHandle(
      ref,
      () => ({
        open: () => sheetRef.current?.present(),
        close: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

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
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text className="mb-2 text-base font-semibold">Attach a listing</Text>
          <BottomSheetTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by project, area or title"
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
          data={listings}
          keyExtractor={(l: ListingCard) => l.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={
            isFetching ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={foreground} />
            ) : (
              <Text className="mt-6 text-center text-sm text-muted-foreground">
                No listings with a photo matched.
              </Text>
            )
          }
          renderItem={({ item }: { item: ListingCard }) => (
            <Pressable
              onPress={() => {
                onPick(item);
                sheetRef.current?.dismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Attach ${item.title}`}
              className="flex-row items-center gap-3 rounded-xl bg-card p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Image
                source={{ uri: item.imageUrl }}
                accessibilityIgnoresInvertColors
                style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: border }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.location !== '' ? (
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
                <Text className="mt-0.5 text-xs font-medium text-foreground">
                  {item.priceLabel}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </BottomSheetModal>
    );
  },
);
