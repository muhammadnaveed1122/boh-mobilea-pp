import { ScrollView, View } from 'react-native';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import type { IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { getLeads } from '../../services';
import type { TabCount } from '../../types';
import { CategoryCard } from './CategoryCard';

interface CategoryCardsGridProps {
  tabCounts: TabCount[];
}

const INTENT_BUCKETS = ['buy', 'sell', 'rent'] as const;
type IntentBucket = (typeof INTENT_BUCKETS)[number];

/** Per-bucket totals come from the leads list (`intentBucket` filter), reading `total`. */
function useIntentCounts(): Record<IntentBucket, number> {
  const results = useQueries({
    queries: INTENT_BUCKETS.map((bucket) => ({
      queryKey: ['leads', 'intent-count', bucket],
      queryFn: () => getLeads({ intentBucket: bucket, limit: 1, page: 1 }),
      staleTime: 30_000,
    })),
  });
  return {
    buy: results[0]?.data?.total ?? 0,
    sell: results[1]?.data?.total ?? 0,
    rent: results[2]?.data?.total ?? 0,
  };
}

/**
 * Off-plan / new-project ("Primary Plus") leads. Not an intent bucket and not a tabCount key —
 * it is the `newProject` predicate, so it gets its own count query.
 */
function useNewProjectCount(): number {
  const { data } = useQuery({
    queryKey: ['leads', 'new-project-count'],
    queryFn: () => getLeads({ newProject: true, limit: 1, page: 1 }),
    staleTime: 30_000,
  });
  return data?.total ?? 0;
}

interface CardConfig {
  label: string;
  icon: IconName;
  href: Href;
  count: number;
}

export function CategoryCardsGrid({ tabCounts }: Readonly<CategoryCardsGridProps>) {
  const intent = useIntentCounts();
  const newProjectCount = useNewProjectCount();
  // Portal is a real tabCount key (all/website/portal); the intent buckets are
  // NOT in tabCounts, so buy/sell/rent come from useIntentCounts above.
  const portalCount = tabCounts.find((t) => t.key === 'portal')?.count ?? 0;

  const cards: CardConfig[] = [
    { label: 'Buy', icon: 'Building', href: '/leads/buy', count: intent.buy },
    { label: 'Sell', icon: 'Tag', href: '/leads/sell', count: intent.sell },
    { label: 'Rent', icon: 'KeyRound', href: '/leads/rent', count: intent.rent },
    { label: 'Portal', icon: 'Globe', href: '/leads/portal', count: portalCount },
    {
      label: 'New Projects',
      icon: 'Building2',
      href: '/leads/new-projects',
      count: newProjectCount,
    },
  ];

  return (
    <View>
      <Text className="mb-3 px-4 text-sm font-extrabold text-foreground">Browse by Category</Text>
      {/* Full-bleed rail: padding lives on the content container so the last
          card can scroll clear of the screen edge. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {cards.map((c) => (
          <CategoryCard
            key={c.label}
            label={c.label}
            count={c.count}
            icon={c.icon}
            href={c.href}
            className="w-36"
          />
        ))}
      </ScrollView>
    </View>
  );
}
