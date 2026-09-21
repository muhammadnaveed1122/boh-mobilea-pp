import { ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { ToggleGroup, ToggleGroupItem } from '@/components/atoms/ToggleGroup';
import { useLeadsFilterStore, type LeadFilterValue } from '../store/filter.store';
import { STATUS_FILTERS, STATUS_LABEL } from '../types';

const FILTER_VALUES: readonly LeadFilterValue[] = ['All', ...STATUS_FILTERS];

export function LeadFilterChips() {
  const filter = useLeadsFilterStore((s) => s.filter);
  const setFilter = useLeadsFilterStore((s) => s.setFilter);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="mt-4"
    >
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => v && setFilter(v as LeadFilterValue)}
        className="flex-row gap-2"
      >
        {FILTER_VALUES.map((f) => (
          <ToggleGroupItem key={f} value={f}>
            <Text>{f === 'All' ? 'All' : STATUS_LABEL[f]}</Text>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ScrollView>
  );
}
