import type { ApprovalQueueSlug } from '../models/approval';

/** Approval queue catalogue. `deferred` queues render greyed "Coming soon". */
export interface ApprovalQueueDef {
  readonly slug: ApprovalQueueSlug;
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  /** Financial cards vs listing cards. Only `listing` is used this iteration. */
  readonly variant: 'financial' | 'listing';
  /** True when the queue is disabled this iteration ("Coming soon"). */
  readonly deferred: boolean;
}

export const APPROVAL_QUEUES: readonly ApprovalQueueDef[] = [
  {
    slug: 'transactions',
    label: 'Transactions',
    title: 'Transactions Approvals',
    subtitle: 'Deal contracts awaiting sign-off before a transaction can proceed.',
    variant: 'financial',
    deferred: true,
  },
  {
    slug: 'commission',
    label: 'Commission',
    title: 'Commission Approvals',
    subtitle: 'Commission releases awaiting approval.',
    variant: 'financial',
    deferred: true,
  },
  {
    slug: 'portals',
    label: 'Portals',
    title: 'Portals Approvals',
    subtitle: 'Listings awaiting approval to publish to property portals.',
    variant: 'listing',
    deferred: true,
  },
  {
    slug: 'listings-status',
    label: 'Listings Status',
    title: 'Listings Status Approvals',
    subtitle: 'Listing activation / inactivation / archiving awaiting approval.',
    variant: 'listing',
    deferred: false,
  },
  {
    slug: 'listings-update',
    label: 'Listings Update',
    title: 'Listings Update Approvals',
    subtitle: 'Listing field changes awaiting approval before they go live.',
    variant: 'listing',
    deferred: false,
  },
];

export function getQueueDef(slug: string): ApprovalQueueDef | undefined {
  return APPROVAL_QUEUES.find((q) => q.slug === slug);
}

/** Queue slug (kebab) → backend WorkflowCategory key used in the pending-count `byCategory` map. */
export const QUEUE_CATEGORY: Record<ApprovalQueueSlug, string> = {
  transactions: 'transaction',
  commission: 'commission',
  portals: 'portals',
  'listings-status': 'listings_status',
  'listings-update': 'listings_update',
};
