import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { APPROVAL_QUEUES, QUEUE_CATEGORY } from '../constants/queues';
import { useApprovalsPendingCount } from '../hooks/use-approvals-pending-count';
import { QueueCard } from './QueueCard';

function ScreenHeader() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Approvals</Text>
      </View>
    </View>
  );
}

export function ApprovalsHubScreen() {
  const insets = useSafeAreaInsets();
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);
  const { byCategory } = useApprovalsPendingCount();

  if (!canApprovals) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="items-center px-8 pt-16">
          <Text className="text-center text-sm text-muted-foreground">
            You don’t have access to approvals.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        <Text className="text-sm text-muted-foreground">
          Review requests awaiting your approval.
        </Text>
        {APPROVAL_QUEUES.map((def) => (
          <QueueCard
            key={def.slug}
            def={def}
            showDot={!def.deferred && (byCategory[QUEUE_CATEGORY[def.slug]] ?? 0) > 0}
            onPress={() =>
              router.push({
                pathname: '/(app)/approvals/[queue]',
                params: { queue: def.slug },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}
