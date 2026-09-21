export interface Opt {
  value: string;
  label: string;
  group?: string;
}

export type CompletionStatus =
  | 'ready_primary'
  | 'off_plan_primary'
  | 'ready_secondary'
  | 'off_plan_secondary';

export type ListingBranch = 'primary' | 'secondary';
export type WizardStepId = 'information' | 'description' | 'media' | 'portals';

export function branchFor(status: string): ListingBranch | null {
  if (status === 'ready_primary' || status === 'off_plan_primary') return 'primary';
  if (status === 'ready_secondary' || status === 'off_plan_secondary') return 'secondary';
  return null;
}

export function isOffPlan(status: string): boolean {
  return status === 'off_plan_primary' || status === 'off_plan_secondary';
}
