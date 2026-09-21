/**
 * Mobile LeadDetail model — mirrors web `Lead` shape from
 * `boh-lead-magnet/src/features/leads/models/lead.ts`.
 *
 * Backend returns the same payload for both list (`GET /leads`) and detail
 * (`GET /leads/:id`) endpoints. Mobile uses `LeadDetail` to keep intent clear
 * on the detail screen, but the shape is identical to web's `Lead`.
 */

import type {
  ChequePreference,
  Furnishing,
  IntendedUse,
  InterestType,
  LeadPriority,
  LeadPropertyUse,
  LeadStatus,
  LeaseTerm,
  MoveInTimeline,
  Persona,
  PropertyType,
  PurchaseTimeline,
  UnitType,
  View,
} from '../constants/lead-enums';

export interface LeadAssignee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * Photo. The backend resolves the agent-profile photo into `profile.profilePicUrl`
   * before responding (`mapAssignee`), so this one field carries either source.
   */
  profile?: { profilePicUrl?: string | null } | null;
  agentProfile?: { photoUrl?: string | null } | null;
}

export interface LeadTypeObject {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CallPreference {
  date?: string;
  time?: string;
  timezone?: string;
}

export interface MeetingDetails {
  id?: string;
  meetingId?: string;
  eventId?: string;
  meetingLink?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  timezone?: string;
  duration?: number;
  meetingType?: string;
  platform?: string;
  htmlLink?: string;
  status?: string;
}

export interface InitialEnquiry {
  message: string;
  timestamp: string;
  source?: string;
}

export interface LinkedListing {
  id: string;
  title: string;
  /**
   * Listing source. `primary` = project CMS listing, `secondary` = opportunity
   * listing. Selects the data source + permission on the `/listings/[id]` route.
   * Optional for backward compat with older payloads that omitted it.
   */
  kind?: 'primary' | 'secondary';
  type?: string;
  status?: string;
  linkedAt?: string;
  projectSlug?: string;
  listingSlug?: string;
  slug?: string;
  heroUrl?: string;
  imageUrl?: string;
  projectName?: string;
  developerName?: string;
  inquirySent?: boolean;
}

export interface LinkedProject {
  id: string;
  projectName: string;
  slug: string;
  heroUrl?: string;
  developerName: string;
  inquirySent?: boolean;
}

/**
 * Requirement fields driven by the form registry `PURPOSE_FIELDS` /
 * `visibleFields` selector. All optional — the visible set depends on
 * `purpose` (interestType) and `leadPropertyUse`.
 *
 * NOTE: Field types intentionally use `string | EnumValue` unions because the
 * backend stores these as free strings on the Lead payload (see web Lead model
 * lines 238-263). Enums act as canonical-value constants, not strict types.
 */
export interface LeadRequirements {
  leadPropertyUse?: LeadPropertyUse | string;
  propertyType?: PropertyType | string;
  unitType?: UnitType | string;
  bedrooms?: number;
  bathrooms?: number;
  projectBuilding?: string;
  askingPriceMin?: number;
  askingPriceMax?: number;
  askingRentMin?: number;
  askingRentMax?: number;
  budgetMin?: number;
  budgetMax?: number;
  furnishing?: Furnishing | string;
  moveInTimeline?: MoveInTimeline | string;
  leaseTerm?: LeaseTerm | string;
  chequePreference?: ChequePreference | string;
  purchaseTimeline?: PurchaseTimeline | string;
  financingStatus?: string;
  view?: View | string;
  intendedUse?: IntendedUse | string;
  dealBreaker?: string;
  niceToHaves?: string;
}

/**
 * Full lead detail payload. Mirrors web `Lead` interface.
 * All requirement-section fields are inlined on the top-level lead (same as
 * web), with a `LeadRequirements` view-helper type above for forms that
 * operate on the requirement subset.
 */
export interface LeadDetail extends LeadRequirements {
  id: string;
  requestId: number;
  leadType: LeadTypeObject;
  name: string;
  email: string;
  phone: string;
  contactProfilePicUrl?: string | null;
  interest?: Persona | string | null;
  interestType?: (InterestType | string)[];
  propertyType?: PropertyType | string;
  specifyInterest?: string;
  additionalNotes?: string;
  preferredCity?: string;
  budgetRange?: string;
  floor?: string;
  areaMin?: number;
  areaMax?: number;
  areaUnit?: string;
  state?: { id: string; name: string };
  neighbourhood?: { id: string; name: string };
  /**
   * Selected location ids for the City / Area selects. The backend returns
   * `state` / `neighbourhood` objects on read and accepts `stateId` /
   * `neighbourhoodId` on PATCH — these are the editable form-side mirrors.
   */
  stateId?: string;
  neighbourhoodId?: string;
  isAssigned: boolean;
  assignee?: LeadAssignee;
  status: LeadStatus | string;
  priority?: LeadPriority | string;
  // Profile-enrichment fields (Lead Details Profile card) — mirror web `Lead`.
  secondaryPhone?: string | null;
  nationality?: string | null;
  gender?: string | null;
  spokenLanguages?: string[];
  buyerType?: string | null;
  paymentMethod?: string | null;
  ipAddress?: string;
  data?: Record<string, unknown>;
  channel?: string;
  /** Portal/telesales origin (e.g. `property_finder`, `telesales`); drives the Source label. */
  externalSource?: string | null;
  channelMeta?: {
    page?: string;
    cta?: string;
    entryPointId?: string;
  };
  projectSlug?: string;
  listingSlug?: string;
  callPreference?: CallPreference;
  createdAt: string;
  updatedAt: string;
  conversationId?: string | null;
  deletedAt?: string | null;
  firstName?: string;
  lastName?: string;
  customerType?: string | null;
  registrationSource?: string;
  loginMethod?: string;
  hasPassword?: boolean;
  verificationRequestId?: string;
  meetingDetails?: MeetingDetails;
  assignmentStatus?: string;
  assignedAt?: string;
  notes?: string;
  isOwnLead?: boolean;
  activeListing?: boolean;
  activeListingId?: string | null;
  listingIds?: string[];
  assignedAgent?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    assignmentStatus: string;
    assignedAt: string;
    notes?: string;
  };
  initialEnquiry?: InitialEnquiry | null;
  qualification?: {
    status?: string;
    score?: number;
    notes?: string;
    qualifiedAt?: string;
    [key: string]: unknown;
  };
  preferences?: {
    location?: string;
    budget?: { min?: number; max?: number };
    bedrooms?: number;
    [key: string]: unknown;
  };
  linkedListings?: LinkedListing[];
  listings?: LinkedListing[];
  projects?: LinkedProject[];
}

