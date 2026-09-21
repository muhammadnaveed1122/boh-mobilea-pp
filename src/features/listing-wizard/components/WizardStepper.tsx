import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

const STEPS = [
  { title: 'Information', sub: 'Where you start' },
  { title: 'Description', sub: 'Title & content' },
  { title: 'Media & Documents', sub: 'Images & files' },
  { title: 'Portals', sub: 'Website & portals' },
] as const;

interface StepChipProps {
  index: number;
  title: string;
  sub: string;
  activeIndex: number;
  onPress?: () => void;
}

function StepChip({ index, title, sub, activeIndex, onPress }: Readonly<StepChipProps>) {
  const brandFg = useThemeColor('--brand-foreground');

  const isDone = index < activeIndex;
  const isCurrent = index === activeIndex;
  const isUpcoming = !isDone && !isCurrent;

  const circleClass = cn(
    'h-7 w-7 items-center justify-center rounded-full',
    isDone || isCurrent ? 'bg-brand' : 'border border-border bg-card',
  );

  const titleClass = cn(
    'text-xs font-semibold',
    isUpcoming ? 'text-muted-foreground' : 'text-foreground',
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'flex-row items-center gap-2',
        isCurrent && 'rounded-full bg-muted px-3 py-1.5',
      )}
    >
      <View className={circleClass}>
        {isDone ? (
          <Icon name="Check" size={14} color={brandFg} />
        ) : (
          <Text
            className={cn('text-xs font-bold', isUpcoming && 'text-muted-foreground')}
            style={isCurrent ? { color: brandFg } : undefined}
          >
            {String(index + 1)}
          </Text>
        )}
      </View>
      <View>
        <Text className={titleClass}>{title}</Text>
        <Text className="text-[10px] text-muted-foreground">{sub}</Text>
      </View>
    </Pressable>
  );
}

export function WizardStepper({
  activeIndex,
  onStepPress,
}: Readonly<{ activeIndex: number; onStepPress?: (index: number) => void }>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow:0 keeps the row at content height (a horizontal ScrollView
      // otherwise fills the column); alignItems:center stops chips from
      // stretching vertically (which ballooned the active chip's pill).
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 12,
        alignItems: 'center',
      }}
    >
      {STEPS.map((step, i) => (
        <StepChip
          key={step.title}
          index={i}
          title={step.title}
          sub={step.sub}
          activeIndex={activeIndex}
          onPress={onStepPress ? () => onStepPress(i) : undefined}
        />
      ))}
    </ScrollView>
  );
}
