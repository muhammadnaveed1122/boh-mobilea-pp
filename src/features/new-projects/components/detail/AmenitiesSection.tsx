import { useCallback, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { FlatList, Image, Modal, Pressable, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { resolveAmenityIcon, resolveAmenityImages } from '@/lib/amenities';
import type { ProjectAmenitiesSection, ProjectAmenityItem } from '../../types';
import { isPersistedMediaUrl } from '../../utils/media';
import { SectionWrap } from './SectionWrap';

interface Props {
  amenities: ProjectAmenitiesSection | null;
}

interface PreviewSlide {
  key: string;
  source: ImageSourcePropType;
}

/** Local default images for an amenity, keyed off its name/icon/slug. */
function defaultImagesFor(a: ProjectAmenityItem): readonly ImageSourcePropType[] {
  return resolveAmenityImages({ label: a.name, icon: a.icon ?? '', slug: a.slug });
}

export function AmenitiesSection({ amenities }: Readonly<Props>) {
  const items = useMemo(
    () => (amenities?.items ?? []).filter((a) => a.isVisible !== false),
    [amenities],
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [width, setWidth] = useState(0);

  const active = items.find((a) => a.id === previewId);

  // API media when present, otherwise fall back to local default images.
  const activeSlides = useMemo<PreviewSlide[]>(() => {
    if (!active) return [];
    const apiMedia = (active.media ?? []).filter((m) => isPersistedMediaUrl(m.mediaUrl));
    if (apiMedia.length > 0) {
      return apiMedia.map((m) => ({ key: m.id, source: { uri: m.mediaUrl } }));
    }
    return defaultImagesFor(active).map((source, i) => ({ key: `default-${String(i)}`, source }));
  }, [active]);

  const renderPreviewItem = useCallback(
    ({ item }: { item: PreviewSlide }) => (
      <Image source={item.source} style={{ width, height: 224 }} resizeMode="cover" />
    ),
    [width],
  );

  const getPreviewLayout = useCallback(
    (_: ArrayLike<unknown> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  if (!amenities || items.length === 0) return null;

  return (
    <SectionWrap title={amenities.title ?? 'Amenities'} tagline={amenities.tagline}>
      <View className="-m-1 flex-row flex-wrap">
        {items.map((a) => {
          const apiCover = a.media?.find((m) => isPersistedMediaUrl(m.mediaUrl))?.mediaUrl;
          const coverSource: ImageSourcePropType | undefined = apiCover
            ? { uri: apiCover }
            : defaultImagesFor(a)[0];
          return (
            <View key={a.id} className="w-1/2 p-1">
              <Pressable
                onPress={() => setPreviewId(a.id)}
                className="overflow-hidden rounded-2xl bg-muted active:opacity-80"
                style={{ aspectRatio: 1 }}
              >
                {coverSource ? (
                  <Image
                    source={coverSource}
                    className="absolute inset-0 h-full w-full"
                    resizeMode="cover"
                  />
                ) : null}
                <View
                  pointerEvents="none"
                  className="absolute inset-x-0 bottom-0 h-2/3"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                />
                <View className="absolute inset-x-3 bottom-3 flex-row items-center gap-1.5">
                  <Icon
                    name={resolveAmenityIcon({ icon: a.icon, slug: a.slug, label: a.name })}
                    size={13}
                    color="#fff"
                  />
                  <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={2}>
                    {a.name}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Modal
        visible={previewId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewId(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl bg-card p-5">
            <View className="mb-3 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold text-foreground">{active?.name}</Text>
                {active?.description ? (
                  <Text className="mt-1 text-sm text-muted-foreground">{active.description}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setPreviewId(null)}
                className="h-9 w-9 items-center justify-center rounded-full bg-muted"
                accessibilityLabel="Close"
              >
                <Icon name="X" size={18} />
              </Pressable>
            </View>
            {activeSlides.length > 0 ? (
              <View
                className="h-56 overflow-hidden rounded-2xl bg-muted"
                onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
              >
                {width > 0 ? (
                  <FlatList
                    data={activeSlides}
                    keyExtractor={(m) => m.key}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) =>
                      setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / width))
                    }
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews
                    getItemLayout={getPreviewLayout}
                    renderItem={renderPreviewItem}
                  />
                ) : null}
                {activeSlides.length > 1 ? (
                  <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
                    {activeSlides.map((m, i) => (
                      <View
                        key={m.key}
                        className={`h-1.5 rounded-full ${
                          i === carouselIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                        }`}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SectionWrap>
  );
}
