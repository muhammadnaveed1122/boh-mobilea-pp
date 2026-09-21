import * as React from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, House, Undo2, X } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import {
  asUpdateSnapshot,
  listingPreviewTitle,
  type ApprovalEvent,
  type ListingFieldChange,
  type ListingPreview,
} from '../models/approval';
import { useApprovalDetail } from '../hooks/use-approval-detail';
import { ApprovalChainPanel } from './ApprovalChainPanel';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { RequestChangesSheet } from './RequestChangesSheet';

const EVENT_LABEL: Record<ApprovalEvent['type'], string> = {
  submitted: 'Submitted for approval',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  acknowledged: 'Acknowledged',
};

function ScreenHeader({ title }: Readonly<{ title: string }>) {
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
        <Text numberOfLines={1} className="flex-1 text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
    </View>
  );
}

function PreviewField({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (value === null || value.trim() === '') return null;
  return (
    <View className="w-1/2 py-1 pr-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

function FieldChangeList({ fields }: Readonly<{ fields: readonly ListingFieldChange[] }>) {
  return (
    <View className="mt-2 gap-1.5">
      {fields.map((change) => (
        <View
          key={change.field}
          className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted px-2.5 py-1.5"
        >
          <Text className="text-xs font-medium text-foreground">{change.label}</Text>
          <Text className="text-xs text-muted-foreground line-through">{change.before ?? '—'}</Text>
          <Text className="text-xs text-muted-foreground">→</Text>
          <Text className="text-xs font-medium text-foreground">{change.after ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function ListingPreviewSection({ preview }: Readonly<{ preview: ListingPreview }>) {
  const muted = useThemeColor('--muted-foreground');
  const [open, setOpen] = React.useState(false);
  const price =
    preview.price !== null && preview.price > 0 ? preview.price.toLocaleString('en-US') : null;
  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Listing
      </Text>
      <Pressable
        onPress={() => preview.imageUrl && setOpen(true)}
        className="h-44 w-full overflow-hidden rounded-xl bg-muted"
      >
        {preview.imageUrl ? (
          <Image source={{ uri: preview.imageUrl }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <House size={36} color={muted} />
          </View>
        )}
      </Pressable>
      <Text className="mt-3 text-base font-semibold text-foreground">
        {listingPreviewTitle(preview) ?? 'Untitled listing'}
      </Text>
      {preview.reference !== null || preview.propertyType ? (
        <Text className="mt-0.5 text-sm text-muted-foreground">
          {preview.reference !== null ? (
            <Text className="font-medium">{preview.reference}</Text>
          ) : null}
          {preview.reference !== null && preview.propertyType ? ' · ' : ''}
          {preview.propertyType ?? ''}
        </Text>
      ) : null}
      {price ? (
        <Text className="mt-1 text-lg font-semibold text-foreground">
          {price}{' '}
          <Text className="text-sm font-normal text-muted-foreground">
            {preview.priceUnit ?? 'AED'}
          </Text>
        </Text>
      ) : null}
      <View className="mt-3 flex-row flex-wrap border-t border-border pt-3">
        <PreviewField label="Community" value={preview.community} />
        <PreviewField label="Area" value={preview.area} />
        <PreviewField label="Developer" value={preview.developer} />
        <PreviewField label="Size" value={preview.size} />
        <PreviewField
          label="Total Floors"
          value={preview.totalFloors !== null ? String(preview.totalFloors) : null}
        />
        <PreviewField label="Floor Level" value={preview.floorLevel} />
        <PreviewField
          label="Bedrooms"
          value={preview.bedrooms !== null ? String(preview.bedrooms) : null}
        />
        <PreviewField
          label="Bathrooms"
          value={preview.bathrooms !== null ? String(preview.bathrooms) : null}
        />
        <PreviewField label="Agent" value={preview.agent} />
        <PreviewField label="Permit No." value={preview.permitNumber} />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/90">
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityLabel="Close image"
            className="absolute right-4 top-14 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <X size={22} color="#fff" />
          </Pressable>
          {preview.imageUrl ? (
            <Image
              source={{ uri: preview.imageUrl }}
              resizeMode="contain"
              className="h-full w-full"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

export function ApprovalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useApprovalDetail(id ?? '');
  const changesRef = React.useRef<BottomSheetModal>(null);
  const iconOnDefault = useThemeColor('--primary-foreground');
  const fg = useThemeColor('--foreground');
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);

  if (!canApprovals) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approval" />
        <View className="items-center px-8 pt-16">
          <Text className="text-center text-sm text-muted-foreground">
            You don’t have access to approvals.
          </Text>
        </View>
      </View>
    );
  }

  if (detail.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approval" />
        <View className="gap-3 p-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </View>
      </View>
    );
  }

  const request = detail.request;
  if (request === undefined) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approval" />
        <View className="items-center px-8 pt-16">
          <Text className="text-sm text-muted-foreground">Request not found.</Text>
        </View>
      </View>
    );
  }

  const updateDiff = asUpdateSnapshot(request.snapshot);
  const history = [...request.history].reverse();

  const handleApprove = async () => {
    await detail.approve();
  };
  const handleRequestChanges = async (note: string) => {
    await detail.requestChanges(note);
    changesRef.current?.dismiss();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={`Approval · #${request.id.slice(0, 8)}`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 16 }}
      >
        <View className="flex-row items-center gap-2">
          <ApprovalStatusBadge status={request.status} />
        </View>

        {/* Approval request subject */}
        <View className="rounded-2xl border border-border bg-background p-4">
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Approval request
          </Text>
          {/* For an update, the "Changed fields" diff below is the source of truth — skip the
              verbose "Updated: a, b, c…" approvalFor line; keep it for other categories. */}
          {request.approvalFor && !(updateDiff && updateDiff.fields.length > 0) ? (
            <Text className="text-sm text-muted-foreground">
              Approval for:{' '}
              <Text className="font-medium text-foreground">{request.approvalFor}</Text>
            </Text>
          ) : null}
          {updateDiff && updateDiff.fields.length > 0 ? (
            <View className="mt-1">
              <Text className="mb-1 text-sm font-medium text-foreground">
                {`Changed fields (${updateDiff.fields.length})`}
              </Text>
              <FieldChangeList fields={updateDiff.fields} />
            </View>
          ) : null}
        </View>

        {request.listingPreview ? <ListingPreviewSection preview={request.listingPreview} /> : null}

        <ApprovalChainPanel request={request} />

        {/* History */}
        <View className="rounded-2xl border border-border bg-background p-4">
          <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History
          </Text>
          <View className="gap-3">
            {history.map((event) => (
              <View key={event.id}>
                <Text className="text-sm font-medium text-foreground">
                  {EVENT_LABEL[event.type] ?? event.type}
                  {event.actorName ? (
                    <Text className="font-normal text-muted-foreground"> by {event.actorName}</Text>
                  ) : null}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </Text>
                {event.note && event.note !== '' ? (
                  <Text
                    className={cn(
                      'mt-1.5 rounded-lg px-3 py-2 text-sm',
                      event.type === 'changes_requested'
                        ? 'bg-destructive/10 text-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {event.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {request.canAct ? (
        <View
          style={{ paddingBottom: insets.bottom + 12 }}
          className="absolute inset-x-0 bottom-0 flex-row gap-2 border-t border-border bg-background px-4 pt-3"
        >
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => changesRef.current?.present()}
          >
            <Undo2 size={18} color={fg} />
            <Text>Request changes</Text>
          </Button>
          <Button
            className="flex-1"
            loading={detail.isApproving}
            onPress={() => void handleApprove()}
          >
            <Check size={18} color={iconOnDefault} />
            <Text>Approve</Text>
          </Button>
        </View>
      ) : null}

      <RequestChangesSheet
        sheetRef={changesRef}
        onSubmit={(note) => void handleRequestChanges(note)}
        isSubmitting={detail.isRequestingChanges}
      />
    </View>
  );
}
