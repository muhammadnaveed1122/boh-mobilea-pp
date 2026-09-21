import { Persona } from '@/features/leads/constants/lead-enums';

export const PERSONA_LABELS: Record<string, string> = {
  [Persona.LANDLORD]: 'Landlord',
  [Persona.BUYER]: 'Buyer',
  [Persona.SELLER]: 'Seller',
  [Persona.TENANT]: 'Tenant',
  [Persona.PODCAST_GUEST]: 'Podcast Guest',
};

export function priorityHex(priority?: string | null): string | null {
  switch ((priority ?? '').toLowerCase()) {
    case 'hot':
      return '#dc2626';
    case 'warm':
      return '#d97706';
    case 'cold':
      return '#0284c7';
    default:
      return null;
  }
}
