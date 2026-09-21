import { ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import type { CallStats } from '../models/call-stats';
import { formatDuration } from '../utils/call-format';

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  dotClass: string;
}

function Stat({ label, value, sub, dotClass }: Readonly<StatProps>) {
  return (
    <Card className="min-w-40 px-4 py-3">
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${dotClass}`} />
        <Text className="text-xs text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-1 text-2xl font-semibold text-foreground">{String(value)}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </Card>
  );
}

export function StatsRow({ stats }: Readonly<{ stats: CallStats | undefined }>) {
  const total = stats?.total_calls ?? 0;
  const answered = stats?.answered_calls ?? 0;
  const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
    >
      <Stat label="Total calls" value={total} dotClass="bg-primary" />
      <Stat
        label="Connected"
        value={answered}
        sub={`${answerRate}% answer rate`}
        dotClass="bg-success"
      />
      <Stat label="No answer" value={stats?.missed_calls ?? 0} dotClass="bg-warning" />
      <Stat
        label="Avg talk time"
        value={formatDuration(stats?.average_duration ?? 0)}
        dotClass="bg-info"
      />
    </ScrollView>
  );
}
