import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useIdentityVerification } from '../hooks/use-identity-verification';
import type { LeadContact } from '../hooks/use-lead-identity';
import type { LeadDocument, VerificationProvider } from '../services';
import { VerificationResultCard } from './VerificationResultCard';

const PROVIDER_LABEL: Record<VerificationProvider, string> = {
  ENTRUST: 'Entrust',
  UAEPASS: 'UAE Pass',
};

export interface IdentityLinkTabProps {
  leadId: string;
  latestDoc: LeadDocument | null;
  contact: LeadContact;
  isLinkVerified: boolean;
  isManualVerified: boolean;
  isAlreadyVerified: boolean;
  onRefetch: () => Promise<void>;
}

function generateLabel(isAlreadyVerified: boolean, hasGenerated: boolean): string {
  if (isAlreadyVerified) return 'Reset & Regenerate';
  if (hasGenerated) return 'Link Generated';
  return 'Generate Verification Link';
}

function waHref(phone: string | null, link: string): string | undefined {
  const digits = phone?.replace(/\D/g, '');
  if (!digits) return undefined;
  const msg = `Please complete your identity verification using this secure link: ${link}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

function mailHref(email: string | null, link: string): string | undefined {
  if (!email) return undefined;
  const subject = 'Complete your identity verification';
  const body = `Please complete your identity verification using this secure link:\n\n${link}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function IdentityLinkTab({
  leadId,
  latestDoc,
  contact,
  isLinkVerified,
  isManualVerified,
  isAlreadyVerified,
  onRefetch,
}: Readonly<IdentityLinkTabProps>) {
  const brand = useThemeColor('--brand');
  const brandFg = useThemeColor('--brand-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const { generateLink, shareLink, isBusy } = useIdentityVerification();

  const [provider, setProvider] = useState<VerificationProvider>('ENTRUST');
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);

  const hasGenerated = link !== null;

  const doGenerate = async (reset: boolean) => {
    try {
      const res = await generateLink(leadId, provider, reset);
      setLink(res);
      await onRefetch();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not generate link.');
    }
  };

  const onGenerate = () => {
    if (isManualVerified) return;
    if (isAlreadyVerified) {
      Alert.alert(
        'Reset verification?',
        'This clears the current verified result and generates a new verification link. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: () => void doGenerate(true) },
        ],
      );
      return;
    }
    void doGenerate(false);
  };

  const copy = async () => {
    if (link === null) return;
    await Clipboard.setStringAsync(link.url);
    showToast('success', 'Verification link copied');
  };

  const share = async (mode: 'WHATSAPP' | 'EMAIL') => {
    if (link === null) return;
    const href =
      mode === 'WHATSAPP' ? waHref(contact.phone, link.url) : mailHref(contact.email, link.url);
    if (href === undefined) {
      showToast(
        'error',
        mode === 'WHATSAPP' ? 'No phone for this owner.' : 'No email for this owner.',
      );
      return;
    }
    try {
      await Linking.openURL(href);
      await shareLink(leadId, link.id, mode);
    } catch {
      showToast('error', 'Could not open share.');
    }
  };

  return (
    <View className="gap-4">
      {/* Provider */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setProvider('ENTRUST')}
          accessibilityRole="button"
          accessibilityState={{ selected: provider === 'ENTRUST' }}
          accessibilityLabel="Entrust provider"
          className={cn(
            'flex-1 items-center rounded-lg border px-3 py-2.5',
            provider === 'ENTRUST' ? 'border-brand bg-brand/10' : 'border-border bg-background',
          )}
        >
          <Text
            className={cn(
              'text-sm font-medium',
              provider === 'ENTRUST' ? 'text-brand' : 'text-foreground',
            )}
          >
            Entrust
          </Text>
        </Pressable>
        <View
          accessibilityState={{ disabled: true }}
          className="flex-1 items-center rounded-lg border border-border bg-muted px-3 py-2 opacity-50"
        >
          <Text className="text-sm font-medium text-muted-foreground">UAE Pass</Text>
          <Text className="text-[10px] text-muted-foreground">Coming soon</Text>
        </View>
      </View>

      {isManualVerified ? (
        <View className="flex-row items-center gap-1.5 rounded-xl border border-border bg-card p-3">
          <Icon name="ShieldCheck" size={16} color={brand} />
          <Text className="flex-1 text-xs text-muted-foreground">
            Verified via Manual Review. Manage it from the Manual Review tab.
          </Text>
        </View>
      ) : (
        <Button
          onPress={onGenerate}
          disabled={isBusy || (hasGenerated && !isAlreadyVerified)}
          loading={isBusy}
        >
          <Text>{generateLabel(isAlreadyVerified, hasGenerated)}</Text>
        </Button>
      )}

      {/* Generated-link card */}
      {hasGenerated ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-3">
          <Text className="text-xs font-medium text-muted-foreground">Verification Link</Text>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {link?.url}
            </Text>
            <Pressable
              onPress={() => void copy()}
              accessibilityRole="button"
              accessibilityLabel="Copy verification link"
              className="flex-row items-center gap-1 rounded-full bg-brand px-3 py-1.5 active:opacity-80"
              hitSlop={8}
            >
              <Icon name="Copy" size={12} color={brandFg} />
              <Text className="text-xs font-medium" style={{ color: brandFg }}>
                Copy
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-muted-foreground">Share via:</Text>
            <Pressable
              onPress={() => void share('WHATSAPP')}
              accessibilityRole="button"
              accessibilityLabel="Share via WhatsApp"
              className="h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-80"
              hitSlop={8}
            >
              <Icon name="MessageCircle" size={16} color={brand} />
            </Pressable>
            <Pressable
              onPress={() => void share('EMAIL')}
              accessibilityRole="button"
              accessibilityLabel="Share via Email"
              className="h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-80"
              hitSlop={8}
            >
              <Icon name="Mail" size={16} color={brand} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Status badge */}
      <View className="flex-row items-center gap-2">
        {isAlreadyVerified ? (
          <View className="flex-row items-center gap-1">
            <Icon name="CircleCheck" size={14} color={brand} />
            <Text className="text-xs font-medium" style={{ color: brand }}>
              Verified
            </Text>
          </View>
        ) : hasGenerated ? (
          <View className="flex-row items-center gap-1">
            <Icon name="Clock" size={14} color={mutedFg} />
            <Text className="text-xs text-muted-foreground">Pending Verification</Text>
          </View>
        ) : null}
        <View className="flex-1" />
        <Pressable
          onPress={() => void onRefetch()}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Refresh verification status"
          hitSlop={8}
        >
          <Text className="text-xs font-medium text-brand">Refresh status</Text>
        </Pressable>
      </View>

      {isLinkVerified && latestDoc?.verificationDetail ? (
        <VerificationResultCard
          detail={latestDoc.verificationDetail}
          verifiedAt={latestDoc.verifiedAt}
          verifiedByName={
            latestDoc.verifiedBy
              ? `${latestDoc.verifiedBy.firstName} ${latestDoc.verifiedBy.lastName}`.trim()
              : null
          }
          providerLabel={PROVIDER_LABEL[provider]}
        />
      ) : null}
    </View>
  );
}
