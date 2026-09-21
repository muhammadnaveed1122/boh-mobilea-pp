/**
 * Lead enums — mirrored from the web Lead model.
 *
 * Web reference: `boh-lead-magnet/src/features/leads/models/lead.ts` and the
 * canonical dropdown sources under
 * `boh-lead-magnet/src/components/molecules/dropdowns/property/*`.
 *
 * String values match backend payloads exactly. Do NOT change casing —
 * these are the values stored/returned by the API.
 */

// ============================================
// Lead identity / status
// ============================================

export enum InterestType {
  SELL_MY_PROPERTY = 'sell_my_property',
  RENT_OUT_MY_PROPERTY = 'rent_out_my_property',
  FIND_A_PROPERTY_TO_RENT = 'find_a_property_to_rent',
  FIND_A_PROPERTY_TO_BUY = 'find_a_property_to_buy',
  GET_VALUATION = 'get_valuation',
  BUYING_SELLING_AND_TRANSACTION = 'buying_selling_and_transaction',
  OTHER = 'other',
}

export enum Persona {
  LANDLORD = 'landlord',
  BUYER = 'buyer',
  SELLER = 'seller',
  TENANT = 'tenant',
  PODCAST_GUEST = 'podcast_guest',
}

export enum LeadStatus {
  NEW = 'New',
  CONTACTED = 'Contacted',
  QUALIFIED = 'Qualified',
  VIEWING_SCHEDULED = 'Viewing_Scheduled',
  WORKING_DEAL = 'Working_Deal',
  FUTURE_PROSPECT = 'Future_Prospect',
  DID_NOT_RESPOND = 'Did_Not_Respond',
  UNQUALIFIED = 'Unqualified',
  CLOSED_DEAL = 'Closed_Deal',
  LOST_DEAL = 'Lost_Deal',
  RE_OPENED = 'Re_opened',
}

export enum LeadPriority {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
}

/**
 * Source / channel of the lead. Backend stores these as `leadType.name` on the
 * Lead payload — values match the web `LeadType` enum 1:1.
 */
export enum LeadSource {
  REQUEST_CONSULTATION = 'request_consultation',
  REQUEST_A_CALL_BACK = 'request_a_call_back',
  SCHEDULE_A_MEETING = 'schedule_a_meeting',
  REQUEST_A_CALL = 'request_a_call',
  ABOUT_US = 'about_us',
  MANUAL = 'manual',
  SERVICES = 'services',
  GUIDE = 'guide',
  BROCHURE_DOWNLOAD = 'brochure_download',
  TOP_AREAS = 'top_areas',
  PODCAST_GUEST = 'podcast_guest',
}

// ============================================
// Requirement-section dropdown values
// ============================================
//
// Property Use, Property Type, Unit Type, Furnishing, etc. are all stored on
// the Lead as plain `string` (web Lead model). The values below are the
// canonical backend values shipped from the property dropdown components in
// `boh-lead-magnet/src/components/molecules/dropdowns/property/`.

export enum LeadPropertyUse {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
}

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  TOWNHOUSE = 'townhouse',
  RESIDENTIAL_PLOT = 'residential_plot',
  OFFICE = 'office',
  RETAIL = 'retail',
  WAREHOUSE = 'warehouse',
  COMMERCIAL_PLOT = 'commercial_plot',
}

export enum UnitType {
  STUDIO = 'studio',
  ONE_BR = 'one_br',
  TWO_BR = 'two_br',
  THREE_BR = 'three_br',
  FOUR_BR = 'four_br',
  FIVE_BR = 'five_br',
  SIX_BR_PLUS = 'six_br_plus',
  SHELL_AND_CORE = 'shell_and_core',
  FITTED = 'fitted',
  FURNISHED = 'furnished',
  FULL_FLOOR = 'full_floor',
  RETAIL_UNIT = 'retail_unit',
  FNB_UNIT = 'fnb_unit',
  KIOSK = 'kiosk',
  WAREHOUSE = 'warehouse',
  COMMERCIAL_PLOT = 'commercial_plot',
}

export enum Furnishing {
  FURNISHED = 'furnished',
  SEMI_FURNISHED = 'semi_furnished',
  UNFURNISHED = 'unfurnished',
}

export enum MoveInTimeline {
  IMMEDIATE = 'immediate',
  WITHIN_2_WEEKS = 'within_2_weeks',
  WITHIN_1_MONTH = 'within_1_month',
  WITHIN_2_3_MONTHS = 'within_2_3_months',
  FLEXIBLE = 'flexible',
}

export enum LeaseTerm {
  SIX_MONTHS = 'six_months',
  TWELVE_MONTHS = 'twelve_months',
  FLEXIBLE = 'flexible',
}

export enum ChequePreference {
  ONE_CHEQUE = 'one_cheque',
  TWO_CHEQUES = 'two_cheques',
  FOUR_CHEQUES = 'four_cheques',
  SIX_CHEQUES = 'six_cheques',
  TWELVE_CHEQUES = 'twelve_cheques',
  FLEXIBLE = 'flexible',
}

export enum PurchaseTimeline {
  IMMEDIATE = 'immediate',
  WITHIN_3_MONTHS = 'within_3_months',
  WITHIN_6_MONTHS = 'within_6_months',
  WITHIN_12_MONTHS = 'within_12_months',
  FLEXIBLE = 'flexible',
}

export enum FinancingStatus {
  CASH_BUYER = 'cash_buyer',
  PRE_APPROVED_MORTGAGE = 'pre_approved_mortgage',
  MORTGAGE_IN_PROCESS = 'mortgage_in_process',
  NEEDS_MORTGAGE_ASSISTANCE = 'needs_mortgage_assistance',
  EXPLORING = 'exploring',
  NOT_CONFIRMED = 'not_confirmed',
}

export enum View {
  SEA_VIEW = 'sea_view',
  CITY_VIEW = 'city_view',
  GARDEN_VIEW = 'garden_view',
  POOL_VIEW = 'pool_view',
  CANAL_VIEW = 'canal_view',
  GOLF_VIEW = 'golf_view',
  LANDMARK_VIEW = 'landmark_view',
  COMMUNITY_VIEW = 'community_view',
  PARK_VIEW = 'park_view',
  MARINA_VIEW = 'marina_view',
  BOULEVARD_VIEW = 'boulevard_view',
  OTHER = 'other',
}

export enum IntendedUse {
  PERSONAL_RESIDENCE = 'personal_residence',
  INVESTMENT = 'investment',
  HOLIDAY_HOME = 'holiday_home',
  BUSINESS_USE = 'business_use',
  RESALE = 'resale',
  OTHER = 'other',
}

// --- Profile-enrichment enums (Lead Details Profile card) — mirror backend/web.

export enum LeadGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum LeadBuyerType {
  HOME_BUYER = 'home_buyer',
  INVESTOR = 'investor',
}

export enum LeadPaymentMethod {
  CASH = 'cash',
  MORTGAGE = 'mortgage',
}
