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

/** Telesales campaign origin card — mirrors the web detail panel's Campaign card. */
export function TelesalesCard({
  call,
  campaignName,
}: Readonly<{ call: CallRecord; campaignName: string }>) {
  if (call.source !== 'telesales') return null;
  const agentName = call.extension?.agentName ?? call.extensionNumber ?? '—';
  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;
  return (
    <View className="px-4 py-3">
      <Text className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Campaign
      </Text>
      <Card variant="infoSoft" className="flex-row flex-wrap px-3 py-2">
        <Cell label="Campaign" value={campaignName} />
        <Cell label="Agent dialled" value={agentName} />
        <Cell label="Contact" value={call.callerIdName ?? '—'} />
        <Cell label="Number" value={displayNumber(contactNumber)} />
      </Card>
    </View>
  );
}
