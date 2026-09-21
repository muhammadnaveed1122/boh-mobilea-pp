import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { formatAed, locationLabel, parsePrice, propertyTypeLabel } from '../../utils/format';
import { useProjectCard } from './ProjectCardContext';

export function ProjectCardBody() {
  const { project } = useProjectCard();
  const mutedFg = useThemeColor('--muted-foreground');
  const price = formatAed(parsePrice(project));
  const typeLabel = propertyTypeLabel(project.propertyType);

  return (
    <View className="px-1 pb-1 pt-3">
      <View className="flex-row items-center gap-1.5">
        <Icon name="MapPin" size={12} color={mutedFg} />
        <Text className="flex-1 text-xs font-medium text-muted-foreground" numberOfLines={1}>
          {locationLabel(project)}
        </Text>
        {typeLabel ? (
          <View className="flex-row items-center gap-1">
            <Icon name="Building2" size={12} color={mutedFg} />
            <Text className="text-[11px] font-medium text-muted-foreground">{typeLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-1 text-base font-semibold text-foreground" numberOfLines={1}>
        {project.projectName}
      </Text>

      <View className="mt-1 flex-row items-end justify-between">
        <View className="flex-1 flex-row items-baseline gap-1">
          <Text
            className="text-base font-bold text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {price}
          </Text>
          <Text className="text-xs text-muted-foreground">starting</Text>
        </View>
        {project.handover ? (
          <View className="flex-row items-center gap-1">
            <Icon name="Calendar" size={11} color={mutedFg} />
            <Text className="text-xs text-muted-foreground">{project.handover}</Text>
          </View>
        ) : null}
      </View>

      {project.paymentPlan ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <Icon name="CreditCard" size={12} color={mutedFg} />
          <Text className="flex-1 text-xs font-medium text-muted-foreground" numberOfLines={1}>
            {project.paymentPlan}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
