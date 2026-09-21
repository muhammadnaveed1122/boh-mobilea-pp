import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatStamp } from '@/lib/format/date';
import { initials } from '@/lib/format/initials';
import { cn } from '@/lib/utils';
import { InterestType } from '../../constants/lead-enums';
import { useLeadFormContext } from '../../context/LeadFormContext';
import { useLeadPermissions } from '../../hooks/use-lead-permissions';
import type { LeadDetail } from '../../models/lead-detail';
import { PrioritySelector } from '../selectors/PrioritySelector';
import { StatusSelector } from '../selectors/StatusSelector';
import { AssignAgentSheet } from './AssignAgentSheet';
import { DetailRow } from './DetailRow';
import {
  genericLabel,
  leadSourceDisplay,
  personaLabel,
  priorityTokens,
  propertyTypeLabel,
  purposeLabel,
  statusLabel,
} from './labels';
import { getStatusStyle } from './status-styles';

const PLACEHOLDER = '—';
const NA = 'N/A';

type ChannelMeta = NonNullable<LeadDetail['channelMeta']>;

function hasChannelMeta(meta: ChannelMeta | undefined): boolean {
  if (!meta) return false;
  return Boolean(meta.page ?? meta.cta ?? meta.entryPointId);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isValuationLead(lead: LeadDetail): boolean {
  const types = Array.isArray(lead.interestType) ? lead.interestType : [];
  return types.includes(InterestType.GET_VALUATION);
}

function StatusPill({ status }: Readonly<{ status: string }>) {
  const style = getStatusStyle(status);
  return (
    <Badge variant={style.variant} className="px-2.5 py-1">
      <Text>{statusLabel(status)}</Text>
    </Badge>
  );
}

function PriorityPill({ priority }: Readonly<{ priority: string | null | undefined }>) {
  const tokens = priorityTokens(priority);
  if (!tokens) {
    return <Text className="text-sm italic text-muted-foreground">{NA}</Text>;
  }
  return (
    <Badge variant={tokens.variant} className="px-2.5 py-1">
      <Text>{tokens.label}</Text>
    </Badge>
  );
}

/**
 * Status control. Like `AssignedValue`, deliberately live outside the card's
 * Edit mode: a stage change is its own write (`PATCH /leads/:id { status, note }`
 * via `StageNoteSheet`), not part of the form save — so the badge is tappable
 * whenever the user has update rights, matching the browse-list "Move stage"
 * action.
 */
function StatusValue({ lead, canUpdate }: Readonly<{ lead: LeadDetail; canUpdate: boolean }>) {
  if (canUpdate) return <StatusSelector leadId={lead.id} value={String(lead.status)} />;
  return <StatusPill status={String(lead.status)} />;
}

function PriorityValue({ lead, editable }: Readonly<{ lead: LeadDetail; editable: boolean }>) {
  if (editable) return <PrioritySelector leadId={lead.id} value={lead.priority ?? null} />;
  return <PriorityPill priority={lead.priority} />;
}

/**
 * Assignment control. Mirrors web's sidebar "Assigned" row: the assignee's
 * avatar + name opens the picker (reassign), an outline button offers the first
 * assignment. Deliberately live outside the card's Edit mode — assigning is its
 * own write (`PATCH /leads/:id { assigneeId }`), not part of the form save.
 */
function AssignedValue({
  lead,
  canAssign,
  onPress,
}: Readonly<{ lead: LeadDetail; canAssign: boolean; onPress: () => void }>) {
  const { assignee } = lead;

  if (!assignee) {
    if (!canAssign) return <Text className="text-sm italic text-muted-foreground">Unassigned</Text>;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Assign agent"
        className="min-h-9 flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5 active:opacity-70"
      >
        <Icon name="UserPlus" size={14} />
        <Text className="text-sm font-semibold text-foreground">Assign Agent</Text>
      </Pressable>
    );
  }

  const name = `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email;
  const photo = assignee.profile?.profilePicUrl ?? assignee.agentProfile?.photoUrl ?? null;
  const content = (
    <View className="min-h-9 flex-row items-center gap-2">
      <Avatar alt={name} className="h-7 w-7 bg-brand-muted">
        {photo ? <AvatarImage source={{ uri: photo }} /> : null}
        <AvatarFallback className="bg-brand-muted">
          <Text className="text-[10px] font-semibold text-foreground">{initials(name)}</Text>
        </AvatarFallback>
      </Avatar>
      <Text
        className={cn(
          'flex-shrink text-sm font-semibold text-foreground',
          canAssign && 'underline',
        )}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );

  if (!canAssign) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Reassign lead, currently assigned to ${name}`}
      className="active:opacity-70"
    >
      {content}
    </Pressable>
  );
}

