import type { LeadStatus } from '../types';

export const PRIMARY_STAGES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Viewing_Scheduled',
  'Working_Deal',
  'Closed_Deal',
  'Lost_Deal',
];

export const SECONDARY_STAGES: LeadStatus[] = ['Did_Not_Respond', 'Future_Prospect', 'Unqualified'];

export const BOARD_STAGE_ORDER: LeadStatus[] = [...PRIMARY_STAGES, ...SECONDARY_STAGES];
