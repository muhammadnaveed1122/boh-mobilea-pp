/**
 * StartConversation — shown when a lead has no conversation/messages yet.
 * Lets the user choose a channel: WhatsApp (→ TemplatePicker, since the first
 * WhatsApp message must be an approved template) or Email (→ LeadEmailComposer,
 * which can send directly). Either path bootstraps the conversation; the gate
 * then re-resolves into the full ConversationScreen.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { CHAT_WRITE, useCan } from '@/lib/rbac';

import { LeadEmailComposer } from './LeadEmailComposer';
import { TemplatePicker } from './TemplatePicker';

interface StartConversationProps {
  leadId: string;
  leadName: string;
  phone: string;
  email: string;
}

type Mode = 'choose' | 'whatsapp' | 'email';

interface ChannelOptionProps {
  icon: 'MessageCircle' | 'Mail';
  title: string;
  subtitle: string;
  disabled: boolean;
  onPress: () => void;
}

function ChannelOption({ icon, title, subtitle, disabled, onPress }: Readonly<ChannelOptionProps>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="flex-row items-center gap-3 rounded-2xl bg-card p-4 active:opacity-80"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon name={icon} size={20} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text variant="muted" className="text-xs">
          {subtitle}
        </Text>
      </View>
      <Icon name="ChevronRight" size={18} />
    </Pressable>
  );
}

export function StartConversation({
  leadId,
  leadName,
  phone,
  email,
}: Readonly<StartConversationProps>) {
  const canWrite = useCan(CHAT_WRITE);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');

  if (!canWrite) {
    return (
      <EmptyState
        icon="Lock"
        title="No send permission"
        description="You don't have permission to start a conversation with this lead."
      />
    );
  }

  if (mode === 'whatsapp') {
    return (
      <View className="flex-1">
        <Pressable
          onPress={() => setMode('choose')}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="flex-row items-center gap-1 px-4 pt-4 active:opacity-70"
        >
          <Icon name="ChevronLeft" size={18} />
          <Text className="text-sm font-medium text-foreground">Back</Text>
        </Pressable>
        <TemplatePicker leadId={leadId} leadName={leadName} phone={phone} />
      </View>
    );
  }

  if (mode === 'email') {
    return <LeadEmailComposer leadId={leadId} email={email} onBack={() => setMode('choose')} />;
  }

  return (
    <View className="flex-1 gap-3 p-4">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="-ml-1 flex-row items-center gap-1 self-start active:opacity-70"
      >
        <Icon name="ChevronLeft" size={18} />
        <Text className="text-sm font-medium text-foreground">Back</Text>
      </Pressable>
      <View>
        <Text variant="subheading">Start the conversation</Text>
        <Text variant="muted">Choose how to reach out to this lead.</Text>
      </View>
      <ChannelOption
        icon="MessageCircle"
        title="Message on WhatsApp"
        subtitle={phone ? 'Send an approved template' : 'No phone number on record'}
        disabled={!phone}
        onPress={() => setMode('whatsapp')}
      />
      <ChannelOption
        icon="Mail"
        title="Send an email"
        subtitle={email ? email : 'No email address on record'}
        disabled={!email}
        onPress={() => setMode('email')}
      />
    </View>
  );
}
