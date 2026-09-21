import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { CHAT_WRITE, useRequirePermission } from '@/lib/rbac';
import { useThemeColor } from '@theme';

import { useConversationLabels } from '../../hooks/use-chat-labels';
import { LabelAssignSheet, type LabelAssignSheetHandle } from './LabelAssignSheet';
import { ManageLabelsSheet, type ManageLabelsSheetHandle } from './ManageLabelsSheet';

export function LabelsCard({ conversationId }: Readonly<{ conversationId: string }>) {
  const assignRef = useRef<LabelAssignSheetHandle>(null);
  const manageRef = useRef<ManageLabelsSheetHandle>(null);
  const mutedFg = useThemeColor('--muted-foreground');
  const canEdit = useRequirePermission(CHAT_WRITE) === 'allowed';
  const { data: assigned = [] } = useConversationLabels(conversationId);

  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">Labels</Text>
        {canEdit ? (
          <Pressable
            onPress={() => manageRef.current?.open()}
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-full border border-border px-2.5 py-1 active:opacity-70"
          >
            <Icon name="Settings2" size={12} color={mutedFg} />
            <Text className="text-xs font-medium text-muted-foreground">Manage</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {assigned.map((label) => (
          <View
            key={label.id}
            className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/15 px-2.5 py-1"
          >
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
            <Text className="text-xs font-medium">{label.name}</Text>
          </View>
        ))}
        {assigned.length === 0 && !canEdit ? (
          <Text className="text-sm text-muted-foreground">No labels</Text>
        ) : null}
        {canEdit ? (
          <Pressable
            onPress={() => assignRef.current?.open()}
            className="flex-row items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 active:opacity-70"
          >
            <Icon name="Plus" size={12} color={mutedFg} />
            <Text className="text-xs font-medium text-muted-foreground">Add label</Text>
          </Pressable>
        ) : null}
      </View>

      {canEdit ? (
        <>
          <LabelAssignSheet
            ref={assignRef}
            conversationId={conversationId}
            onManage={() => {
              assignRef.current?.close();
              manageRef.current?.open();
            }}
          />
          <ManageLabelsSheet ref={manageRef} />
        </>
      ) : null}
    </View>
  );
}
