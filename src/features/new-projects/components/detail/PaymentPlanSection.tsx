import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { ProjectPaymentPlans } from '../../types';
import { SectionWrap } from './SectionWrap';

function MilestoneRow({
  name,
  percentage,
  delay,
  isLast,
}: Readonly<{ name: string; percentage: number; delay: number; isLast: boolean }>) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(100, percentage)),
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [progress, percentage, delay]);

  const widthInterp = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className={isLast ? 'py-3' : 'border-b border-border py-3'}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm font-medium text-foreground" numberOfLines={2}>
          {name}
        </Text>
        <Text className="text-base font-bold text-brand">{percentage}%</Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <Animated.View style={{ width: widthInterp }} className="h-full rounded-full bg-brand" />
      </View>
    </View>
  );
}

interface Props {
  paymentPlans: ProjectPaymentPlans | undefined;
}

export function PaymentPlanSection({ paymentPlans }: Readonly<Props>) {
  if (!paymentPlans?.isVisible) return null;
  const milestones = paymentPlans.plan?.milestones ?? [];
  if (milestones.length === 0) return null;

  return (
    <SectionWrap title={paymentPlans.title || 'Payment Plan'}>
      <View className="rounded-2xl border border-border bg-card px-4 py-1">
        {paymentPlans.plan?.name ? (
          <View className="border-b border-border py-3">
            <Text className="text-xs uppercase tracking-wider text-muted-foreground">Plan</Text>
            <Text className="mt-0.5 text-base font-semibold text-foreground">
              {paymentPlans.plan.name}
            </Text>
          </View>
        ) : null}
        {milestones.map((m, i) => (
          <MilestoneRow
            key={`${i}-${m.name}`}
            name={m.name}
            percentage={m.percentage}
            delay={i * 120}
            isLast={i === milestones.length - 1}
          />
        ))}
      </View>
    </SectionWrap>
  );
}
