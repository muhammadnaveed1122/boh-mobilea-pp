import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import type { CallRecord } from '../../models/call-record';
import { displayNumber } from '../../utils/call-format';

function Cell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="w-1/2 py-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}

export function SpeedToLeadCard({ call }: Readonly<{ call: CallRecord }>) {
  if (call.source !== 'speed_to_lead') return null;
  const agentName = call.extension?.agentName ?? call.extensionNumber ?? '—';
  return (
    <View className="px-4 py-3">
      <Text className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Speed to Lead
      </Text>
      <Card variant="infoSoft" className="flex-row flex-wrap px-3 py-2">
        <Cell label="Trigger" value="Auto-callback" />
        <Cell label="Lead name" value={call.callerIdName ?? '—'} />
        <Cell label="Lead number" value={displayNumber(call.callerIdNumber)} />
        <Cell label="Agent dialled" value={agentName} />
      </Card>
    </View>
  );
}
