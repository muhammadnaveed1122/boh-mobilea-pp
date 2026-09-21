import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

type Props = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: Readonly<Props>) {
  const ref = useRef<LottieView>(null);

  useEffect(() => {
    ref.current?.play();
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <LottieView
        ref={ref}
        source={require('../../assets/splash.json')}
        autoPlay
        loop={false}
        resizeMode="cover"
        onAnimationFinish={onFinish}
        style={styles.lottie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
