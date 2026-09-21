import { LinearGradient } from 'expo-linear-gradient';
import { CarouselIndicator } from '@/components/molecules/CarouselIndicator';
import { useProjectCard } from './ProjectCardContext';

interface Props {
  activeIndex: number;
}

export function CarouselDots({ activeIndex }: Readonly<Props>) {
  const { images } = useProjectCard();
  if (images.length <= 1) return null;
  return (
    <>
      {/* Contrast floor for the indicator — white pips disappear over a bright sky. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 }}
      />
      <CarouselIndicator count={images.length} activeIndex={activeIndex} />
    </>
  );
}
