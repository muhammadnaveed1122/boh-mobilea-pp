/**
 * Select — bottom-sheet backed dropdown.
 *
 * Replaces the old `@rn-primitives/select` popover (desktop idiom, fixed
 * width, mouse-era scroll arrows) with a native bottom sheet:
 *
 * - slides up from the bottom, full-width, large thumb-friendly rows
 * - drag-down / backdrop-tap to dismiss
 * - auto search filter when the option list is long
 * - selected row highlighted (bg + bold + check), not just a tiny tick
 * - chevron rotates on open, haptic feedback on open + select
 * - empty / loading states
 *
 * Public API is unchanged so existing consumers keep working:
 *
 *   <Select value={opt} onValueChange={(o) => …} disabled>
 *     <SelectTrigger hasError>
 *       <SelectValue placeholder="Select…" className="…" />
 *     </SelectTrigger>
 *     <SelectContent>
 *       {options.map((o) => <SelectItem key={o.value} value={o.value} label={o.label} group?={o.group} />)}
 *     </SelectContent>
 *   </Select>
 *
 * `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`,
 * `SelectScrollDownButton` are kept as exports for backward compatibility.
 * `SelectGroup` still groups its `SelectItem` children; the rest are inert
 * (the bottom sheet has its own native scroll, no scroll buttons).
 */

import * as React from 'react';
import { Keyboard, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, Search } from 'lucide-react-native';
import { useThemeColor } from '@theme';
import { cn } from '@/lib/utils';
import { Text } from './Text';

export type SelectOption = { value: string; label: string } | undefined;

type OptionDescriptor = { value: string; label: string; disabled?: boolean; group?: string };

const SHEET_MAX_HEIGHT_RATIO = 0.78;
const SEARCH_THRESHOLD = 8;

function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function selectionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/* ------------------------------------------------------------------ context */

type SelectContextValue = {
  value: SelectOption;
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (opt: OptionDescriptor) => void;
  present: () => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select.* must be used inside <Select>');
  return ctx;
}

/* --------------------------------------------------------------------- root */

type SelectProps = {
  value?: SelectOption;
  onValueChange?: (opt: SelectOption) => void;
  disabled?: boolean;
  children: React.ReactNode;
};

type ModalRef = React.ComponentRef<typeof BottomSheetModal>;

const ModalRefContext = React.createContext<React.RefObject<ModalRef | null> | null>(null);

function Select({ value, onValueChange, disabled = false, children }: Readonly<SelectProps>) {
  const modalRef = React.useRef<ModalRef | null>(null);
  const [open, setOpen] = React.useState(false);

  const present = React.useCallback(() => {
    if (disabled) return;
    Keyboard.dismiss();
    lightHaptic();
    modalRef.current?.present();
  }, [disabled]);

  const onSelect = React.useCallback(
    (opt: OptionDescriptor) => {
      selectionHaptic();
      onValueChange?.({ value: opt.value, label: opt.label });
      modalRef.current?.dismiss();
    },
    [onValueChange],
  );

  const ctx = React.useMemo<SelectContextValue>(
    () => ({ value, disabled, open, setOpen, onSelect, present }),
    [value, disabled, open, onSelect, present],
  );

  return (
    <ModalRefContext.Provider value={modalRef}>
      <SelectContext.Provider value={ctx}>{children}</SelectContext.Provider>
    </ModalRefContext.Provider>
  );
}

/* ------------------------------------------------------------------ trigger */

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  React.ComponentPropsWithoutRef<typeof Pressable> & {
    hasError?: boolean;
    children?: React.ReactNode;
  }
>(({ className, hasError, children, ...props }, ref) => {
  const { disabled, present, open } = useSelectContext();
  const chevronColor = useThemeColor('--muted-foreground');
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, { duration: 180 });
  }, [open, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={present}
      className={cn(
        'h-11 flex-row items-center justify-between rounded-lg border border-input bg-background px-4',
        hasError && 'border-destructive',
        disabled && 'opacity-50',
        className,
      )}
      style={({ pressed }) => (pressed && !disabled ? { opacity: 0.85 } : undefined)}
      {...props}
    >
      <View className="flex-1 flex-row items-center pr-2">{children}</View>
      <Animated.View style={chevronStyle}>
        <ChevronDown size={18} aria-hidden color={chevronColor} />
      </Animated.View>
    </Pressable>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

/* -------------------------------------------------------------------- value */

const SelectValue = React.forwardRef<
  React.ComponentRef<typeof Text>,
  { className?: string; placeholder?: string }
>(({ className, placeholder }, ref) => {
  const { value } = useSelectContext();
  const label = value?.label;
  return (
    <Text
      ref={ref}
      numberOfLines={1}
      className={cn('text-base', label ? 'text-foreground' : 'text-muted-foreground', className)}
    >
      {label ?? placeholder ?? ''}
    </Text>
  );
});
SelectValue.displayName = 'SelectValue';

/* -------------------------------------------------------- children → options */

function collectOptions(children: React.ReactNode, acc: OptionDescriptor[]): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type as { __SELECT_ITEM__?: boolean; __SELECT_GROUP__?: boolean };
    if (type?.__SELECT_ITEM__) {
      const p = child.props as OptionDescriptor;
      acc.push({ value: p.value, label: p.label, disabled: p.disabled, group: p.group });
    } else if (type?.__SELECT_GROUP__) {
      collectOptions((child.props as { children?: React.ReactNode }).children, acc);
    }
  });
}

