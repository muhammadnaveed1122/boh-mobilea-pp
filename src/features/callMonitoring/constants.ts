export const PAGE_SIZE = 20;

export type SourceTabKey = '' | 'speed_to_lead' | 'dialer' | 'telesales' | 'reception' | 'webhook';

export const SOURCE_TABS: { key: SourceTabKey; label: string }[] = [
  { key: '', label: 'All Calls' },
  { key: 'speed_to_lead', label: 'Speed to Lead' },
  { key: 'dialer', label: 'Dialer' },
  { key: 'telesales', label: 'Campaigns' },
  { key: 'reception', label: 'Reception' },
  { key: 'webhook', label: 'Webhook' },
];

export const OUTCOME_OPTIONS = ['Connected', 'No Answer', 'Busy', 'Disconnected'] as const;
export type OutcomeOption = (typeof OUTCOME_OPTIONS)[number];
