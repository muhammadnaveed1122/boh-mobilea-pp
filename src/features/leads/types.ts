export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Viewing_Scheduled'
  | 'Working_Deal'
  | 'Future_Prospect'
  | 'Did_Not_Respond'
  | 'Unqualified'
  | 'Closed_Deal'
  | 'Lost_Deal'
  | 'Re_opened';

export type LeadPriority = 'hot' | 'warm' | 'cold';

export interface LeadTypeRef {
  id: string;
  name: string;
}

/**
 * Assignee as the paginated leads list returns it (`LEAD_INCLUDE.assignee` on the
 * backend): identity + both photo sources. `name`/`avatarUrl` are kept optional for
 * callers that already flattened it — read through `assigneeName` / `assigneeAvatarUrl`.
 */
export interface LeadAssigneeRef {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profile?: { profilePicUrl?: string | null } | null;
  agentProfile?: { photoUrl?: string | null } | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface LeadListItem {
  id: string;
  requestId: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  priority?: LeadPriority | null;
  propertyType?: string | null;
  channel?: string | null;
  leadType?: LeadTypeRef | null;
  updatedAt: string;
  // dashboard card fields (optional — degrade gracefully if backend omits)
  preferredCity?: string | null;
  budgetRange?: string | null;
  externalSource?: string | null;
  interest?: LeadInterest | null;
  isAssigned?: boolean;
  assignee?: LeadAssigneeRef | null;
  lastNote?: { content: string; createdAt: string } | null;
  /**
   * True for a Property Finder project ("Primary Plus" / New Project) enquiry — the premium
   * lead product, far more expensive than a standard portal lead, so the card badges it.
   * Derived server-side (`isNewProjectLead`) from the same rules as the New Project filter;
   * never recomputed here, because `channelMeta` is nulled for contact-masked callers.
   */
  isNewProject?: boolean;
}

export interface PaginatedLeads {
  items: LeadListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadsQuery {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  statuses?: LeadStatus[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  interest?: LeadInterest;
  interestType?: LeadInterestType;
  intentBucket?: 'buy' | 'rent' | 'sell';
  isPortal?: boolean;
  hasLink?: boolean;
  pfChannel?: 'whatsapp' | 'call' | 'email';
  priority?: LeadPriority;
  assigneeId?: string;
  isAssigned?: boolean;
  channel?: string;
  externalSource?: string;
  dateFrom?: string;
  dateTo?: string;
  callOutcome?: 'connected' | 'missed' | 'with_recording';
  portalSource?: 'bayut' | 'property_finder' | 'dubizzle';
  /**
   * Web-parity filters (see `models/leads-filters.ts`). Multi-value params go
   * over the wire as comma-separated strings — the backend's `toArray()`
   * splits them back, and that is the shape web sends too.
   */
  source?: string;
  createdById?: string;
  stateId?: string;
  neighbourhoodId?: string;
  countryCode?: string;
  bedroomsIn?: string;
  spokenLanguages?: string;
  propertyType?: string;
  furnishing?: string;
  view?: string;
  nationality?: string;
  newProject?: boolean;
}

export type LeadInterest = 'landlord' | 'buyer' | 'seller' | 'tenant';

export type LeadInterestType =
  | 'sell_my_property'
  | 'rent_out_my_property'
  | 'find_a_property_to_rent'
  | 'find_a_property_to_buy'
  | 'get_valuation'
  | 'buying_selling_and_transaction'
  | 'other';

export type LeadPropertyType = 'residential' | 'commercial';

export const INTEREST_LABEL: Record<LeadInterest, string> = {
  landlord: 'Landlord',
  buyer: 'Buyer',
  seller: 'Seller',
  tenant: 'Tenant',
};

export const INTEREST_TYPE_LABEL: Record<LeadInterestType, string> = {
  sell_my_property: 'Sell My Property',
  rent_out_my_property: 'Rent Out My Property',
  find_a_property_to_rent: 'Find A Property To Rent',
  find_a_property_to_buy: 'Find A Property To Buy',
  get_valuation: 'Get Valuation',
  buying_selling_and_transaction: 'Buy / Sell / Transaction',
  other: 'Other',
};

export const PROPERTY_TYPE_LABEL: Record<LeadPropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
};

export interface CreateLeadPayload {
  leadType: string;
  name: string;
  email: string;
  phone: string;
  interest?: LeadInterest;
  interestType?: LeadInterestType[];
  propertyType?: LeadPropertyType;
  priority?: LeadPriority;
  additionalNotes?: string;
  channel?: string;
}

export const STATUS_LABEL: Record<LeadStatus, string> = {
  New: 'New',
  Contacted: 'Contacted',
  Qualified: 'Qualified',
  Viewing_Scheduled: 'Viewing Scheduled',
  Working_Deal: 'Working Deal',
  Future_Prospect: 'Future Prospect',
  Did_Not_Respond: 'No Response',
  Unqualified: 'Unqualified',
  Closed_Deal: 'Closed',
  Lost_Deal: 'Lost',
  Re_opened: 'Re-opened',
};

export type BadgeTone =
  | 'successSoft'
  | 'infoSoft'
  | 'warningSoft'
  | 'destructiveSoft'
  | 'mutedSoft';

export const STATUS_BADGE_VARIANT: Record<LeadStatus, BadgeTone> = {
  New: 'infoSoft',
  Contacted: 'infoSoft',
  Qualified: 'infoSoft',
  Viewing_Scheduled: 'warningSoft',
  Working_Deal: 'warningSoft',
  Future_Prospect: 'mutedSoft',
  Did_Not_Respond: 'mutedSoft',
  Unqualified: 'mutedSoft',
  Closed_Deal: 'successSoft',
  Lost_Deal: 'destructiveSoft',
  Re_opened: 'infoSoft',
};

export const PRIORITY_LABEL: Record<LeadPriority, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
};

export const PRIORITY_BADGE_VARIANT: Record<LeadPriority, BadgeTone> = {
  hot: 'destructiveSoft',
  warm: 'warningSoft',
  cold: 'infoSoft',
};

export interface LeadFunnelStats {
  totalLeads: number;
  closedDeals: number;
  activeLeads: number;
}

export const STATUS_FILTERS: readonly LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Viewing_Scheduled',
  'Working_Deal',
  'Future_Prospect',
  'Did_Not_Respond',
  'Unqualified',
  'Closed_Deal',
  'Lost_Deal',
  'Re_opened',
];

