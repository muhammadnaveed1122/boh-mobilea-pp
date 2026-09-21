import * as React from 'react';

import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import type { ApprovalRequestStatus } from '../models/approval';

const STATUS_META: Record<
  ApprovalRequestStatus,
  { label: string; variant: 'warningSoft' | 'successSoft' | 'destructiveSoft' }
> = {
  pending: { label: 'Pending', variant: 'warningSoft' },
  approved: { label: 'Approved', variant: 'successSoft' },
  changes_requested: { label: 'Changes Requested', variant: 'destructiveSoft' },
};

export function ApprovalStatusBadge({ status }: Readonly<{ status: ApprovalRequestStatus }>) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant}>
      <Text>{meta.label}</Text>
    </Badge>
  );
}
