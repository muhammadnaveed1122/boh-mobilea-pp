import { useState } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { EmptyState } from '@/components/atoms/EmptyState';
import type { CallRecord } from '../../models/call-record';
import { useCallRecords } from '../../hooks/use-call-records';
import { extractRecords } from '../../models/call-record';
import { formatDateTime, formatDuration, outcomeBadge } from '../../utils/call-format';

export function DetailTabs({ call }: Readonly<{ call: CallRecord }>) {
  const [tab, setTab] = useState('history');
  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;

  const historyQuery = useCallRecords(
    { search: contactNumber ?? '' },
    { enabled: contactNumber !== null },
  );
  const history = (historyQuery.data?.pages.flatMap((p) => extractRecords(p)) ?? []).filter(
    (c) => c.uuid !== call.uuid,
  );

  return (
    <View className="px-4 py-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-row">
          <TabsTrigger value="history">
            <Text>History ({history.length})</Text>
          </TabsTrigger>
          <TabsTrigger value="notes">
            <Text>Notes</Text>
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <Text>Transcript</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <View className="pt-3">
        {tab === 'history' ? (
          history.length === 0 ? (
            <Text className="text-sm text-muted-foreground">No other calls with this number.</Text>
          ) : (
            <View className="gap-2">
              {history.map((h) => {
                const hb = outcomeBadge(h.status);
                return (
                  <View
                    key={h.uuid}
                    className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <Text className="text-sm text-foreground">
                      {h.direction === 'inbound' ? 'Incoming' : 'Outgoing'}
                    </Text>
                    <Badge variant={hb.variant}>
                      <Text>{hb.label}</Text>
                    </Badge>
                    <Text className="text-xs text-muted-foreground">
                      {formatDateTime(h.startTime)}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDuration(h.billsec || h.duration)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )
        ) : null}

        {tab === 'notes' ? (
          <Text className="text-sm text-muted-foreground">No notes for this call yet.</Text>
        ) : null}

        {tab === 'transcript' ? (
          <EmptyState
            icon="FileText"
            title="Call transcripts"
            description="Coming soon — automatic transcription of recorded calls will appear here."
          />
        ) : null}
      </View>
    </View>
  );
}
