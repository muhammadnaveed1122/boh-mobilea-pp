/**
 * HeroHeaderCard — top hero card on the Lead Detail screen.
 *
 * Static deep-navy gradient (intentionally not theme-driven so dark mode
 * doesn't recolour the hero). Avatar + name + masked contacts on the left,
 * priority chip top-right, call + WhatsApp action buttons bottom-right,
 * created-at stamp bottom-left.
 */

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useHasCallingExtension } from '@/features/callService/hooks/use-sip-config';
import { getCallController } from '@/features/callService/services/call-controller';
import { maskEmail, maskPhone } from '@/lib/contact-mask';
import { formatDate, formatTime } from '@/lib/format/date';
import { initials as computeInitials } from '@/lib/format/initials';

import type { LeadDetail } from '../../models/lead-detail';
import { CallComingSoonDialog } from '../CallComingSoonDialog';

const PLACEHOLDER = '—';

// Static gradient — intentionally hardcoded so dark mode doesn't change it.
// Derived from the brand/primary token (rgb 16 24 39 = #101827):
// lighter tint → primary → shade.
const HERO_GRADIENT_COLORS: readonly [string, string, string] = ['#26324F', '#101827', '#080C16'];

const CALL_ICON_COLOR = '#FFFFFF';
const WHATSAPP_ICON_COLOR = '#22C55E';

interface PriorityStyle {
  readonly variant: NonNullable<BadgeProps['variant']>;
  readonly label: string;
}

const PRIORITY_STYLES: Readonly<Record<string, PriorityStyle>> = {
  hot: { variant: 'destructiveSoft', label: 'Hot' },
  warm: { variant: 'warningSoft', label: 'Warm' },
  cold: { variant: 'infoSoft', label: 'Cold' },
};

function getPriorityStyle(value: string | null | undefined): PriorityStyle | null {
  if (!value) return null;
  const normalised = value.toString().trim().toLowerCase();
  return PRIORITY_STYLES[normalised] ?? null;
}

function formatCreatedAt(value: string | null | undefined): string {
  const datePart = formatDate(value);
  if (!datePart) return PLACEHOLDER;
  const timePart = formatTime(value);
  return timePart ? `${datePart}  |  ${timePart}` : datePart;
}

function PriorityChip({ priority }: Readonly<{ priority: string | null | undefined }>) {
  const style = getPriorityStyle(priority);
  if (!style) return null;
  return (
    <Badge variant={style.variant} className="px-3 py-1">
      <Text>{style.label}</Text>
    </Badge>
  );
}

interface ActionButtonProps {
  iconName: 'Phone' | 'MessageCircle';
  iconColor: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function ActionButton({
  iconName,
  iconColor,
  label,
  disabled,
  onPress,
}: Readonly<ActionButtonProps>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/15 active:opacity-70"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={iconName} size={20} color={iconColor} />
    </Pressable>
  );
}

export interface HeroHeaderCardProps {
  lead: LeadDetail;
  canViewContact: boolean;
  canCall: boolean;
  canChat: boolean;
}

export function HeroHeaderCard({
  lead,
  canViewContact,
  canCall: canCallLead,
  canChat: canChatLead,
}: Readonly<HeroHeaderCardProps>) {
  const initials = useMemo(() => computeInitials(lead.name), [lead.name]);
  const [callComingSoon, setCallComingSoon] = useState(false);
  const canCall = useHasCallingExtension();

  const emailDisplay = canViewContact ? lead.email : (maskEmail(lead.email) ?? lead.email);
  const phoneDisplay = canViewContact ? lead.phone : (maskPhone(lead.phone) ?? lead.phone);
  const hasPhone = Boolean(lead.phone);
  const hasContact = Boolean(lead.phone) || Boolean(lead.email);

  return (
    <LinearGradient
      colors={HERO_GRADIENT_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 16 }}
    >
      <View className="p-5">
        <View className="flex-row items-start">
          <Avatar alt={lead.name} className="mr-3 h-14 w-14">
            <AvatarFallback className="bg-white/15" textClassName="text-lg font-bold text-white">
              <Text>{initials}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              {lead.name}
            </Text>
            {emailDisplay ? (
              <Text className="mt-0.5 text-sm text-white/70" numberOfLines={1}>
                {emailDisplay}
              </Text>
            ) : null}
            {phoneDisplay ? (
              <Text className="mt-0.5 text-sm font-medium text-white">{phoneDisplay}</Text>
            ) : null}
          </View>
          <PriorityChip priority={lead.priority} />
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xs text-white/70">{formatCreatedAt(lead.createdAt)}</Text>
          <View className="flex-row gap-2">
            {canCallLead ? (
              <ActionButton
                iconName="Phone"
                iconColor={CALL_ICON_COLOR}
                label="Call lead"
                disabled={!hasPhone}
                onPress={() => {
                  if (!hasPhone) return;
                  if (!canCall) {
                    setCallComingSoon(true);
                    return;
                  }
                  getCallController().makeCall(lead.phone, lead.name, lead.id);
                }}
              />
            ) : null}
            {canChatLead ? (
              <ActionButton
                iconName="MessageCircle"
                iconColor={WHATSAPP_ICON_COLOR}
                label="Open lead conversation"
                disabled={!hasContact}
                onPress={() =>
                  router.push({
                    pathname: '/chat/lead/[leadId]',
                    params: {
                      leadId: lead.id,
                      phone: lead.phone ?? '',
                      name: lead.name,
                      email: lead.email ?? '',
                    },
                  })
                }
              />
            ) : null}
          </View>
        </View>
      </View>

      <CallComingSoonDialog visible={callComingSoon} onClose={() => setCallComingSoon(false)} />
    </LinearGradient>
  );
}
