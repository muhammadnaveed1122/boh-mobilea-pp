// src/features/favorites/components/FavoriteHeartButton.tsx
import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/utils';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
import { useThemeColor } from '@theme';
import { useFavoriteSnapshot } from '../hooks/use-favorite-snapshot';
import { useToggleFavorite } from '../hooks/use-toggle-favorite';
import { FavoriteResourceKind } from '../types';

interface Props {
  kind: FavoriteResourceKind;
  id: string;
  size?: number;
  className?: string;
}

export function FavoriteHeartButton({ kind, id, size = 18, className }: Readonly<Props>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isPortalUser, isCustomer } = useRole();
  const openAuthPrompt = useAuthPromptStore((s) => s.open);
  const { snapshot } = useFavoriteSnapshot();
  const toggle = useToggleFavorite();
  const destructive = useThemeColor('--destructive');
  const [override, setOverride] = useState<boolean | null>(null);
  const scale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Authed users who are not the end-user persona (client signups or portal
  // customers) cannot favourite — hide entirely.
  if (isAuthenticated && !isPortalUser && !isCustomer) return null;

  const set = kind === FavoriteResourceKind.PROJECT ? snapshot.projectIds : snapshot.listingIds;
  const isFavorite = override ?? set.has(id);

  function handlePress(): void {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    const next = !isFavorite;
    setOverride(next);
    scale.value = withSequence(
      withSpring(1.3, { damping: 5, stiffness: 320 }),
      withSpring(1, { damping: 8, stiffness: 260 }),
    );
    toggle.mutate({ kind, id, isFavorite }, { onSettled: () => setOverride(null) });
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={toggle.isPending}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
      className={cn(
        'h-10 w-10 items-center justify-center rounded-full active:opacity-70',
        className,
      )}
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
    >
      <Animated.View style={heartStyle}>
        <Icon
          name="Heart"
          size={size}
          color={isFavorite ? destructive : '#fff'}
          fill={isFavorite ? destructive : 'transparent'}
        />
      </Animated.View>
    </Pressable>
  );
}