/**
 * Payload for PATCH /leads/:id. Subset of editable fields on the lead detail
 * page. Mirrors web `UpdateLeadRequest` for requirement-section fields plus
 * status/priority/assignment that may also be editable depending on RBAC.
 */
/**
 * Post-call log written by the call service's outcome modal. Backend already
 * accepts this on `PATCH /leads/:id` (web writes it in production). Shape
 * mirrors web `CallOutcomeModal` `data.callLog`.
 */
export interface CallLogPayload {
  outcome?: string;
  liveNotes?: string;
  number: string | null;
  displayName?: string | null;
  direction: string | null;
  duration: number;
  startedAt?: string;
  endedAt: string;
}

export interface UpdateLeadPayload extends Partial<LeadRequirements> {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  additionalNotes?: string;
  /** Optional free-text note captured alongside a status change (web parity: `note`). */
  note?: string;
  status?: LeadStatus | string;
  priority?: LeadPriority | string;
  assigneeId?: string | null;
  interest?: Persona | string;
  interestType?: (InterestType | string)[] | InterestType | string;
  propertyType?: PropertyType | string;
  preferredCity?: string;
  stateId?: string;
  neighbourhoodId?: string;
  budgetRange?: string;
  specifyInterest?: string;
  floor?: string;
  areaMin?: number;
  areaMax?: number;
  areaUnit?: string;
  dealBreaker?: string;
  secondaryPhone?: string | null;
  nationality?: string | null;
  gender?: string | null;
  spokenLanguages?: string[];
  buyerType?: string | null;
  paymentMethod?: string | null;
  callLog?: CallLogPayload;
}
