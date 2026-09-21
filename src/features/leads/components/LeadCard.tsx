import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useHasCallingExtension } from '@/features/callService/hooks/use-sip-config';
import { getCallController } from '@/features/callService/services/call-controller';
import { initials } from '@/lib/format/initials';
import { maskEmail, maskPhone } from '@/lib/contact-mask';
import { cn } from '@/lib/utils';
import { CHAT_READ, PERMISSIONS, useCan } from '@/lib/rbac';
import { assigneeAvatarUrl, assigneeName } from '../assignee';
import { useCanViewLeadContact } from '../hooks/use-can-view-lead-contact';
import {
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type LeadListItem,
} from '../types';
import { CallComingSoonDialog } from './CallComingSoonDialog';
import { channelIcon, genericLabel, leadSourceDisplay } from './lead-detail/labels';

function leadDisplayName(lead: LeadListItem): string {
  return lead.name ?? lead.email ?? lead.phone ?? 'Unnamed lead';
}

/**
 * Who owns the lead. Sits on its own row under the identity block so the name/status
 * hierarchy stays intact; unassigned reads as a muted dashed pill rather than a badge,
 * so it looks like a gap to fill instead of a status.
 */
function LeadAssigneeRow({ lead }: Readonly<{ lead: LeadListItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const agent = assigneeName(lead.assignee);
  const photo = assigneeAvatarUrl(lead.assignee);

  if (!agent) {
    return (
      <View className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-full border border-dashed border-border px-2 py-1">
        <Icon name="UserPlus" size={12} color={mutedFg} />
        <Text className="text-xs text-muted-foreground">Unassigned</Text>
      </View>
    );
  }

  return (
    <View className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-full bg-muted px-2 py-1">
      <Avatar alt={agent} className="h-5 w-5 bg-brand-muted">
        {photo ? <AvatarImage source={{ uri: photo }} /> : null}
        <AvatarFallback className="bg-brand-muted">
          <Text className="text-[9px] font-semibold text-foreground">{initials(agent)}</Text>
        </AvatarFallback>
      </Avatar>
      <Text className="text-xs text-muted-foreground">Assigned to</Text>
      <Text className="max-w-[140px] text-xs font-medium text-foreground" numberOfLines={1}>
        {agent}
      </Text>
    </View>
  );
}

/**
 * Name row, plus the "Primary Plus" badge for a Property Finder project enquiry — the premium
 * lead product, far more expensive than a standard portal lead. Flagged red so it is unmissable
 * in a long list; otherwise it looks identical to any other PropertyFinder row (matches web).
 */
function LeadCardName({ lead, name }: Readonly<{ lead: LeadListItem; name: string }>) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="shrink text-sm font-semibold text-foreground" numberOfLines={1}>
        {name}
      </Text>
      {lead.isNewProject === true ? (
        <Badge variant="destructiveSoft" className="shrink-0 px-2 py-0">
          <Text className="text-[10px]">Primary Plus</Text>
        </Badge>
      ) : null}
    </View>
  );
}

