import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

function initialsFrom(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export interface GradientAvatarProps {
  name?: string | null;
  size?: number;
}

export function GradientAvatar({ name, size = 96 }: Readonly<GradientAvatarProps>) {
  const initials = initialsFrom(name);
  const fontSize = Math.round(size * 0.36);

  return (
    <LinearGradient
      colors={['#6366F1', '#3B82F6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      {initials ? (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontSize,
            // Explicit line height + no font padding so the bold glyph centres in
            // the circle instead of being clipped top/bottom (Android default line
            // box is shorter than a 700-weight cap height at this size).
            lineHeight: Math.round(fontSize * 1.3),
            includeFontPadding: false,
            textAlign: 'center',
            textAlignVertical: 'center',
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: 1,
            paddingLeft: 1, // balance the trailing letter-spacing so it reads centred
          }}
        >
          {initials}
        </Text>
      ) : (
        <View>
          <Icon name="User" size={Math.round(size * 0.5)} color="#FFFFFF" />
        </View>
      )}
    </LinearGradient>
  );
}
