import { Text } from '@/components/atoms/Text';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import type { MarketTab } from '@/features/leads/types';

const TABS: { key: MarketTab; label: string }[] = [
  { key: 'all', label: 'All Leads' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
];

export function MarketTabs({
  value,
  onChange,
}: Readonly<{ value: MarketTab; onChange: (t: MarketTab) => void }>) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as MarketTab)}>
      <TabsList className="mx-4">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            <Text>{t.label}</Text>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
