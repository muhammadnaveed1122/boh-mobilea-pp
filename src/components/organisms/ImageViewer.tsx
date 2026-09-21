import { useCallback } from 'react';
import { Modal, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Vertical drag (while un-zoomed) past this closes the viewer. */
const DISMISS_DISTANCE = 120;
const SNAP = { duration: 160 } as const;

interface Props {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

/** Full-screen image viewer: pinch, pan, double-tap zoom, swipe-to-dismiss. */
export function ImageViewer({ visible, uri, onClose }: Readonly<Props>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  const close = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    backdropOpacity.value = 1;
    onClose();
  }, [backdropOpacity, onClose, savedScale, savedX, savedY, scale, translateX, translateY]);

  /** Snap scale/translation back into bounds once a pinch or pan ends. */
  const clamp = useCallback(() => {
    'worklet';
    const next = Math.min(Math.max(scale.value, 1), MAX_SCALE);
    scale.value = withTiming(next, SNAP);
    savedScale.value = next;
    const maxX = ((next - 1) * width) / 2;
    const maxY = ((next - 1) * height) / 2;
    const nx = Math.min(Math.max(translateX.value, -maxX), maxX);
    const ny = Math.min(Math.max(translateY.value, -maxY), maxY);
    translateX.value = withTiming(nx, SNAP);
    translateY.value = withTiming(ny, SNAP);
    savedX.value = nx;
    savedY.value = ny;
  }, [height, savedScale, savedX, savedY, scale, translateX, translateY, width]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.6), MAX_SCALE);
    })
    .onEnd(clamp);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
      // Un-zoomed: a vertical drag fades the backdrop (swipe to dismiss).
      if (savedScale.value <= 1) {
        backdropOpacity.value = Math.max(
          1 - Math.abs(e.translationY) / (DISMISS_DISTANCE * 2),
          0.3,
        );
      }
    })
    .onEnd((e) => {
      if (savedScale.value <= 1 && Math.abs(e.translationY) > DISMISS_DISTANCE) {
        scheduleOnRN(close);
        return;
      }
      backdropOpacity.value = withTiming(1, SNAP);
      clamp();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd(() => {
      const zoomed = savedScale.value > 1;
      const next = zoomed ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next, { duration: 200 });
      savedScale.value = next;
      if (zoomed) {
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(260)
    .onEnd(() => {
      if (savedScale.value <= 1) scheduleOnRN(close);
    });

  const gesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTap, singleTap),
    Gesture.Simultaneous(pinch, pan),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={close}
    >
      <StatusBar barStyle="light-content" />
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.stage}>
            <Animated.Image
              source={{ uri }}
              style={[{ width, height }, imageStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
        {/* Top bar pinned over the image — close sits in the top-right corner. */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            hitSlop={16}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="X" size={26} color="#fff" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
    // Must sit above the full-screen gesture layer on both platforms.
    zIndex: 10,
    elevation: 10,
  },
  closeBtn: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
