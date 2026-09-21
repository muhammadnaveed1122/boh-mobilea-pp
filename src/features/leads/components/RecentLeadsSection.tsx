import { ActivityIndicator, Pressable, View } from 'react-native';
import { useThemeColor } from '@theme';
import { Text } from '@/components/atoms/Text';
import { useLeadsInfinite } from '../hooks/use-leads';
import { LeadCard } from './LeadCard';

const RECENT_LIMIT = 3;

export function RecentLeadsSection({ onViewAll }: Readonly<{ onViewAll?: () => void }>) {
  const brand = useThemeColor('--brand');
  const { data, isLoading, isError, error } = useLeadsInfinite();
  const leads = data?.pages.flatMap((p) => p.items).slice(0, RECENT_LIMIT) ?? [];

  return (
    <View>
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-base font-bold text-foreground">Recent Leads</Text>
        <Pressable onPress={onViewAll} className="active:opacity-70">
          <Text className="text-xs font-medium text-info underline">View All</Text>
        </Pressable>
      </View>

      <View className="mt-3 gap-3 px-4">
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={brand} />
          </View>
        ) : null}

        {isError ? (
          <View className="rounded-xl bg-destructive/10 px-3 py-2">
            <Text className="text-xs text-destructive">
              {error?.message ?? 'Failed to load leads.'}
            </Text>
          </View>
        ) : null}

        {!isLoading && !isError && leads.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-sm text-muted-foreground">No leads yet.</Text>
          </View>
        ) : null}

        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </View>
    </View>
  );
}