export const PRIORITY_FILTERS: readonly LeadPriority[] = ['hot', 'warm', 'cold'];

// ---- Dashboard overview ----
export type TrendDirection = 'up' | 'down' | 'flat';

export interface OverviewKpi {
  key: string;
  label: string;
  count: number;
  trend?: { percent: number; direction: TrendDirection; sparkline?: number[] };
}

export interface PipelineCount {
  status: LeadStatus;
  count: number;
}

export interface PriorityProperty {
  thumbnailUrl?: string | null;
  price?: number | null;
}

export interface PriorityItem {
  leadId: string;
  name: string | null;
  avatarUrl?: string | null;
  reason: string;
  conditionRank?: number;
  property?: PriorityProperty | null;
  actionType?: string | null;
}

export interface TabCount {
  key: string;
  label: string;
  count: number;
}

export interface LeadsOverview {
  kpis: OverviewKpi[];
  tabCounts: TabCount[];
  pipelineCounts: PipelineCount[];
  priorities: PriorityItem[];
}

export interface OverviewQuery {
  agentId?: string;
  teamId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---- Agents (assignee picker) ----
// Flattened from the backend's nested `AgentResponseDto` in `services.getAgents`.
export interface AgentListItem {
  /** USER id — this is what `assigneeId` (assign + filter) expects. */
  id: string;
  /** Agent-profile id (`AgentResponseDto.id`), kept for agent-scoped calls. */
  agentId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  teamName?: string | null;
  /**
   * Team is deactivated — the assignment picker still lists the agent (so the
   * current assignee never vanishes) but blocks selecting them, same as web.
   */
  isTeamDeactivated?: boolean;
}

export interface PaginatedAgents {
  items: AgentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** A user who can create leads — options for the "Created By" filter. */
export interface LeadCreator {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface AgentsQuery {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  /** `AgentAvailability` — the assignment picker lists `available` agents only. */
  availability?: 'available' | 'busy' | 'unavailable';
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  /**
   * Assignment-picker mode: returns a redacted row (identity + descriptors, no
   * commission / documents / workload) reachable with only an `*:assign` permission.
   */
  forAssignment?: boolean;
  /**
   * Scopes the picker by that kind's `*:assign` permission (own → self, team → the
   * caller's team, all → every active agent). Only honoured with `forAssignment`.
   */
  assignFor?: 'listings' | 'opportunity-listing' | 'leads';
}

// ---- Viewing scheduler ----
export type ViewingPropertyType = 'new_project' | 'sale' | 'rent';

export interface CreateViewingPayload {
  viewingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  propertyType: ViewingPropertyType;
  remarks: string;
  transactionType?: 'sale' | 'rent';
  projects?: {
    developerId: string;
    developerName?: string;
    projectName: string;
    bedrooms: number;
  }[];
  listings?: { listingType: 'primary' | 'secondary'; listingId: string }[];
  setStatusToViewing?: boolean;
}

export interface LeadViewing {
  id: string;
  viewingDate: string;
  startTime: string;
  endTime: string;
  propertyType: ViewingPropertyType;
  remarks: string;
  createdAt: string;
}

// ---- Notes ----
/** How a note came to exist: typed by an agent, or captured on a stage change. */
export type LeadNoteSource = 'manual' | 'status_change';

export interface LeadNote {
  id: string;
  content: string;
  author?: { id: string; name: string };
  /** Backend defaults to `manual`; older payloads may omit it. */
  source?: LeadNoteSource;
  /** Present only when `source === 'status_change'` and both ends are known. */
  statusChange?: { from: string; to: string } | null;
  createdAt: string;
  updatedAt?: string;
  canModify?: boolean;
}

// ---- Portal overview ----
export interface PortalChannelCounts {
  all: number;
  whatsapp: number;
  calls: number;
  emails: number;
}

export interface PortalOverview {
  channelCounts: PortalChannelCounts;
  cards: TabCount[];
}

export interface PortalOverviewQuery {
  tab?: 'all' | 'whatsapp' | 'calls' | 'emails';
  portalSource?: 'bayut' | 'property_finder' | 'dubizzle';
  dateFrom?: string;
  dateTo?: string;
}

export type BrowseConfig =
  | { mode: 'intent'; intentBucket: 'buy' | 'sell' | 'rent'; title: string }
  | { mode: 'portal'; title: string }
  /**
   * Off-plan / new-project ("Primary Plus") enquiries. A lead KIND, not a channel or an
   * intent — so it has no tab strip of its own; it just pins `newProject=true` on the query.
   */
  | { mode: 'newProject'; title: string };

export type MarketTab = 'all' | 'primary' | 'secondary';
export type ChannelTab = 'all' | 'whatsapp' | 'calls' | 'emails';
export type PortalSource = 'property_finder' | 'bayut' | 'dubizzle';
export type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

export interface BrowseState {
  search: string;
  stage: LeadStatus | null;
  marketTab: MarketTab;
  channelTab: ChannelTab;
  portalSource: PortalSource | null;
  priority: LeadPriority | null;
  assignment: AssignmentFilter;
  assigneeId: string | null;
}