function NaText({ children }: Readonly<{ children: string | null | undefined }>) {
  if (!children) return <Text className="text-sm italic text-muted-foreground">{NA}</Text>;
  return <Text className="text-sm font-semibold text-foreground">{children}</Text>;
}

function ChannelValue({
  text,
  hasMeta,
  isExpanded,
  onToggle,
}: Readonly<{
  text: string | null;
  hasMeta: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  if (!text) return <Text className="text-sm italic text-muted-foreground">{NA}</Text>;
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-right text-sm font-semibold text-foreground" numberOfLines={2}>
        {text}
      </Text>
      {hasMeta ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Hide channel metadata' : 'Show channel metadata'}
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={8}
          className="p-0.5 active:opacity-60"
        >
          <Icon name={isExpanded ? 'Eye' : 'EyeOff'} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ChannelMetaPanel({ meta }: Readonly<{ meta: ChannelMeta }>) {
  const openPage = () => {
    if (meta.page && isHttpUrl(meta.page)) {
      Linking.openURL(meta.page).catch(() => {});
    }
  };
  return (
    <View className="mt-2 rounded-xl border border-border bg-muted/40 p-3">
      {meta.page ? (
        <View className="mb-1.5 flex-row flex-wrap">
          <Text className="text-xs text-muted-foreground">Page: </Text>
          {isHttpUrl(meta.page) ? (
            <Pressable onPress={openPage} hitSlop={4}>
              <Text className="text-xs text-foreground underline">{meta.page}</Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-foreground">{meta.page}</Text>
          )}
        </View>
      ) : null}
      {meta.cta ? (
        <View className="mb-1.5 flex-row flex-wrap">
          <Text className="text-xs text-muted-foreground">CTA: </Text>
          <Text className="text-xs text-foreground">{meta.cta}</Text>
        </View>
      ) : null}
      {meta.entryPointId ? (
        <View className="flex-row flex-wrap">
          <Text className="text-xs text-muted-foreground">Entry point ID: </Text>
          <Text className="text-xs text-foreground">{meta.entryPointId}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MessageBlock({
  title,
  body,
  timestamp,
}: Readonly<{ title: string; body: string; timestamp: string | null }>) {
  return (
    <View className="mt-4 rounded-xl bg-muted/50 p-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {timestamp ? <Text className="mt-1 text-xs text-muted-foreground">{timestamp}</Text> : null}
      <Text className="mt-2 text-sm leading-5 text-foreground">{body}</Text>
    </View>
  );
}

export interface InitialLeadDetailsCardProps {
  lead: LeadDetail;
}

/**
 * Lead-detail summary card. Mirrors web `LeadDetailsSection`:
 * Status · Channel (w/ meta toggle) · Persona · Purpose · Property Type/Use ·
 * Priority, plus Initial Message and System Message blocks beneath.
 */
export function InitialLeadDetailsCard({ lead }: Readonly<InitialLeadDetailsCardProps>) {
  // canViewContact retained for any future row-level masking; channel masking
  // moved to a content-meta toggle per design.
  const { canUpdate, canAssign } = useLeadPermissions(lead);
  const { isEditing } = useLeadFormContext();
  const editable = isEditing && canUpdate;
  const [isChannelMetaVisible, setIsChannelMetaVisible] = useState(false);
  const [isAssignSheetOpen, setIsAssignSheetOpen] = useState(false);

  const channelText = leadSourceDisplay(lead) ?? genericLabel(lead.channel);
  const channelMetaPresent = hasChannelMeta(lead.channelMeta);
  const interestValue = typeof lead.interest === 'string' ? lead.interest : null;
  const persona = personaLabel(interestValue);
  const firstPurpose = Array.isArray(lead.interestType) ? lead.interestType[0] : undefined;
  const purposeValue = typeof firstPurpose === 'string' ? firstPurpose : null;
  const purpose = purposeLabel(purposeValue);
  const isValuation = isValuationLead(lead);
  const propertyHeader = isValuation ? 'Property Use' : 'Property Type';
  const propertyTypeRaw = typeof lead.propertyType === 'string' ? lead.propertyType : null;
  const propertyTypeText = propertyTypeLabel(propertyTypeRaw);
  const propertyUseRaw = typeof lead.leadPropertyUse === 'string' ? lead.leadPropertyUse : null;
  const propertyUseText = genericLabel(propertyUseRaw);
  const propertyValue = isValuation ? (propertyUseText ?? propertyTypeText) : propertyTypeText;

  const initialMessage = lead.additionalNotes ?? lead.notes ?? null;
  const systemMessage = lead.initialEnquiry?.message ?? null;
  const initialMessageStamp = formatStamp(lead.createdAt) || null;
  const systemMessageStamp = lead.initialEnquiry?.timestamp
    ? formatStamp(lead.initialEnquiry.timestamp) || null
    : null;

  return (
    <View className="rounded-2xl bg-card p-4 shadow-sm">
      <Text className="text-base font-semibold text-brand">Initial Lead Details</Text>

      <View className="mt-3 overflow-hidden rounded-xl">
        <DetailRow label="Status">
          <StatusValue lead={lead} canUpdate={canUpdate} />
        </DetailRow>
        <DetailRow label="Channel">
          <ChannelValue
            text={channelText}
            hasMeta={channelMetaPresent}
            isExpanded={isChannelMetaVisible}
            onToggle={() => setIsChannelMetaVisible((v) => !v)}
          />
        </DetailRow>
        {isChannelMetaVisible && channelMetaPresent && lead.channelMeta ? (
          <View className="border-b border-border/40 pb-3">
            <ChannelMetaPanel meta={lead.channelMeta} />
          </View>
        ) : null}
        <DetailRow label="Persona">
          <NaText>{persona}</NaText>
        </DetailRow>
        <DetailRow label="Purpose">
          <NaText>{purpose}</NaText>
        </DetailRow>
        <DetailRow label={propertyHeader}>
          <NaText>{propertyValue}</NaText>
        </DetailRow>
        <DetailRow label="Priority">
          <PriorityValue lead={lead} editable={editable} />
        </DetailRow>
        <DetailRow label="Assigned" last>
          <AssignedValue
            lead={lead}
            canAssign={canAssign}
            onPress={() => setIsAssignSheetOpen(true)}
          />
        </DetailRow>
      </View>

      <AssignAgentSheet
        leadId={lead.id}
        currentAssignee={lead.assignee}
        visible={isAssignSheetOpen}
        onClose={() => setIsAssignSheetOpen(false)}
      />

      {initialMessage ? (
        <MessageBlock
          title="Initial Message"
          body={initialMessage}
          timestamp={initialMessageStamp}
        />
      ) : null}
      {systemMessage ? (
        <MessageBlock title="System Message" body={systemMessage} timestamp={systemMessageStamp} />
      ) : null}

      {initialMessage || systemMessage ? null : (
        <Text className="mt-4 text-sm italic text-muted-foreground">{PLACEHOLDER}</Text>
      )}
    </View>
  );
}
