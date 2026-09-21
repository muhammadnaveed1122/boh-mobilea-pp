export interface CallRecord {
  id: string;
  uuid: string;
  callerIdName: string | null;
  callerIdNumber: string | null;
  destinationNumber: string | null;
  direction: 'inbound' | 'outbound' | null;
  startTime: string | null;
  duration: number;
  billsec: number;
  status: string | null;
  hangupCause: string | null;
  recordingPath: string | null;
  extensionNumber: string | null;
  carrier: string | null;
  countryIso: string | null;
  source: 'speed_to_lead' | 'dialer' | 'reception' | 'webhook' | 'telesales' | null;
  /** Telesales campaign id, when the call came from a campaign. */
  campaignId?: string | null;
  /** Campaign name resolved server-side from `campaignId` — which campaign the call is from. */
  campaignName?: string | null;
  isDnc?: boolean;
  extension: {
    extension: string;
    agentName: string | null;
    department: { name: string } | null;
  } | null;
}

export interface CallsListResponse {
  records?: CallRecord[];
  rows?: CallRecord[];
  data?: CallRecord[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
}

/** Normalize the backend's records|rows|data variants into a single array. */
export function extractRecords(res: CallsListResponse | undefined): CallRecord[] {
  return res?.records ?? res?.rows ?? res?.data ?? [];
}

/** Normalize the total-count variants. */
export function extractTotal(res: CallsListResponse | undefined, fallback: number): number {
  return res?.total ?? res?.count ?? fallback;
}
