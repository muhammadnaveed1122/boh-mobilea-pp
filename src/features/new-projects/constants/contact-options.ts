/**
 * Contact / lead-capture options for the new-project detail "Request a call back" form.
 * Values are ported verbatim from the web app so they match the backend contract.
 * Web sources: src/constants/contact/{iWantTo,propertyType}.ts, Interest enum in
 * features/leads/models/lead.ts, and features/contactUs/utils/personaOptions.ts.
 */

export const LEAD_TYPE_REQUEST_CALLBACK = 'request_a_call_back';

/** "I am a" — persona */
export const INTEREST_OPTIONS = [
  { value: 'landlord', label: 'Landlord' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'tenant', label: 'Tenant' },
] as const;

export const INTEREST_VALUES: readonly string[] = INTEREST_OPTIONS.map((o) => o.value);

/** "My property use is" — optional, disabled until a persona is chosen */
export const PROPERTY_TYPE_OPTIONS = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
] as const;

export const PROPERTY_TYPE_VALUES: readonly string[] = PROPERTY_TYPE_OPTIONS.map((o) => o.value);

/** "I want to" — required, disabled until persona, filtered per persona */
export const I_WANT_TO_OPTIONS = [
  { value: 'sell_my_property', label: 'Sell my property' },
  { value: 'rent_out_my_property', label: 'Rent out my property' },
  { value: 'find_a_property_to_rent', label: 'Find a property to rent' },
  { value: 'find_a_property_to_buy', label: 'Find a property to buy' },
  { value: 'get_valuation', label: 'Get valuation' },
  { value: 'other', label: 'Other' },
] as const;

export const I_WANT_TO_VALUES: readonly string[] = I_WANT_TO_OPTIONS.map((o) => o.value);

export const I_WANT_TO_OTHER = 'other';

/** Persona → valid "I want to" values (mirror of web getIWantToOptionsForPersona) */
export function getIWantToOptionsForPersona(
  persona: string | undefined,
): readonly { value: string; label: string }[] {
  const allowed: Record<string, string[]> = {
    buyer: ['find_a_property_to_buy', 'get_valuation', 'other'],
    tenant: ['find_a_property_to_rent', 'other'],
    landlord: ['sell_my_property', 'rent_out_my_property', 'get_valuation', 'other'],
    seller: ['sell_my_property', 'get_valuation', 'other'],
  };
  const values = persona ? (allowed[persona] ?? []) : [];
  return I_WANT_TO_OPTIONS.filter((o) => values.includes(o.value));
}

export function isIWantToValidForPersona(
  iWantTo: string | undefined,
  persona: string | undefined,
): boolean {
  if (!iWantTo || !persona) return false;
  return getIWantToOptionsForPersona(persona).some((o) => o.value === iWantTo);
}

/**
 * Phone numbers for the "Call us now" tab. First entry is the primary number.
 * Ported from web features/contact/constants.
 */
export const PHONE_NUMBERS = [
  { display: '+971 800 CALL RHK', tel: '+9718002255745' },
  { display: '+971 800 2255745', tel: '+9718002255745' },
  { display: '+971 4 809 0333', tel: '+97148090333' },
] as const;
