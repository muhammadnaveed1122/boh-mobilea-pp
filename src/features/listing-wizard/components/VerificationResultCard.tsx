import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import type { VerificationDetail } from '../services';

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-xs font-medium text-foreground">{value}</Text>
    </View>
  );
}

export function VerificationResultCard({
  detail,
  verifiedAt,
  verifiedByName,
  providerLabel,
}: Readonly<{
  detail: VerificationDetail;
  verifiedAt: string | null;
  verifiedByName: string | null;
  providerLabel: string;
}>) {
  const brand = useThemeColor('--brand');

  const rows: { label: string; value: string }[] = [];
  if (detail.fullName) rows.push({ label: 'Verified name', value: detail.fullName });
  if (detail.documentType)
    rows.push({ label: 'Document type', value: humanize(detail.documentType) });
  if (detail.issuingCountry)
    rows.push({ label: 'Issuing country', value: detail.issuingCountry.toUpperCase() });
  if (detail.dateOfBirth) rows.push({ label: 'Date of birth', value: detail.dateOfBirth });
  rows.push({ label: 'Provider', value: providerLabel });
  if (verifiedAt) rows.push({ label: 'Verified', value: verifiedAt });
  if (verifiedByName) rows.push({ label: 'Verified by', value: verifiedByName });

  const breakdown = detail.breakdown ?? [];
  const hasExtraction = Boolean(detail.fullName) || Boolean(detail.documentType);

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-1.5">
        <Icon name="ShieldCheck" size={16} color={brand} />
        <Text className="text-sm font-medium text-foreground">Verification result</Text>
      </View>

      <View className="gap-1.5">
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </View>

      {!hasExtraction ? (
        <Text className="text-[11px] text-muted-foreground">
          The provider did not return extracted document details. Review the verification in the
          provider dashboard using the reference below.
        </Text>
      ) : null}

      {breakdown.length > 0 ? (
        <View className="gap-1">
          <Text className="text-[10px] font-medium uppercase text-muted-foreground">Checks</Text>
          {breakdown.map((item) => (
            <View key={item} className="flex-row items-center gap-1.5">
              <Icon name="Check" size={11} color={brand} />
              <Text className="text-[11px] text-muted-foreground">{humanize(item)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {detail.workflowRunId !== undefined || detail.applicantId !== undefined ? (
        <View className="gap-0.5 border-t border-border pt-2">
          <Text className="text-[10px] font-medium text-muted-foreground">Provider reference</Text>
          {detail.workflowRunId !== undefined ? (
            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
              Workflow: {detail.workflowRunId}
            </Text>
          ) : null}
          {detail.applicantId !== undefined ? (
            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
              Applicant: {detail.applicantId}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
