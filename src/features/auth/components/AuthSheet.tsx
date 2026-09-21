import { type ReactNode, useRef } from 'react';
import { Animated, Dimensions, ImageBackground, PanResponder, Pressable, View } from 'react-native';
import { vars } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Text } from '@/components/atoms/Text';
import { tokens } from '@theme/tokens';

const BG_IMAGE = require('../../../../assets/images/onboarding-bg.png');
const lightVars = vars(tokens.light);
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 140;

interface AuthSheetProps {
  children: ReactNode;
  onSkip?: () => void;
}

export function AuthSheet({ children, onSkip }: Readonly<AuthSheetProps>) {
  const { bottom } = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.8) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  function dismiss() {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 280,
      useNativeDriver: true,
    }).start(() => onSkip?.());
  }

  return (
    <ImageBackground source={BG_IMAGE} className="flex-1 bg-[#0a1628]" resizeMode="cover">
      <View className="absolute inset-0 bg-black/30" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          {/* Drag handle */}
          <View
            className="rounded-t-3xl bg-background px-6 pt-3"
            style={lightVars}
            {...panResponder.panHandlers}
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-gray-300" />
          </View>

          {/* Content */}
          <View
            className="bg-background px-6 pt-2"
            style={[lightVars, { paddingBottom: bottom + 24 }]}
            {...panResponder.panHandlers}
          >
            {/* Skip */}
            <View className="mb-3 items-end">
              <Pressable hitSlop={12} onPress={dismiss}>
                <Text className="text-sm text-muted-foreground">Skip</Text>
              </Pressable>
            </View>

            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
