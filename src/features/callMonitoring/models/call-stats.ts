export interface CallStats {
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_minutes: number;
  average_duration: number;
  by_extension: {
    extension: string | null;
    agentName: string;
    total_calls: number;
    total_minutes: number;
  }[];
  by_carrier: { carrier: string | null; total_calls: number; total_minutes: number }[];
  by_country: { countryIso: string | null; total_calls: number; total_minutes: number }[];
  by_source?: { source: string | null; total_calls: number }[];
}
