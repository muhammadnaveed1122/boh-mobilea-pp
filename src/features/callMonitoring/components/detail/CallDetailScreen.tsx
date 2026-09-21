import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Badge } from '@/components/atoms/Badge';
import { BackButton } from '@/components/atoms/BackButton';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { extractRecords, type CallRecord, type CallsListResponse } from '../../models/call-record';
import { useRecordingPlayer } from '../../hooks/use-recording-player';
import { useRecordingDownload } from '../../hooks/use-recording-download';
import { useCampaignMap } from '../../hooks/use-campaigns';
import { displayNumber, initials, outcomeBadge, resolveCampaign } from '../../utils/call-format';
import { AudioPlayer } from '../AudioPlayer';
import { DownloadButton } from '../DownloadButton';
import { RecordingButton } from '../RecordingButton';
import { DetailTabs } from './DetailTabs';
import { FactsGrid } from './FactsGrid';
import { QuickActions } from './QuickActions';
import { SpeedToLeadCard } from './SpeedToLeadCard';
import { TelesalesCard } from './TelesalesCard';

/** Find a loaded record by uuid across every cached call-records infinite query. */
function useCachedRecord(uuid: string): CallRecord | undefined {
  const qc = useQueryClient();
  return useMemo(() => {
    const queries = qc.getQueriesData<{ pages: CallsListResponse[] }>({
      queryKey: ['call-records'],
    });
    for (const [, data] of queries) {
      const pages = data?.pages ?? [];
      for (const page of pages) {
        const hit = extractRecords(page).find((r) => r.uuid === uuid);
        if (hit) return hit;
      }
    }
    return undefined;
  }, [qc, uuid]);
}

export function CallDetailScreen({ uuid }: Readonly<{ uuid: string }>) {
  const insets = useSafeAreaInsets();
  const player = useRecordingPlayer();
  const download = useRecordingDownload();
  const canListen = useCan(PERMISSIONS.CALLS_LISTEN);
  const canDownload = useCan(PERMISSIONS.CALLS_DOWNLOAD);
  const campaignMap = useCampaignMap();
  const call = useCachedRecord(uuid);

  if (!call) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 py-2">
          <BackButton onPress={() => router.back()} />
        </View>
        <EmptyState
          icon="Phone"
          title="Call not found"
          description="Open this call from the list to see its details."
        />
      </View>
    );
  }

  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;
  const name = call.callerIdName ?? 'Unknown';
  const badge = outcomeBadge(call.status);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-semibold text-foreground">Call detail</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Text className="text-sm font-medium text-foreground">
              {name === 'Unknown' ? '?' : initials(name)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">{name}</Text>
            <Text className="text-sm text-muted-foreground">{displayNumber(contactNumber)}</Text>
          </View>
          <Badge variant={badge.variant}>
            <Text>{(inbound ? 'Incoming · ' : 'Outgoing · ') + badge.label}</Text>
          </Badge>
        </View>

        <QuickActions call={call} />
        <FactsGrid call={call} campaign={resolveCampaign(call, campaignMap)} />
        <SpeedToLeadCard call={call} />
        <TelesalesCard call={call} campaignName={resolveCampaign(call, campaignMap)} />

        <RecordingSection
          uuid={call.uuid}
          player={player}
          download={download}
          canListen={canListen}
          canDownload={canDownload}
        />

        <DetailTabs call={call} />
      </ScrollView>
    </View>
  );
}

interface RecordingSectionProps {
  uuid: string;
  player: ReturnType<typeof useRecordingPlayer>;
  download: ReturnType<typeof useRecordingDownload>;
  canListen: boolean;
  canDownload: boolean;
}

/** Recording block: gated play/transport (`calls:listen`) + download (`calls:download`). */
function RecordingSection({
  uuid,
  player,
  download,
  canListen,
  canDownload,
}: Readonly<RecordingSectionProps>) {
  if (!canListen && !canDownload) return null;

  const active = canListen && player.activeId === uuid;

  return (
    <View className="px-4 py-3">
      <Text className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Recording
      </Text>
      {active ? (
        <View className="rounded-xl border border-border bg-card p-4">
          <AudioPlayer uuid={uuid} player={player} />
        </View>
      ) : (
        <View className="flex-row gap-2">
          {canListen ? <RecordingButton uuid={uuid} player={player} labeled /> : null}
          {canDownload ? <DownloadButton uuid={uuid} download={download} labeled /> : null}
        </View>
      )}
      {active && canDownload ? (
        <View className="mt-2 flex-row">
          <DownloadButton uuid={uuid} download={download} labeled />
        </View>
      ) : null}
      {canListen && player.error && player.activeId !== uuid ? (
        <Text className="mt-2 text-xs text-destructive">{player.error}</Text>
      ) : null}
    </View>
  );
}
