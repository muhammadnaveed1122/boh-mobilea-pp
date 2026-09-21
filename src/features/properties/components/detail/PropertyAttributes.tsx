import { View } from 'react-native';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { SectionWrap } from '@/features/new-projects/components/detail/SectionWrap';
import { useThemeColor } from '@theme';
import type { PropertyAttribute } from '../../types';

function AttrCell({ attr }: Readonly<{ attr: PropertyAttribute }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="w-1/2 p-1">
      <View className="rounded-2xl border border-border bg-card px-3 py-3">
        <View className="flex-row items-center gap-1.5">
          <Icon name={attr.icon as IconName} size={13} color={mutedFg} />
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

export function PropertyAttributes({ attributes }: Readonly<{ attributes: PropertyAttribute[] }>) {
  if (attributes.length === 0) return null;
  return (
    <SectionWrap title="Property Details">
      <View className="-m-1 flex-row flex-wrap">
        {attributes.map((attr) => (
          <AttrCell key={attr.label} attr={attr} />
        ))}
      </View>
    </SectionWrap>
  );
}
