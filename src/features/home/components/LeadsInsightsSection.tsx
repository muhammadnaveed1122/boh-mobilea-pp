import { View } from 'react-native';
import { useLeadsOverview } from '@/features/leads/hooks/use-leads-overview';
import { TodaysPriorities } from '@/features/leads/components/dashboard/TodaysPriorities';

/**
 * Leads insights for the home dashboard: today's priorities carousel. Reads from
 * the leads-overview query (deduped with the New Leads stat tile). Render only
 * when the user can read leads.
 */
export function LeadsInsightsSection() {
  const { data, isLoading, error } = useLeadsOverview();

  return (
    <View className="mt-6">
      <TodaysPriorities items={data?.priorities ?? []} loading={isLoading} error={error ?? null} />
    </View>
  );
}
