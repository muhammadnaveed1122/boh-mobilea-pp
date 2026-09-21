import { View } from 'react-native';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Card } from '@/components/molecules/Card';

export function AttendanceWidgetSkeleton() {
  return (
    <Card>
      <View className="flex-row items-center gap-3 p-3">
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-40" />
        </View>
        <Skeleton className="h-9 w-24" />
      </View>
    </Card>
  );
}
