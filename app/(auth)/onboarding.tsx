import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  ImageBackground,
  Pressable,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/store/onboarding.store';

// Replace assets/images/onboarding-bg.png with your actual building photo
const BG_IMAGE = require('../../assets/images/onboarding-bg.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Find Your Home\nIn The UAE',
    subtitle:
      'Explore over 20,000 homes and find exactly what you are looking for with the help of our trusted agents.',
  },
  {
    id: '2',
    title: "Invest in Dubai's\nFuture",
    subtitle:
      "Discover high-return investment opportunities in one of the world's fastest-growing real estate markets.",
  },
  {
    id: '3',
    title: 'Own Your Slice of\nLuxury in Dubai',
    subtitle: "Find Homes You'll Love with a Smarter Property Search.",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const markOnboardingSeen = useOnboardingStore((s) => s.markOnboardingSeen);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleGetStarted = async () => {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  return (
    <ImageBackground source={BG_IMAGE} className="flex-1 bg-[#0a1628]" resizeMode="cover">
      {/* Dark overlay for readability */}
      <View className="absolute inset-0 bg-black/30" />

      {/* Logo */}
      <View className="items-center pt-4" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-3xl font-bold tracking-widest text-white">RHK</Text>
        <Text className="mt-0.5 text-xs font-medium tracking-[6px] text-white">PROPERTIES</Text>
      </View>

      {/* Slides — title + subtitle slide with swipe */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }} className="flex-1 justify-end px-6 pb-6">
            <Text className="mb-3 text-center text-3xl font-bold leading-tight text-white">
              {item.title}
            </Text>
            <Text className="text-center text-sm leading-relaxed text-white/80">
              {item.subtitle}
            </Text>
          </View>
        )}
        className="flex-1"
      />

      {/* Bottom — dots + button */}
      <View className="px-6" style={{ paddingBottom: insets.bottom + 24 }}>
        {/* Pagination dots */}
        <View className="mb-8 flex-row justify-center gap-2">
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.id}
              onPress={() => flatListRef.current?.scrollToIndex({ index: i, animated: true })}
              hitSlop={8}
            >
              <View
                className={`h-2 rounded-full ${i === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
              />
            </Pressable>
          ))}
        </View>

        {/* CTA button */}
        <Pressable
          onPress={handleGetStarted}
          className="items-center rounded-xl bg-[#2d5be3] py-4 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">{"Let's Go"}</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}
