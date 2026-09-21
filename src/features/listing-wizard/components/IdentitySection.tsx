import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';

import { useLeadIdentity } from '../hooks/use-lead-identity';
import { IdentityLinkTab } from './IdentityLinkTab';
import { IdentityManualTab } from './IdentityManualTab';
import { MethodToggle, type IdentityMethod } from './MethodToggle';

export function IdentitySection({ leadId }: Readonly<{ leadId: string }>) {
  const { latestDoc, contact, refetch } = useLeadIdentity(leadId);

  const isAlreadyVerified = latestDoc?.verificationStatus === 'VERIFIED';
  const isLinkVerified = isAlreadyVerified && latestDoc?.verificationMethod === 'LINK';
  const isManualVerified = isAlreadyVerified && !isLinkVerified;
  // A real manual document (has a file) → default to the Manual tab; otherwise the Link tab.
  const hasManualDoc =
    latestDoc !== null && !(latestDoc.verificationMethod === 'LINK' && latestDoc.fileUrl === '');

  const [method, setMethod] = useState<IdentityMethod>('link');
  // Seed the default tab once from the hydrated document (manual doc → manual tab).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && latestDoc !== null) {
      setSeeded(true);
      if (hasManualDoc && !isLinkVerified) setMethod('manual');
    }
  }, [seeded, latestDoc, hasManualDoc, isLinkVerified]);

  return (
    <View className="gap-3 rounded-xl border border-border bg-background p-3">
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Identity Verification</Text>
        <Text className="text-xs text-muted-foreground">
          Complete identity verification with either Passport or Emirates ID.
        </Text>
      </View>

      <MethodToggle value={method} onChange={setMethod} />

      {method === 'link' ? (
        <IdentityLinkTab
          leadId={leadId}
          latestDoc={latestDoc}
          contact={contact}
          isLinkVerified={isLinkVerified}
          isManualVerified={isManualVerified}
          isAlreadyVerified={isAlreadyVerified}
          onRefetch={refetch}
        />
      ) : (
        <IdentityManualTab
          leadId={leadId}
          latestDoc={latestDoc}
          isLinkVerified={isLinkVerified}
          onRefetch={refetch}
        />
      )}
    </View>
  );
}
