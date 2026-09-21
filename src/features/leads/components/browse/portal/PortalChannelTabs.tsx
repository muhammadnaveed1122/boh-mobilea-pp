import { View } from 'react-native';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { usePortalOverview } from '@/features/leads/hooks/use-portal-overview';
import type { ChannelTab, PortalSource } from '@/features/leads/types';

const TABS: { key: ChannelTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'calls', label: 'Calls' },
  { key: 'emails', label: 'Emails' },
];

/** Channel tabs using the shared Tabs atom (matches market/auth tabs), with inline counts. */
export function PortalChannelTabs({
  value,
  portalSource,
  onChange,
}: Readonly<{
  value: ChannelTab;
  portalSource: PortalSource | null;
  onChange: (t: ChannelTab) => void;
}>) {
  const { data } = usePortalOverview({ tab: value, portalSource: portalSource ?? undefined });
  const counts = data?.channelCounts;

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ChannelTab)}>
      <TabsList className="mx-4">
        {TABS.map((t) => {
          const c = counts ? counts[t.key] : undefined;
          return (
            <TabsTrigger key={t.key} value={t.key}>
              <View className="flex-row items-center gap-1">
                <Text>{t.label}</Text>
                {c === undefined ? null : <Text className="opacity-60">{c}</Text>}
              </View>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
