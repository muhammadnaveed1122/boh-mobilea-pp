/**
 * Form → API body mappers for the create-listing wizard. Mirror the web wizard's
 * `wizardMappers.ts`: pricing is purpose-conditional (rent sends priceType/maxCheques/
 * deposit, sale sends mortgageStatus) and blank fields are omitted so the backend keeps
 * its own defaults.
 */

import { PROPERTY_USE_BY_TYPE } from './constants';
import type { CreateLeadBody, CreateOpportunityBody, CreatePrimaryListingBody } from './services';
import type { InformationValues } from './forms/information.schema';

/** Trimmed string, or undefined when blank. */
function str(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Parsed number, or undefined when blank / not a number. */
function num(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Drop keys whose value is undefined so they aren't sent as `null`/empty. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Map the wizard purpose (sale/rent) to the API's ListingPurpose. */
function toApiPurpose(purpose: string): 'for_sale' | 'for_rent' {
  return purpose === 'rent' ? 'for_rent' : 'for_sale';
}

/** Purpose-conditional pricing keys shared by both branches. */
function pricingFields(v: InformationValues): Record<string, unknown> {
  if (v.purpose === 'rent') {
    return { priceType: str(v.priceType), maxCheques: num(v.maxCheques), deposit: str(v.deposit) };
  }
  return { mortgageStatus: str(v.mortgageStatus) };
}

/** POST /listings body (primary branch). developerId/projectId/purpose are required. */
export function buildPrimaryListingBody(v: InformationValues): CreatePrimaryListingBody {
  return compact({
    developerId: v.developerId.trim(),
    projectId: v.projectId.trim(),
    unitTypeId: str(v.unitType),
    purpose: toApiPurpose(v.purpose),
    availability: v.availability.trim() || 'available',
    assigneeId: str(v.assigneeId),
    completionStatus: str(v.completionStatus),
    // Per-listing detail fields persisted on the Listing row.
    propertyType: str(v.propertyType),
    neighbourhoodId: str(v.neighbourhoodId),
    price: str(v.askingPrice),
    bedrooms: num(v.bedrooms),
    bathrooms: num(v.bathrooms),
    size: str(v.size),
    viewType: str(v.view),
    furnishing: str(v.furnishing),
    floor: str(v.floor),
    totalFloors: str(v.totalFloors),
    buildYear: str(v.buildYear),
    occupancy: str(v.occupancy),
    parking: str(v.parking),
    publicUnitNo: str(v.publicUnitNo),
    privateUnitNo: str(v.privateUnitNo),
    availabilityDate: str(v.availabilityDate),
    ...pricingFields(v),
  }) as CreatePrimaryListingBody;
}

/** POST /leads body (secondary branch — owner). name/phone drive the lead; extra owner
 * attributes go under `data`. */
export function buildLeadBody(v: InformationValues): CreateLeadBody {
  const data = compact({
    sourceOfOwner: str(v.ownerSource),
    nationality: str(v.ownerNationality),
    gender: str(v.ownerGender),
    birthdate: str(v.ownerBirthdate),
    spokenLanguages: v.ownerLanguages.length > 0 ? v.ownerLanguages : undefined,
  });
  return compact({
    name: str(v.ownerName),
    phone: v.ownerPhone.trim(),
    secondaryPhone: str(v.ownerSecondaryPhone),
    email: str(v.ownerEmail),
    leadType: 'manual',
    data: Object.keys(data).length > 0 ? data : undefined,
  }) as CreateLeadBody;
}

/** POST /opportunities body (secondary branch — property). leadId links it to the owner. */
export function buildOpportunityBody(v: InformationValues, leadId: string): CreateOpportunityBody {
  return compact({
    leadId,
    purpose: toApiPurpose(v.purpose),
    // builtUpArea + unitNumber are required by the API — send trimmed (unitNumber is
    // schema-required for a new property).
    builtUpArea: v.builtUpArea.trim(),
    unitNumber: v.unitNumber.trim(),
    neighbourhoodId: str(v.neighbourhoodId),
    propertyUse: PROPERTY_USE_BY_TYPE[v.propertyType],
    propertyType: str(v.propertyType),
    unitType: str(v.unitType),
    bedrooms: num(v.bedrooms),
    bathrooms: num(v.bathrooms),
    furnishing: str(v.furnishing),
    view: str(v.view),
    projectBuilding: str(v.projectBuilding),
    towerBlock: str(v.towerBlock),
    floor: str(v.floor),
    buildingProjectAddress: str(v.projectAddress),
    askingPrice: str(v.askingPrice),
    ...pricingFields(v),
  }) as CreateOpportunityBody;
}
