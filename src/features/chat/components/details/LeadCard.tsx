import { useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useLeadDetail } from '@/features/leads/hooks/use-lead-detail';
import type { LeadDetail } from '@/features/leads/models/lead-detail';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useAssignConversationToLead } from '../../hooks/use-assign-conversation';
import { LeadPickerSheet, type LeadPickerSheetHandle } from './LeadPickerSheet';
import { PERSONA_LABELS, priorityHex } from './persona-labels';

interface Props {
  conversationId: string;
  channel: string;
  leadId?: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
}

function Chip({ label, tint }: Readonly<{ label: string; tint?: string | null }>) {
  return (
    <View
      className={cn('rounded-full px-2.5 py-1', !tint && 'bg-muted-foreground/15')}
      style={tint ? { backgroundColor: `${tint}1A` } : undefined}
    >
      <Text
        className={cn('text-xs font-medium capitalize', !tint && 'text-foreground')}
        style={tint ? { color: tint } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

function LeadDetails({ lead }: Readonly<{ lead: LeadDetail }>) {
  return (
    <View className="gap-2.5">
      <View>
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">Name</Text>
        <Text className="text-sm font-medium">{lead.name || lead.email}</Text>
      </View>
      {lead.interest ? (
        <View>
          <Text className="text-xs uppercase tracking-wide text-muted-foreground">Persona</Text>
          <Text className="text-sm font-medium">
            {PERSONA_LABELS[String(lead.interest)] ?? String(lead.interest)}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Chip label={String(lead.status).replace(/_/g, ' ').toLowerCase()} />
        {lead.priority ? (
          <Chip label={String(lead.priority)} tint={priorityHex(lead.priority)} />
        ) : null}
      </View>
      {lead.assignee ? (
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/15">
            <Text className="text-xs font-semibold">
              {`${lead.assignee.firstName.charAt(0)}${lead.assignee.lastName.charAt(0)}`.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-xs uppercase tracking-wide text-muted-foreground">
              Assigned agent
            </Text>
            <Text className="text-sm font-medium">
              {lead.assignee.firstName} {lead.assignee.lastName}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function LeadCard({
  conversationId,
  channel,
  leadId,
  contactName,
  phone,
  email,
}: Readonly<Props>) {
  const pickerRef = useRef<LeadPickerSheetHandle>(null);
  const mutedFg = useThemeColor('--muted-foreground');
  const hasLead = !!leadId;
  const { data: lead, isFetching } = useLeadDetail(hasLead ? leadId : undefined);
  const assign = useAssignConversationToLead(conversationId, channel);

  const openCreate = (): void => {
    router.push({
      pathname: '/leads/create',
      params: { name: contactName, phone: phone ?? '', email: email ?? '' },
    });
  };

  return (
    <View className="gap-3 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">Lead</Text>
        <View className="flex-row items-center gap-2">
          {hasLead ? (
            <Pressable
              onPress={() => pickerRef.current?.open()}
              hitSlop={8}
              className="flex-row items-center gap-1 rounded-full border border-border px-2.5 py-1 active:opacity-70"
            >
              <Icon name="RefreshCw" size={12} color={mutedFg} />
              <Text className="text-xs font-medium text-muted-foreground">Reassign</Text>
            </Pressable>
          ) : null}
          <Badge variant={hasLead ? 'successSoft' : 'mutedSoft'}>
            <Text>{hasLead ? 'Assigned' : 'Unassigned'}</Text>
          </Badge>
        </View>
      </View>

      {hasLead ? (
        <>
          {isFetching && !lead ? (
            <Text className="text-sm text-muted-foreground">Loading lead…</Text>
          ) : null}
          {!isFetching && !lead ? (
            <Text className="text-sm text-muted-foreground">Lead details unavailable</Text>
          ) : null}
          {lead ? <LeadDetails lead={lead} /> : null}
        </>
      ) : (
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">
            This conversation isn&apos;t linked to a Lead/Owner yet.
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => pickerRef.current?.open()}
              className="flex-1 items-center rounded-lg border border-border py-2.5 active:opacity-70"
            >
              <Text className="text-sm font-medium">Assign to Lead</Text>
            </Pressable>
            <Pressable
              onPress={openCreate}
              className="flex-1 items-center rounded-lg bg-primary py-2.5 active:opacity-80"
            >
              <Text className="text-sm font-medium text-primary-foreground">Create Lead</Text>
            </Pressable>
          </View>
        </View>
      )}

      <LeadPickerSheet
        ref={pickerRef}
        onPick={(id) =>
          assign.mutate(id, {
            onError: () =>
              Alert.alert('Assign failed', 'Could not assign this conversation. Please try again.'),
          })
        }
      />
    </View>
  );
}
