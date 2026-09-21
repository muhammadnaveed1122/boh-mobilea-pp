import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { type NotificationTab, useNotifications } from '../hooks/use-notifications';
import type { Notification } from '../types';
import { resolveRedirect } from '../utils/resolve-redirect';
import { NotificationRow } from './NotificationRow';

function CategoryChips({
  options,
  value,
  onChange,
}: Readonly<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Text
            key={opt.value || 'all'}
            onPress={() => onChange(opt.value)}
            className={cn(
              'overflow-hidden rounded-full border border-border px-3 py-1.5 text-xs',
              active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
            )}
          >
            {opt.label}
          </Text>
        );
      })}
    </ScrollView>
  );
}

function LoadingList() {
  return (
    <View className="gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </View>
  );
}

export function NotificationCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    groupedByDate,
    notifications,
    activeTab,
    setActiveTab,
    searchInput,
    setSearchInput,
    categoryFilter,
    setCategoryFilter,
    markAsRead,
    markAllAsRead,
    unreadCount,
    categoryOptions,
    isLoading,
    isFetchingMore,
    hasMore,
    loadMore,
  } = useNotifications();

  const onRowPress = (n: Notification): void => {
    markAsRead(n.id);
    const href = resolveRedirect(n);
    if (href) router.push(href as never);
  };

  let listContent: ReactNode;
  if (isLoading) {
    listContent = <LoadingList />;
  } else if (notifications.length === 0) {
    listContent = (
      <EmptyState
        icon="BellOff"
        title="You're all caught up"
        description="No notifications match your filters."
      />
    );
  } else {
    listContent = (
      <View className="gap-4">
        {groupedByDate.map((group) => (
          <View key={group.label} className="gap-1">
            <Text className="px-1 text-xs font-semibold uppercase text-muted-foreground">
              {group.label}
            </Text>
            {group.items.map((n) => (
              <NotificationRow key={n.id} notification={n} onPress={onRowPress} />
            ))}
          </View>
        ))}

        {hasMore ? (
          <Button
            variant="outline"
            onPress={loadMore}
            loading={isFetchingMore}
            loadingLabel="Loading"
          >
            <Text>Load More</Text>
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="gap-5 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-80"
        >
          <Icon name="ArrowLeft" size={20} />
        </Pressable>

        <View className="gap-1">
          <Text variant="heading">Notifications</Text>
          <Text variant="muted">
            Stay updated with a real-time feed of all latest activity and important alerts.
          </Text>
        </View>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NotificationTab)}>
          <TabsList>
            <TabsTrigger value="all">
              <Text>All</Text>
            </TabsTrigger>
            <TabsTrigger value="unread">
              <Text>Unread {String(unreadCount).padStart(2, '0')}</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search..."
          autoCapitalize="none"
        />

        <CategoryChips
          options={categoryOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />

        <View className="flex-row items-center justify-between">
          <Text className="font-medium">All Notifications</Text>
          <Button variant="outline" size="sm" onPress={markAllAsRead}>
            <Icon name="Check" size={16} />
            <Text>Mark all as read</Text>
          </Button>
        </View>

        {listContent}
      </ScrollView>
    </View>
  );
}
