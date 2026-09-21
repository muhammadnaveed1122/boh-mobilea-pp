import { View } from 'react-native';
import { Skeleton } from '@/components/atoms/Skeleton';

export function ListingDetailSkeleton() {
  return (
    <View className="px-4 pt-2">
      <View className="rounded-2xl bg-card p-4" style={{ elevation: 1 }}>
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-2/3 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </View>
        <Skeleton className="mt-4 h-9 w-40 rounded-md" />
        <Skeleton className="mt-4 h-12 w-full rounded-md" />
      </View>

      {[0, 1, 2].map((i) => (
        <View key={i} className="mt-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="mt-3 h-24 w-full rounded-md" />
        </View>
      ))}
    </View>
  );
}