/* ------------------------------------------------------------------ content */

type SelectContentProps = {
  children: React.ReactNode;
  /** Optional sheet header title. */
  title?: string;
  /** Show a loading state instead of the list. */
  loading?: boolean;
  /** Force the search field on/off. Defaults to auto (on when > 8 options). */
  searchable?: boolean;
  /** Kept for API compatibility with the old popover; unused. */
  portalHost?: string;
};

function SelectContent({
  children,
  title,
  loading = false,
  searchable,
}: Readonly<SelectContentProps>) {
  const modalRef = React.useContext(ModalRefContext);
  const { value, onSelect, setOpen } = useSelectContext();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = React.useState('');

  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const popoverFg = useThemeColor('--popover-foreground');
  const brand = useThemeColor('--brand');

  const options = React.useMemo(() => {
    const acc: OptionDescriptor[] = [];
    collectOptions(children, acc);
    return acc;
  }, [children]);

  const showSearch = (searchable ?? options.length > SEARCH_THRESHOLD) && !loading;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  const handleChange = React.useCallback(
    (index: number) => {
      const isOpen = index >= 0;
      setOpen(isOpen);
      if (!isOpen) setQuery('');
    },
    [setOpen],
  );

  // Options must be pre-grouped (all items of a group consecutive);
  // headers render at group boundaries on the filtered list.
  const renderGroupHeader = React.useCallback(
    (groupName: string) => (
      <View className="px-4 pb-1 pt-3">
        <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {groupName}
        </Text>
      </View>
    ),
    [],
  );

  const renderItem = React.useCallback(
    ({ item, index }: { item: OptionDescriptor; index: number }) => {
      const selected = value?.value === item.value;
      const prevGroup = index > 0 ? filtered[index - 1]?.group : undefined;
      const showHeader = Boolean(item.group) && item.group !== prevGroup;
      return (
        <>
          {showHeader ? renderGroupHeader(item.group as string) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: item.disabled }}
            disabled={item.disabled}
            onPress={() => onSelect(item)}
            className={cn(
              'min-h-14 flex-row items-center justify-between rounded-xl px-4 py-3.5 active:bg-muted',
              selected && 'bg-brand/10',
              item.disabled && 'opacity-40',
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                'flex-1 pr-3 text-base',
                selected ? 'font-semibold text-brand' : 'text-popover-foreground',
              )}
            >
              {item.label}
            </Text>
            {selected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
          </Pressable>
        </>
      );
    },
    [value, onSelect, brand, filtered, renderGroupHeader],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose
      enableDynamicSizing
      maxDynamicContentSize={SHEET_MAX_HEIGHT_RATIO * windowHeight}
      onChange={handleChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {title ? (
        <Text className="px-4 pb-1 pt-1 text-center text-base font-semibold text-popover-foreground">
          {title}
        </Text>
      ) : null}

      {showSearch ? (
        <View className="mx-4 mb-2 mt-1 flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
          <Search size={18} color={mutedFg} />
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={mutedFg}
            autoCorrect={false}
            style={{ flex: 1, height: 44, fontSize: 16, color: popoverFg }}
          />
        </View>
      ) : null}

      {loading ? (
        <View className="items-center justify-center py-12">
          <Text className="text-sm text-muted-foreground">Loading…</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingBottom: insets.bottom + 12,
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Text className="text-sm text-muted-foreground">No results</Text>
            </View>
          }
        />
      )}
    </BottomSheetModal>
  );
}

/* --------------------------------------------------------- item / grouping */

type SelectItemProps = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
};

/** Pure descriptor — never rendered directly; read by `SelectContent`. */
function SelectItem(_: Readonly<SelectItemProps>): React.ReactElement | null {
  return null;
}
(SelectItem as unknown as { __SELECT_ITEM__: boolean }).__SELECT_ITEM__ = true;

function SelectGroup({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
(SelectGroup as unknown as { __SELECT_GROUP__: boolean }).__SELECT_GROUP__ = true;

/* ----------------------------------------- backward-compat inert exports */

const SelectLabel = (_: Readonly<{ children?: React.ReactNode }>): null => null;
const SelectSeparator = (): null => null;
const SelectScrollUpButton = (): null => null;
const SelectScrollDownButton = (): null => null;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
