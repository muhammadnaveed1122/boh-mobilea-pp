import * as React from 'react';
import { View } from 'react-native';
import { useThemeColor } from '@theme';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApprovalRequestDetail, ApprovalStep, ApprovalStepApprover } from '../models/approval';

type SoftBadgeVariant = 'successSoft' | 'infoSoft' | 'destructiveSoft' | 'mutedSoft';

/** Step-level badge: what the whole level is doing right now. */
function stepBadge(step: ApprovalStep): { label: string; variant: SoftBadgeVariant } {
  if (step.status === 'approved') return { label: 'Approved', variant: 'successSoft' };
  if (step.status === 'changes_requested') {
    return { label: 'Requested changes', variant: 'destructiveSoft' };
  }
  if (step.isCurrent) return { label: 'Awaiting decision', variant: 'infoSoft' };
  return { label: 'Upcoming', variant: 'mutedSoft' };
}

function SoftBadge({ label, variant }: Readonly<{ label: string; variant: SoftBadgeVariant }>) {
  return (
    <Badge variant={variant}>
      <Text>{label}</Text>
    </Badge>
  );
}

/**
 * Per-approver right-side indicator. Reflects each approver's INDIVIDUAL decision so an
 * And-Sign level still awaiting other sign-offs shows the ones who already approved as
 * ticked (not all stuck on "Awaiting decision"). Mirrors the web ApproverIndicator.
 */
function ApproverIndicator({
  step,
  approver,
}: Readonly<{ step: ApprovalStep; approver: ApprovalStepApprover }>) {
  const success = useThemeColor('--success');
  const muted = useThemeColor('--muted-foreground');

  if (approver.decision === 'approved') {
    return <Icon name="CircleCheck" size={20} color={success} fill={success} />;
  }
  if (approver.decision === 'changes_requested') {
    return <SoftBadge label="Requested changes" variant="destructiveSoft" />;
  }
  // Level resolved by someone else without THIS approver acting — their sign-off was no
  // longer required, so show a neutral "Not needed" rather than the step's outcome.
  if (step.status === 'approved' || step.status === 'changes_requested') {
    return (
      <View className="flex-row items-center gap-1.5">
        <Icon name="CircleMinus" size={18} color={muted} />
        <Text className="text-xs text-muted-foreground">Not needed</Text>
      </View>
    );
  }
  const badge = stepBadge(step);
  return <SoftBadge label={badge.label} variant={badge.variant} />;
}

/** One avatar chip + name/subtitle + trailing indicator row. */
function ChainRow({
  chipClassName,
  icon,
  iconColor,
  title,
  subtitle,
  highlighted,
  dimmed,
  showNext,
  trailing,
}: Readonly<{
  chipClassName: string;
  icon: 'Flag' | 'User';
  iconColor: string;
  title: string;
  subtitle: string;
  highlighted?: boolean;
  dimmed?: boolean;
  showNext?: boolean;
  trailing: React.ReactNode;
}>) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-xl border px-3 py-2.5',
        highlighted ? 'border-warning bg-warning/10' : 'border-border',
        dimmed && 'opacity-60',
      )}
    >
      <View className={cn('h-8 w-8 items-center justify-center rounded-full', chipClassName)}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{subtitle}</Text>
      </View>
      {showNext ? <SoftBadge label="Next" variant="destructiveSoft" /> : null}
      {trailing}
    </View>
  );
}

/** Full approval-chain panel — initiator + per-level approvers + resolution notice. */
export function ApprovalChainPanel({ request }: Readonly<{ request: ApprovalRequestDetail }>) {
  const success = useThemeColor('--success');
  const brand = useThemeColor('--brand');
  const warning = useThemeColor('--warning');

  if (request.steps.length === 0) return null;

  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Approval chain
      </Text>

      <View className="gap-2">
        {/* Initiator */}
        <ChainRow
          chipClassName="bg-success/10"
          icon="Flag"
          iconColor={success}
          title={request.submitterName ?? 'Initiator'}
          subtitle="Initiator — submitted the request"
          trailing={<Icon name="CircleCheck" size={20} color={success} fill={success} />}
        />

        {/* Steps — grouped per level so And/Or-Sign render correctly:
            • Or-Sign  → "OR" between approvers (any one suffices); no "Next".
            • And-Sign → "Next" only on the first still-undecided approver of the CURRENT level. */}
        {request.steps.map((step) => {
          const isOrSign = step.mode === 'or_sign';
          const nextApproverId = step.approvers.find((a) => a.decision === null)?.id ?? null;
          return (
            <View key={step.id} className="gap-2">
              {step.approvers.map((approver, idx) => {
                const notNeeded =
                  (step.status === 'approved' || step.status === 'changes_requested') &&
                  approver.decision === null;
                const showNext = step.isCurrent && !isOrSign && approver.id === nextApproverId;
                const subtitle = `Level ${step.position}${
                  step.isCurrent ? ' · Awaiting decision' : ''
                }${isOrSign ? ' · Any one' : ''}`;
                return (
                  <View key={approver.id} className="gap-2">
                    {isOrSign && idx > 0 ? (
                      <View className="flex-row items-center gap-2">
                        <View className="h-px flex-1 bg-border" />
                        <Text className="text-xs font-medium text-muted-foreground">OR</Text>
                        <View className="h-px flex-1 bg-border" />
                      </View>
                    ) : null}
                    <ChainRow
                      chipClassName="bg-brand/10"
                      icon="User"
                      iconColor={brand}
                      title={approver.label ?? (approver.kind === 'role' ? 'Role' : 'Approver')}
                      subtitle={subtitle}
                      highlighted={step.isCurrent}
                      dimmed={notNeeded}
                      showNext={showNext}
                      trailing={<ApproverIndicator step={step} approver={approver} />}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Resolution notice */}
      {request.status === 'pending' ? null : (
        <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          {request.status === 'approved' ? (
            <>
              <Icon name="CircleCheck" size={16} color={success} fill={success} />
              <Text className="flex-1 text-sm text-foreground">
                Approved — this request has cleared its approval chain.
              </Text>
            </>
          ) : (
            <>
              <Icon name="Clock" size={16} color={warning} />
              <Text className="flex-1 text-sm text-foreground">
                Changes requested — sent back to the initiator.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
