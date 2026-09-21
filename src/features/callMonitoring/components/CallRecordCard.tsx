import { Pressable, View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import { cn } from '@/lib/utils';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useThemeColor } from '@theme';
import type { CallRecord } from '../models/call-record';
import type { RecordingPlayer } from '../hooks/use-recording-player';
import { useRecordingDownload } from '../hooks/use-recording-download';
import {
  displayNumber,
  formatDateTime,
  formatDuration,
  initials,
  outcomeBadge,
  resolveCampaign,
  sourceBadgeVariant,
  sourceLabel,
} from '../utils/call-format';
import { useCampaignMap } from '../hooks/use-campaigns';
import { AudioPlayer } from './AudioPlayer';
import { DownloadButton } from './DownloadButton';
import { RecordingButton } from './RecordingButton';

interface Props {
  record: CallRecord;
  isDnc: boolean;
  player: RecordingPlayer;
  onPress: () => void;
}

export function CallRecordCard({ record, isDnc, player, onPress }: Readonly<Props>) {
  const success = useThemeColor('--success');
  const primary = useThemeColor('--primary');
  const muted = useThemeColor('--muted-foreground');
  const canListen = useCan(PERMISSIONS.CALLS_LISTEN);
  const canDownload = useCan(PERMISSIONS.CALLS_DOWNLOAD);
  const download = useRecordingDownload();
  const campaignMap = useCampaignMap();
  const inbound = record.direction === 'inbound';
  const contactNumber = inbound ? record.callerIdNumber : record.destinationNumber;
  const badge = outcomeBadge(record.status);
  const agentName = record.extension?.agentName ?? record.extensionNumber ?? '—';
  const dept = record.extension?.department?.name;
  const active = player.activeId === record.uuid;

  return (
    <Card className={cn('overflow-hidden p-0', active && 'border-primary/60')}>
      {/* Tapping the info body opens the detail screen; the player below is
          isolated so scrubbing/skip taps never trigger navigation. */}
      <Pressable onPress={onPress} className="gap-2 px-4 py-3 active:opacity-90">
        {/* Row 1: direction + name/number + outcome */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Icon
                name={inbound ? 'PhoneIncoming' : 'PhoneOutgoing'}
                size={18}
                color={inbound ? success : primary}
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-medium text-foreground" numberOfLines={1}>
                  <Text className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                    ext{' '}
                  </Text>
                  {record.callerIdName ?? '—'}
                </Text>
                {isDnc ? (
                  <Badge variant="destructiveSoft">
                    <Text>DNC</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="text-xs text-muted-foreground">{displayNumber(contactNumber)}</Text>
            </View>
          </View>
          <Badge variant={badge.variant}>
            <Text>{badge.label}</Text>
          </Badge>
        </View>

        {/* Row 2: agent + dept + source */}
        <View className="flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Text className="text-[10px] font-medium text-foreground">
              {agentName === '—' ? '?' : initials(agentName)}
            </Text>
          </View>
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {agentName}
            {dept ? ` · ${dept}` : ''}
          </Text>
          <Badge variant={sourceBadgeVariant(record.source)}>
            <Text>{sourceLabel(record.source)}</Text>
          </Badge>
        </View>

        {/* Campaign name — telesales calls only */}
        {record.source === 'telesales' ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="Megaphone" size={12} color={muted} />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {resolveCampaign(record, campaignMap)}
            </Text>
          </View>
        ) : null}

        {/* Row 3: time + duration + play trigger */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">{formatDateTime(record.startTime)}</Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Icon name="Clock" size={13} color={muted} />
              <Text className="font-mono text-xs text-foreground">
                {formatDuration(record.billsec || record.duration)}
              </Text>
            </View>
            {canListen && !active ? <RecordingButton uuid={record.uuid} player={player} /> : null}
            {canDownload ? <DownloadButton uuid={record.uuid} download={download} /> : null}
          </View>
        </View>
      </Pressable>

      {/* Expanded transport — only for the loaded recording. */}
      {active && canListen ? (
        <View className="border-t border-border bg-muted/30 px-4 py-3">
          <AudioPlayer uuid={record.uuid} player={player} />
        </View>
      ) : null}
    </Card>
  );
}
