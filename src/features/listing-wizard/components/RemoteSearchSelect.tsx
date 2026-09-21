/**
 * RemoteSearchSelect — form field backed by a server-paginated bottom-sheet picker.
 *
 * Reads/writes the form field value via useFieldContext<string | undefined>.
 * Open a Modal bottom-sheet with:
 *   - a debounced search TextInput
 *   - an infinite-query FlatList (load-more on endReached + footer button)
 *   - standard empty / error / loading states
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, SearchX } from 'lucide-react-native';
import { useTheme, useThemeColor } from '@theme';
import { tokens } from '@theme/tokens';
import { useFieldContext } from '@/components/molecules/forms/contexts';
import { FormBase } from '@/components/molecules/forms/formbase';
import { Text } from '@/components/atoms/Text';
import { Input } from '@/components/atoms/Input';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { RemotePage } from '../services';
import type { Opt } from '../types';

/* ------------------------------------------------------------------ types */

export type RemoteSearchSelectProps<T extends Opt = Opt> = Readonly<{
  label: string;
  required?: boolean;
  placeholder?: string;
  /** Base query key; debounced search term is appended internally. */
  queryKey: readonly unknown[];
  fetchPage: (args: { search: string; page: number }) => Promise<RemotePage<T>>;
  onSelected?: (opt: T | undefined) => void;
  /** Label to show when the field is pre-filled (edit mode) but nothing picked yet. */
  initialLabel?: string;
}>;

/* ------------------------------------------------------------------ row */

type RowProps = Readonly<{
  item: Opt;
  selected: boolean;
  onPress: (opt: Opt) => void;
  brandColor: string;
}>;

function OptionRow({ item, selected, onPress, brandColor }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(item)}
      className={cn(
        'min-h-14 flex-row items-center justify-between rounded-xl px-4 py-3.5 active:bg-muted',
        selected && 'bg-brand/10',
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          'flex-1 pr-3 text-base',
          selected ? 'font-semibold text-brand' : 'text-foreground',
        )}
      >
        {item.label}
      </Text>
      {selected ? <Check size={20} strokeWidth={3} color={brandColor} /> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ footer */

type FooterProps = Readonly<{
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  brandColor: string;
}>;

function ListFooter({ isFetchingNextPage, hasNextPage, onLoadMore, brandColor }: FooterProps) {
  if (isFetchingNextPage) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={brandColor} />
      </View>
    );
  }
  if (hasNextPage) {
    return (
      <Pressable onPress={onLoadMore} className="items-center py-4">
        <Text className="text-sm font-medium text-brand">Load more</Text>
      </Pressable>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ empty */

type EmptyProps = Readonly<{
  search: string;
  onClearSearch: () => void;
  mutedFgColor: string;
}>;

function ListEmpty({ search, onClearSearch, mutedFgColor }: EmptyProps) {
  const term = search.trim();
  return (
    <View className="items-center px-6 py-8">
      <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-muted">
        <SearchX size={22} color={mutedFgColor} />
      </View>
      <Text className="text-center text-base font-semibold text-foreground">No matches found</Text>
      {term ? (
        <Text numberOfLines={2} className="mt-1 text-center text-sm text-muted-foreground">
          Nothing matches “{term}”. Check the spelling or try a shorter term.
        </Text>
      ) : (
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          No options available right now.
        </Text>
      )}
      {term ? (
        <Pressable onPress={onClearSearch} hitSlop={8} className="mt-3">
          <Text className="text-sm font-semibold text-brand">Clear search</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ list body */

type ListBodyProps<T extends Opt> = Readonly<{
  isLoading: boolean;
  isError: boolean;
  search: string;
  onClearSearch: () => void;
  items: T[];
  selectedValue: string | undefined;
  onSelectItem: (opt: T) => void;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  brandColor: string;
  mutedFgColor: string;
}>;

function ListBody<T extends Opt>({
  isLoading,
  isError,
  search,
  onClearSearch,
  items,
  selectedValue,
  onSelectItem,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  brandColor,
  mutedFgColor,
}: ListBodyProps<T>) {
  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <OptionRow
        item={item}
        selected={selectedValue === item.value}
        onPress={(opt) => onSelectItem(opt as T)}
        brandColor={brandColor}
      />
    ),
    [selectedValue, onSelectItem, brandColor],
  );

  const footer = useMemo(
    () => (
      <ListFooter
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        onLoadMore={onLoadMore}
        brandColor={brandColor}
      />
    ),
    [isFetchingNextPage, hasNextPage, onLoadMore, brandColor],
  );

  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator size="large" color={brandColor} />
        <Text className="mt-3 text-sm text-muted-foreground">Searching…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="items-center px-6 py-10">
        <Text className="mb-2 text-center text-sm text-destructive">Failed to load options.</Text>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList<T>
      data={items}
      keyExtractor={(o) => o.value}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      // Shrink to the capped sheet height so the list itself scrolls — without
      // this the FlatList takes full content height (clipped, not scrollable)
      // and onEndReached never fires.
      style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}
      ListEmptyComponent={
        <ListEmpty search={search} onClearSearch={onClearSearch} mutedFgColor={mutedFgColor} />
      }
      ListFooterComponent={footer}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onLoadMore();
      }}
      onEndReachedThreshold={0.4}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
    />
  );
}

