/**
 * Full emoji tray. Opens when the user taps `+` on the quick reaction
 * picker. Categorized via top tabs; flat 8-wide grid per category. Selecting
 * an emoji closes the sheet and fires `onPick`. The list is hard-coded so
 * we keep the bundle slim and avoid a runtime emoji dependency.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

type Category = 'Smileys' | 'Hands' | 'Hearts' | 'Symbols' | 'Objects';

// Hard-coded emoji catalog. Order matters within a category — most common
// first. Kept compact (~60 each) to balance coverage vs scroll fatigue.
const EMOJI_CATEGORIES: Record<Category, string[]> = {
  Smileys: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '🤣',
    '😂',
    '🙂',
    '🙃',
    '😉',
    '😊',
    '😇',
    '🥰',
    '😍',
    '🤩',
    '😘',
    '😗',
    '😚',
    '😙',
    '😋',
    '😛',
    '😜',
    '🤪',
    '😝',
    '🤑',
    '🤗',
    '🤭',
    '🤫',
    '🤔',
    '🤐',
    '🤨',
    '😐',
    '😑',
    '😶',
    '😏',
    '😒',
    '🙄',
    '😬',
    '🤥',
    '😌',
    '😔',
    '😪',
    '🤤',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '🥵',
    '🥶',
    '🥴',
    '😵',
    '🤯',
    '🤠',
    '🥳',
    '😎',
    '🤓',
    '🥲',
    '😢',
    '😭',
    '😤',
    '😠',
    '😡',
    '🤬',
  ],
  Hands: [
    '👍',
    '👎',
    '👌',
    '🤌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '👇',
    '☝️',
    '✋',
    '🤚',
    '🖐️',
    '🖖',
    '👋',
    '🤝',
    '🙏',
    '✍️',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🦶',
    '👂',
    '👃',
    '🧠',
    '🫀',
    '🫁',
    '🦷',
    '👀',
    '👁️',
    '👅',
    '👄',
    '💋',
    '👶',
    '🧒',
    '👦',
    '👧',
  ],
  Hearts: [
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '♥️',
    '💌',
    '💋',
    '🌹',
    '🌺',
    '🌸',
    '🌷',
    '🌻',
  ],
  Symbols: [
    '✅',
    '❌',
    '⭐',
    '🌟',
    '💯',
    '🔥',
    '💥',
    '✨',
    '🎉',
    '🎊',
    '🎁',
    '🏆',
    '🥇',
    '🥈',
    '🥉',
    '🏅',
    '🎯',
    '🔔',
    '🔕',
    '📢',
    '📣',
    '💤',
    '💢',
    '💦',
    '💨',
    '🕳️',
    '💣',
    '🛡️',
    '⚡',
    '☀️',
    '🌙',
    '⭐',
    '☁️',
    '🌧️',
    '⛈️',
    '❄️',
    '☔',
    '⚠️',
    '🚫',
    '✔️',
    '❓',
    '❗',
    '‼️',
    '⁉️',
    '〽️',
    '♻️',
    '✳️',
    '❇️',
  ],
  Objects: [
    '👏',
    '🙌',
    '🤝',
    '🫶',
    '☕',
    '🍕',
    '🍔',
    '🌮',
    '🍿',
    '🍩',
    '🍪',
    '🎂',
    '🍰',
    '🧁',
    '🍺',
    '🍻',
    '🥂',
    '🍷',
    '🍸',
    '🍹',
    '⚽',
    '🏀',
    '🏈',
    '⚾',
    '🎾',
    '🎱',
    '🏓',
    '🏸',
    '🏒',
    '🏑',
    '🥊',
    '🥋',
    '🎮',
    '🎲',
    '🎰',
    '🧩',
    '📱',
    '💻',
    '⌨️',
    '🖱️',
    '🖨️',
    '📷',
    '🎥',
    '📺',
    '🎵',
    '🎶',
    '🎤',
    '🎧',
    '🎸',
    '🥁',
    '📚',
    '✏️',
    '🖊️',
    '🖋️',
    '📝',
    '📅',
    '📆',
    '📌',
    '📎',
    '✂️',
  ],
};

const CATEGORIES: Category[] = ['Smileys', 'Hands', 'Hearts', 'Symbols', 'Objects'];
const SNAP_POINTS = ['50%', '85%'] as const;
const NUM_COLUMNS = 8;

export interface EmojiSheetHandle {
  open: () => void;
  close: () => void;
}

interface EmojiSheetProps {
  onPick: (emoji: string) => void;
}

export const EmojiSheet = forwardRef<EmojiSheetHandle, EmojiSheetProps>(function EmojiSheet(
  { onPick },
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const [active, setActive] = useState<Category>('Smileys');
  const accent = useThemeColor('--primary');
  const card = useThemeColor('--card');
  const muted = useThemeColor('--muted-foreground');

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  const data = useMemo(() => EMOJI_CATEGORIES[active], [active]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS as unknown as (string | number)[]}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: card }}
      handleIndicatorStyle={{ backgroundColor: muted }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-around border-b border-border px-2 py-2">
          {CATEGORIES.map((cat) => {
            const isActive = active === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActive(cat)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                className={cn(
                  'rounded-full px-3 py-1.5 active:opacity-70',
                  isActive ? 'bg-secondary' : '',
                )}
              >
                <Text className="text-xs font-medium" style={{ color: isActive ? accent : muted }}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <BottomSheetFlatList
          data={data}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onPick(item);
                sheetRef.current?.close();
              }}
              accessibilityRole="button"
              accessibilityLabel={`React with ${item}`}
              className="h-11 flex-1 items-center justify-center active:opacity-60"
            >
              <Text className="text-[26px]">{item}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 24 }}
        />
      </BottomSheetView>
    </BottomSheet>
  );
});
