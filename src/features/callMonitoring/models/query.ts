export interface CallLogQuery {
  from?: string;
  to?: string;
  agentExtension?: string;
  direction?: string;
  carrier?: string;
  countryIso?: string;
  source?: string;
  campaignId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
