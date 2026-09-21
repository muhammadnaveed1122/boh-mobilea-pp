import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { IconName } from '@/components/atoms/Icon';
import { useThemeColor } from '@theme';
import type { ProjectHighlights } from '../../types';
import { propertyTypeLabel } from '../../utils/format';
import { SectionWrap } from './SectionWrap';

interface Props {
  highlights: ProjectHighlights | undefined;
}

interface Attr {
  icon: IconName;
  label: string;
  value: string | null;
}

function AttrCell({ attr }: Readonly<{ attr: Attr }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  if (!attr.value) return null;
  return (
    <View className="w-1/2 p-1">
      <View className="rounded-2xl border border-border bg-card px-3 py-3">
        <View className="flex-row items-center gap-1.5">
          <Icon name={attr.icon} size={13} color={mutedFg} />
          <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {attr.label}
          </Text>
        </View>
        <Text className="mt-1 text-sm font-semibold text-foreground" numberOfLines={2}>
          {attr.value}
        </Text>
      </View>
    </View>
  );
}

export function ProjectDetailsSection({ highlights }: Readonly<Props>) {
  if (!highlights) return null;

  const attrs: Attr[] = [
    {
      icon: 'Building',
      label: 'Developer',
      value: highlights.developer?.brandName ?? null,
    },
    {
      icon: 'Wrench',
      label: 'Stage',
      value: propertyTypeLabel(highlights.developmentStage),
    },
    {
      icon: 'CircleCheck',
      label: 'Availability',
      value: propertyTypeLabel(highlights.availability),
    },
    {
      icon: 'House',
      label: 'Property Use',
      value: propertyTypeLabel(highlights.propertyUse),
    },
    {
      icon: 'Sparkles',
      label: 'Lifestyle',
      value: propertyTypeLabel(highlights.lifestyleStandard),
    },
    {
      icon: 'Calendar',
      label: 'Handover',
      value: highlights.handoverDate ?? null,
    },
  ].filter((a) => a.value) as Attr[];

  if (attrs.length === 0) return null;

  return (
    <SectionWrap title={highlights.title ?? 'Project Details'} tagline={highlights.tagline}>
      <View className="-m-1 flex-row flex-wrap">
        {attrs.map((a) => (
          <AttrCell key={a.label} attr={a} />
        ))}
      </View>
    </SectionWrap>
  );
}
