import { Pressable } from 'react-native';
import { Icon } from '@/components/atoms/Icon';

/**
 * Stop/resume a carousel's auto-advance. Sits bottom-left so it clears the
 * centred dots and any bottom-right media control.
 */
export function CarouselAutoplayToggle({
  paused,
  onToggle,
}: Readonly<{ paused: boolean; onToggle: () => void }>) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Resume slideshow' : 'Pause slideshow'}
      hitSlop={10}
      style={({ pressed }) => ({
        position: 'absolute',
        left: 10,
        bottom: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={paused ? 'Play' : 'Pause'} size={13} color="#FFFFFF" />
    </Pressable>
  );
}