/* ------------------------------------------------------------------ main */

export function RemoteSearchSelect<T extends Opt = Opt>({
  label,
  required,
  placeholder = 'Select…',
  queryKey,
  fetchPage,
  onSelected,
  initialLabel,
}: RemoteSearchSelectProps<T>) {
  const field = useFieldContext<string | undefined>();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const insets = useSafeAreaInsets();
  const brandColor = useThemeColor('--brand');
  const mutedFgColor = useThemeColor('--muted-foreground');

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(initialLabel);

  const debouncedSearch = useDebouncedValue(search, 300);
  // Debounce gap: query key hasn't changed yet, so keep showing "Searching…"
  // instead of flashing the previous term's results / empty state.
  const isDebouncing = search !== debouncedSearch;

  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [...queryKey, debouncedSearch],
      queryFn: ({ pageParam }) => fetchPage({ search: debouncedSearch, page: pageParam as number }),
      initialPageParam: 1,
      getNextPageParam: (last: RemotePage<T>) => (last.hasMore ? last.page + 1 : undefined),
      enabled: open,
    });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const handleOpen = useCallback(() => {
    Keyboard.dismiss();
    setSearch('');
    setOpen(true);
  }, []);

  const handleClearSearch = useCallback(() => setSearch(''), []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  const handleSelectItem = useCallback(
    (opt: T) => {
      field.handleChange(opt.value);
      field.handleBlur();
      setSelectedLabel(opt.label);
      onSelected?.(opt);
      setOpen(false);
      setSearch('');
    },
    [field, onSelected],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(() => {});
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const triggerLabel = selectedLabel ?? placeholder;
  const triggerHasValue = Boolean(selectedLabel);

  return (
    <FormBase label={label} required={required}>
      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        className={cn(
          'h-12 flex-row items-center justify-between rounded-lg border bg-background px-3',
          hasError ? 'border-destructive' : 'border-border',
        )}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'flex-1 text-sm',
            triggerHasValue ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {triggerLabel}
        </Text>
        <ChevronDown size={18} color={mutedFgColor} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={handleClose}>
        {/* Android already resizes the window (manifest adjustResize) — adding a
            behavior there double-shifts the sheet, so only iOS needs padding. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/50" style={palette}>
            <Pressable className="flex-1" onPress={handleClose} accessibilityLabel="Dismiss" />
            <View
              className="max-h-[75%] rounded-t-3xl bg-background"
              style={{ paddingBottom: 12 + insets.bottom }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
                <Text className="text-base font-semibold text-foreground">{label}</Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <Text className="text-sm font-medium text-brand">Done</Text>
                </Pressable>
              </View>

              {/* Search input */}
              <View className="mx-4 mb-2 mt-3 flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
                <Search size={18} color={mutedFgColor} />
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search…"
                  autoCorrect={false}
                  autoCapitalize="none"
                  className="flex-1 border-0 bg-transparent px-0 text-[16px]"
                />
              </View>

              {/* List */}
              <ListBody<T>
                isLoading={isLoading || isDebouncing}
                isError={isError}
                search={debouncedSearch}
                onClearSearch={handleClearSearch}
                items={items}
                selectedValue={field.state.value}
                onSelectItem={handleSelectItem}
                onRetry={() => refetch().catch(() => {})}
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={handleLoadMore}
                brandColor={brandColor}
                mutedFgColor={mutedFgColor}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </FormBase>
  );
}
