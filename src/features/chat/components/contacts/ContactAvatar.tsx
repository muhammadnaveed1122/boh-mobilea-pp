import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import { cn } from '@/lib/utils';

import { avatarColor } from '../../hooks/use-contact-names';

interface Props {
  name: string;
  /** Seed for the colour hash — pass the phone so a rename keeps the colour. */
  seed?: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic colour-coded avatar. The palette is fixed (not theme-derived)
 * so a contact keeps the same colour across light/dark and across sessions.
 */
export function ContactAvatar({ name, seed, size = 44, className }: Readonly<Props>) {
  const background = avatarColor(seed ?? name);
  return (
    <View
      accessible
      accessibilityLabel={`Avatar for ${name}`}
      className={cn('items-center justify-center rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: background }}
    >
      <Text className="font-semibold text-white" style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
