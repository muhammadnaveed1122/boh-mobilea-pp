import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SectionWrap } from '@/features/new-projects/components/detail/SectionWrap';
import { stripHtml } from '@/features/new-projects/utils/html';
import type { PropertyDetail } from '../../types';

export function PropertyAbout({ about }: Readonly<{ about: PropertyDetail['about'] }>) {
  const [expanded, setExpanded] = useState(false);

  if (!about) return null;
  const additional = stripHtml(about.additionalDescription);
  const hasContent =
    about.mainTitle || about.texts.length > 0 || about.media.length > 0 || additional;
  if (!hasContent) return null;

  return (
    <SectionWrap>
      <Text className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Overview
      </Text>
      {about.mainTitle ? (
        <Text className="mt-2 text-2xl font-bold leading-8 text-foreground">{about.mainTitle}</Text>
      ) : null}

      <View className="mt-4 gap-4">
        {about.texts[0] ? (
          <Text className="text-[15px] leading-6 text-muted-foreground">{about.texts[0]}</Text>
        ) : null}
        {about.media[0] ? (
          <Image
            source={{ uri: about.media[0].url }}
            className="h-52 w-full rounded-2xl bg-muted"
            resizeMode="cover"
          />
        ) : null}
        {about.texts[1] ? (
          <Text className="text-[15px] font-semibold leading-6 text-foreground">
            {about.texts[1]}
          </Text>
        ) : null}
        {about.media[1] ? (
          <Image
            source={{ uri: about.media[1].url }}
            className="h-64 w-full rounded-2xl bg-muted"
            resizeMode="cover"
          />
        ) : null}

        {additional ? (
          <View>
            <Text
              className="text-[15px] leading-6 text-muted-foreground"
              numberOfLines={expanded ? undefined : 4}
            >
              {additional}
            </Text>
            <Pressable onPress={() => setExpanded((v) => !v)} className="mt-2 active:opacity-70">
              <Text className="text-sm font-semibold text-brand">
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SectionWrap>
  );
}
