import type { ImageSourcePropType } from 'react-native';
import { Image, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { ProjectOverviewSection } from '../../types';
import { stripHtml } from '../../utils/html';
import { isPersistedMediaUrl } from '../../utils/media';
import { SectionWrap } from './SectionWrap';

interface Props {
  overview: ProjectOverviewSection | null;
}

// Local fallback images, shown when the API supplies no overview media (matches web).
const DEFAULT_OVERVIEW_IMAGES: readonly ImageSourcePropType[] = [
  require('../../../../../assets/images/overview/building-detail-1.png'),
  require('../../../../../assets/images/overview/building-detail-2.png'),
];

export function OverviewSection({ overview }: Readonly<Props>) {
  if (!overview) return null;

  const blocks = overview.blocks ?? [];
  const texts = blocks.map((b) => stripHtml(b.text)).filter(Boolean);
  const apiImages = blocks
    .map((b) => b.image?.mediaUrl)
    .filter((url): url is string => isPersistedMediaUrl(url));

  if (!overview.mainTitle && texts.length === 0) return null;

  // Pair text + image like web: text0, image1, text1 (bold), image2, remaining texts.
  const image1: ImageSourcePropType | undefined = apiImages[0]
    ? { uri: apiImages[0] }
    : DEFAULT_OVERVIEW_IMAGES[0];
  const image2: ImageSourcePropType | undefined = apiImages[1]
    ? { uri: apiImages[1] }
    : DEFAULT_OVERVIEW_IMAGES[1];

  return (
    <SectionWrap>
      <Text className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Overview
      </Text>
      {overview.mainTitle ? (
        <Text className="mt-2 text-2xl font-bold leading-8 text-foreground">
          {overview.mainTitle}
        </Text>
      ) : null}

      <View className="mt-4 gap-4">
        {texts[0] ? (
          <Text className="text-[15px] leading-6 text-muted-foreground">{texts[0]}</Text>
        ) : null}

        {image1 ? (
          <Image source={image1} className="h-52 w-full rounded-2xl bg-muted" resizeMode="cover" />
        ) : null}

        {texts[1] ? (
          <Text className="text-[15px] font-semibold leading-6 text-foreground">{texts[1]}</Text>
        ) : null}

        {image2 ? (
          <Image source={image2} className="h-64 w-full rounded-2xl bg-muted" resizeMode="cover" />
        ) : null}

        {texts.slice(2).map((t, i) => (
          <Text
            key={`overview-extra-${String(i)}`}
            className="text-[15px] font-semibold leading-6 text-foreground"
          >
            {t}
          </Text>
        ))}
      </View>
    </SectionWrap>
  );
}
