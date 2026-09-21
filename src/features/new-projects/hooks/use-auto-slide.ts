import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FlatList, ViewToken } from 'react-native';

interface UseAutoSlideArgs<T> {
  count: number;
  width: number;
  intervalMs: number;
  listRef: RefObject<FlatList<T> | null>;
  /**
   * Set false to stop auto-advancing — used once the user swipes manually, or
   * when a slide owns playback (video) and must not be pulled away.
   * Defaults to true so existing callers keep their behaviour.
   */
  enabled?: boolean;
}

export function useAutoSlide<T>({
  count,
  width,
  intervalMs,
  listRef,
  enabled = true,
}: UseAutoSlideArgs<T>) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || count <= 1 || width === 0) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % count;
        listRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, width, intervalMs, listRef, enabled]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return { index, onViewableItemsChanged, viewabilityConfig };
}
