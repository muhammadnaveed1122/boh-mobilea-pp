import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { CallRecord } from '../../models/call-record';
import { formatDateTime, formatDuration, outcomeBadge, sourceLabel } from '../../utils/call-format';

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="w-1/2 px-1 py-2">
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm text-foreground">{value}</Text>
    </View>
  );
}

export function FactsGrid({ call, campaign }: Readonly<{ call: CallRecord; campaign: string }>) {
  const inbound = call.direction === 'inbound';
  const agentName = call.extension?.agentName ?? call.extensionNumber ?? '—';
  return (
    <View className="flex-row flex-wrap px-3">
      <Fact label="Date & time" value={formatDateTime(call.startTime)} />
      <Fact label="Duration" value={formatDuration(call.billsec || call.duration)} />
      <Fact label="Source" value={sourceLabel(call.source)} />
      <Fact label="Outcome" value={outcomeBadge(call.status).label} />
      <Fact label="Agent" value={agentName} />
      <Fact label="Department" value={call.extension?.department?.name ?? '—'} />
      <Fact label="Campaign / Widget" value={campaign} />
      <Fact label="Direction" value={inbound ? 'Incoming' : 'Outgoing'} />
    </View>
  );
}