/** Footer-left meta: acquisition source (icon + label) + intent badge. */
function LeadCardMeta({ lead }: Readonly<{ lead: LeadListItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const source = genericLabel(lead.channel);
  const intent = leadSourceDisplay(lead);

  return (
    <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
      {source ? (
        <View className="flex-row items-center gap-1">
          <Icon name={channelIcon(lead.channel)} size={13} color={mutedFg} />
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {source}
          </Text>
        </View>
      ) : null}
      {intent ? (
        <Badge variant="secondary">
          <Text>{intent}</Text>
        </Badge>
      ) : null}
    </View>
  );
}

export function LeadCard({
  lead,
  onKebab,
}: Readonly<{ lead: LeadListItem; onKebab?: (lead: LeadListItem) => void }>) {
  const [callComingSoon, setCallComingSoon] = useState(false);
  const canCall = useHasCallingExtension();
  const canCallLead = useCan([PERMISSIONS.CALLS_READ, PERMISSIONS.CALLS_CREATE]);
  // Gate on read/write of either chat channel (the perm the /chat/lead route guard
  // and backend by-lead/send endpoints actually require). leads:chat is seeded
  // but enforced nowhere on the backend, so it must not gate this button.
  const canChatLead = useCan(CHAT_READ);
  const canViewContact = useCanViewLeadContact();
  const brand = useThemeColor('--brand');
  const success = useThemeColor('--success');
  const name = leadDisplayName(lead);
  const email = canViewContact ? (lead.email ?? null) : maskEmail(lead.email);
  const phone = canViewContact ? (lead.phone ?? null) : maskPhone(lead.phone);
  const statusVariant = STATUS_BADGE_VARIANT[lead.status];
  const priorityVariant = lead.priority ? PRIORITY_BADGE_VARIANT[lead.priority] : null;

  return (
    <Pressable
      onPress={() => router.push(`/leads/${lead.id}`)}
      // Primary Plus (PF new-project) leads cost far more, so the whole card is tinted with a red
      // left accent — matching web's row/card highlight — to make them unmissable in a long list.
      className={cn(
        'rounded-2xl bg-card p-3 active:opacity-80',
        lead.isNewProject === true && 'border-l-[3px] border-l-destructive bg-destructive/[0.06]',
      )}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <View className="flex-row items-start">
        <View className="relative mr-3">
          <Avatar alt={name} className="h-12 w-12 bg-brand-muted">
            <AvatarFallback className="bg-brand-muted">
              <Text className="text-foreground">{initials(name)}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </View>

        <View className="flex-1 pr-2">
          <LeadCardName lead={lead} name={name} />
          {email ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {phone ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {phone}
            </Text>
          ) : null}
        </View>

        <View className="items-end gap-1.5">
          <Badge variant={statusVariant}>
            <Text>{STATUS_LABEL[lead.status]}</Text>
          </Badge>
          {priorityVariant && lead.priority ? (
            <Badge variant={priorityVariant}>
              <Text>{PRIORITY_LABEL[lead.priority]}</Text>
            </Badge>
          ) : null}
        </View>
      </View>

      <LeadAssigneeRow lead={lead} />

      <View className="mt-3 flex-row items-center justify-between border-t border-border/60 pt-3">
        <LeadCardMeta lead={lead} />

        <View className="flex-row gap-2">
          {canCallLead ? (
            <Pressable
              onPress={() => {
                if (!lead.phone) return;
                if (!canCall) {
                  setCallComingSoon(true);
                  return;
                }
                getCallController().makeCall(lead.phone, name, lead.id);
              }}
              disabled={!lead.phone}
              accessibilityLabel="Call lead"
              className="h-9 w-9 items-center justify-center rounded-xl bg-brand-muted active:opacity-70"
              style={{ opacity: lead.phone ? 1 : 0.4 }}
            >
              <Icon name="Phone" size={16} color={brand} />
            </Pressable>
          ) : null}
          {canChatLead ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/chat/lead/[leadId]',
                  params: {
                    leadId: lead.id,
                    phone: lead.phone ?? '',
                    name,
                    email: lead.email ?? '',
                  },
                })
              }
              disabled={!lead.phone && !lead.email}
              accessibilityLabel="Open lead conversation"
              className="h-9 w-9 items-center justify-center rounded-xl bg-success/15 active:opacity-70"
              style={{ opacity: lead.phone || lead.email ? 1 : 0.4 }}
            >
              <Icon name="MessageCircle" size={16} color={success} />
            </Pressable>
          ) : null}
          {onKebab ? (
            <Pressable
              onPress={() => onKebab(lead)}
              accessibilityRole="button"
              accessibilityLabel="Lead actions"
              className="h-9 w-9 items-center justify-center rounded-xl bg-muted active:opacity-70"
            >
              <Icon name="EllipsisVertical" size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <CallComingSoonDialog visible={callComingSoon} onClose={() => setCallComingSoon(false)} />
    </Pressable>
  );
}
