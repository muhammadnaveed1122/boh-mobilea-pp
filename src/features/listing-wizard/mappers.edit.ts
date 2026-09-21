/**
 * Server to form (inverse) mappers for edit mode, plus the form to API update
 * bodies. Mirrors the web wizard's hydrate/update helpers. Prefill seeds every
 * step; saves route property/pricing to opportunity/listing, owner to lead,
 * purpose/PF to wizard-state (see the services `update` functions).
 */

import { buildLeadBody, buildOpportunityBody, buildPrimaryListingBody } from './mappers';
import type {
  CreateLeadBody,
  CreateOpportunityBody,
  EditOwnerRaw,
  EditPermitRaw,
  EditSectionsRaw,
  LeadDetail,
  ListingPropertyDetailsBody,
  OpportunityDetail,
  PrimaryListingRaw,
  SecondaryListingRaw,
  UpdateOwnerBody,
} from './services';
import type { WizardContentInput } from './hooks/use-save-media';
import type { WizardMediaItem } from './media/types';
import type { WizardPublish, WizardWebsiteContent } from './portals.model';
import { EMPTY_PERMIT } from './portals.model';
import { INFORMATION_DEFAULTS, type InformationValues } from './forms/information.schema';
import type { DescriptionValues } from './forms/description.schema';

/* --------------------------------------------------------------- primitives */

/** Any scalar → trimmed string ('' for null/undefined). */
function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Wizard purpose from any API spelling. */
function toWizardPurpose(value?: string | null): string {
  const t = value?.toLowerCase();
  if (t === 'rent' || t === 'for_rent') return 'rent';
  if (t === 'sale' || t === 'sell' || t === 'for_sale') return 'sale';
  return '';
}

function heroTitle(sections?: EditSectionsRaw | null): string {
  return s(sections?.hero?.title ?? sections?.hero?.mainTitle);
}

/* ---------------------------------------------------------- inverse: info */

/** Owner form fields, normalized from either an Owner record or a legacy lead. */
interface OwnerFormFields {
  existingOwnerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerSecondaryPhone: string;
  ownerGender: string;
  ownerBirthdate: string;
  ownerSource: string;
  ownerNationality: string;
  ownerLanguages: string[];
  assigneeId: string;
}

/** Owner-first record (flat columns, embedded on the listing read). */
function ownerFieldsFromOwner(owner: EditOwnerRaw): OwnerFormFields {
  return {
    existingOwnerId: s(owner.id),
    ownerName: s(owner.name),
    ownerEmail: s(owner.email),
    ownerPhone: s(owner.phone),
    ownerSecondaryPhone: s(owner.secondaryPhone),
    ownerGender: s(owner.gender),
    ownerBirthdate: s(owner.birthdate),
    ownerSource: s(owner.source),
    ownerNationality: s(owner.nationality),
    ownerLanguages: owner.spokenLanguages ?? [],
    assigneeId: s(owner.assignee?.id),
  };
}

/** Legacy lead-based owner — extras nest under `lead.data`. */
function ownerFieldsFromLead(lead: LeadDetail): OwnerFormFields {
  return {
    existingOwnerId: s(lead.id),
    ownerName: s(lead.name),
    ownerEmail: s(lead.email),
    ownerPhone: s(lead.phone),
    ownerSecondaryPhone: s(lead.secondaryPhone),
    ownerGender: s(lead.gender ?? lead.data?.gender),
    ownerBirthdate: s(lead.birthdate ?? lead.data?.birthdate),
    ownerSource: s(lead.source ?? lead.data?.sourceOfOwner),
    ownerNationality: s(lead.nationality ?? lead.data?.nationality),
    ownerLanguages: lead.spokenLanguages ?? lead.data?.spokenLanguages ?? lead.languages ?? [],
    assigneeId: s(lead.assigneeId ?? lead.assignee?.id),
  };
}

export function secondaryToInformation(
  raw: SecondaryListingRaw,
  opp: OpportunityDetail,
  lead: LeadDetail,
): InformationValues {
  // Owner (existing). Owner-first listings carry the owner embedded on the listing
  // read and have NO lead row — prefer that block and fall back to the legacy lead.
  const owner = raw.owner ?? null;
  const ownerFields = owner ? ownerFieldsFromOwner(owner) : ownerFieldsFromLead(lead);
  return {
    ...INFORMATION_DEFAULTS,
    completionStatus: s(raw.completionStatus) || 'ready_secondary',
    purpose: toWizardPurpose(opp.purpose ?? raw.wizardState?.purpose),
    propertyType: s(opp.propertyType),
    neighbourhoodId: s(opp.neighbourhoodId),
    ownerSourceMode: 'existing_owner',
    ...ownerFields,
    // Property (existing — editing the linked opportunity).
    propertySourceMode: 'existing',
    existingPropertyId: s(opp.id),
    unitType: s(opp.unitType),
    bedrooms: s(opp.bedrooms),
    builtUpArea: s(opp.builtUpArea),
    bathrooms: s(opp.bathrooms),
    furnishing: s(opp.furnishing),
    view: s(opp.view),
    projectBuilding: s(opp.projectBuilding),
    towerBlock: s(opp.towerBlock),
    unitNumber: s(opp.unitNumber),
    floor: s(opp.floor),
    projectAddress: s(opp.buildingProjectAddress),
    askingPrice: s(opp.askingPrice),
    priceType: s(opp.priceType) || 'year',
    maxCheques: s(opp.maxCheques),
    deposit: s(opp.deposit),
    mortgageStatus: s(opp.mortgageStatus),
  };
}

export function primaryToInformation(raw: PrimaryListingRaw): InformationValues {
  const price = raw.sections?.highlights?.publicPrice ?? raw.sections?.highlights?.price ?? null;
  return {
    ...INFORMATION_DEFAULTS,
    completionStatus: s(raw.completionStatus) || 'ready_primary',
    purpose: toWizardPurpose(raw.purpose),
    propertyType: s(raw.propertyType),
    neighbourhoodId: s(raw.neighbourhoodId),
    projectId: s(raw.projectId),
    developerId: s(raw.developerId),
    unitType: s(raw.unitTypeId),
    availability: s(raw.availability),
    assigneeId: s(raw.assigneeId),
    bedrooms: s(raw.bedrooms),
    bathrooms: s(raw.bathrooms),
    size: s(raw.size),
    view: s(raw.viewType),
    furnishing: s(raw.furnishing),
    floor: s(raw.floor),
    totalFloors: s(raw.totalFloors),
    buildYear: s(raw.buildYear),
    occupancy: s(raw.occupancy),
    parking: s(raw.parking),
    availabilityDate: s(raw.availabilityDate),
    publicUnitNo: s(raw.publicUnitNo),
    privateUnitNo: s(raw.privateUnitNo),
    askingPrice: s(price),
    priceType: s(raw.priceType) || 'year',
    maxCheques: s(raw.maxCheques),
    deposit: s(raw.deposit),
    mortgageStatus: s(raw.mortgageStatus),
  };
}

/* ---------------------------------------------------- inverse: description */

export function toDescription(sections?: EditSectionsRaw | null): DescriptionValues {
  return { title: heroTitle(sections), description: s(sections?.hero?.description) };
}

/* -------------------------------------------------------- inverse: content */

export function toContent(
  sections: EditSectionsRaw | null | undefined,
  amenityIds: string[],
  media: {
    hero: WizardMediaItem[];
    about1: WizardMediaItem | null;
    about2: WizardMediaItem | null;
  },
): WizardContentInput {
  return {
    title: heroTitle(sections),
    description: s(sections?.hero?.description),
    heroMedia: media.hero,
    aboutImage1: media.about1,
    aboutImage2: media.about2,
    videoLink: s(sections?.hero?.videoLink),
    view360Link: s(sections?.hero?.view360Link),
    selectedAmenityIds: amenityIds,
  };
}

/* -------------------------------------------------------- inverse: permit */

function permitQr(url?: string | null, alt?: string | null): WizardMediaItem | null {
  if (!url) return null;
  return { url, name: '', mimeType: '', type: 'image', altText: s(alt), isHero: false, order: 0 };
}

function toPermit(p?: EditPermitRaw | null): WizardPublish['permit'] {
  if (!p) return EMPTY_PERMIT;
  return {
    status: s(p.status) || 'not_applied',
    permitNumber: s(p.permitNumber),
    permitUrl: s(p.permitDocumentUrl ?? p.permitUrl),
    applicationDate: s(p.applicationDate),
    approvalDate: s(p.approvalDate),
    expiryDate: s(p.expiryDate),
    rejectedDate: s(p.rejectedDate),
    rejectionReason: s(p.rejectionReason),
    notes: s(p.notes),
    qrCode: permitQr(p.qrCodeUrl, p.qrCodeAltText),
  };
}

/* -------------------------------------------------------- inverse: publish */

export function secondaryToPublish(
  raw: SecondaryListingRaw,
  permit?: EditPermitRaw | null,
): WizardPublish {
  return {
    publishToPortal: raw.wizardState?.publish?.publishToPortal ?? true,
    pushToPropertyFinder: raw.pfAgentId != null || raw.pfLocationId != null,
    pfAgentId: raw.pfAgentId != null ? String(raw.pfAgentId) : null,
    pfLocationId: raw.pfLocationId != null ? String(raw.pfLocationId) : null,
    pfPriceHidden: raw.pfPriceHidden ?? false,
    pfPublishAsDraft: raw.pfPublishAsDraft ?? false,
    permit: toPermit(permit ?? raw.trakheesiPermit),
  };
}

export function primaryToPublish(
  raw: PrimaryListingRaw,
  permit?: EditPermitRaw | null,
): WizardPublish {
  return {
    publishToPortal: raw.wizardState?.publish?.publishToPortal ?? true,
    pushToPropertyFinder: raw.pfLocationId != null,
    pfAgentId: null,
    pfLocationId: raw.pfLocationId != null ? String(raw.pfLocationId) : null,
    pfPriceHidden: false,
    pfPublishAsDraft: raw.pfPublishAsDraft ?? false,
    permit: toPermit(permit ?? raw.trakheesiPermit),
  };
}

/* ------------------------------------------------------- inverse: website */

export function toWebsite(sections?: EditSectionsRaw | null): WizardWebsiteContent {
  const h = sections?.hero;
  const a = sections?.about;
  const hi = sections?.highlights;
  const loc = sections?.location;
  const seo = sections?.seo ?? sections?.seoSettings;
  return {
    subtitle: s(h?.subtitle ?? h?.subTitle),
    aboutTitle: s(a?.title ?? a?.mainTitle),
    aboutSubtitle: s(a?.subtitle ?? a?.subTitle),
    textSection1: s(a?.textSection1),
    textSection2: s(a?.textSection2),
    additionalDescription: s(a?.additionalDescription),
    highlightsTitle: s(hi?.title ?? hi?.mainHeading),
    highlightsSubtitle: s(hi?.subtitle ?? hi?.segmentName),
    location: {
      heading: s(loc?.title),
      subtitle: s(loc?.subtitle ?? loc?.tagline),
      locationName: s(loc?.locationName),
      latitude: loc?.latitude ?? loc?.mapCenter?.latitude ?? null,
      longitude: loc?.longitude ?? loc?.mapCenter?.longitude ?? null,
    },
    seo: {
      metaTitle: s(seo?.metaTitle),
      urlSlug: s(seo?.urlSlug),
      metaDescription: s(seo?.metaDescription),
    },
  };
}

/* ------------------------------------------------- form → API update bodies */

/** Secondary property/pricing update (leadId is immutable, so it's dropped). */
export function buildOpportunityUpdate(
  v: InformationValues,
): Partial<Omit<CreateOpportunityBody, 'leadId'>> {
  const body: Record<string, unknown> = { ...buildOpportunityBody(v, '') };
  delete body.leadId;
  return body as Partial<Omit<CreateOpportunityBody, 'leadId'>>;
}

/** Secondary owner update — same body shape as create. */
export function buildLeadUpdate(v: InformationValues): Partial<CreateLeadBody> {
  return buildLeadBody(v);
}

/**
 * Owner-first owner update (PATCH /owners/:id). The Owner table stores every extra
 * as a flat column, so unlike the lead body there is no nested `data` bag. Blank
 * fields are omitted so an untouched optional never overwrites a stored value.
 */
export function buildOwnerUpdate(v: InformationValues): UpdateOwnerBody {
  const body: UpdateOwnerBody = {};
  const put = (key: keyof UpdateOwnerBody, value: string): void => {
    const trimmed = value.trim();
    if (trimmed !== '') Object.assign(body, { [key]: trimmed });
  };
  put('name', v.ownerName);
  put('email', v.ownerEmail);
  put('phone', v.ownerPhone);
  put('secondaryPhone', v.ownerSecondaryPhone);
  put('source', v.ownerSource);
  put('nationality', v.ownerNationality);
  put('gender', v.ownerGender);
  put('birthdate', v.ownerBirthdate);
  put('assigneeId', v.assigneeId);
  if (v.ownerLanguages.length > 0) body.spokenLanguages = v.ownerLanguages;
  return body;
}

/** Primary per-listing property/pricing details (for the wizard-state PATCH). */
export function buildPrimaryDetailsUpdate(v: InformationValues): ListingPropertyDetailsBody {
  const b = buildPrimaryListingBody(v);
  return {
    propertyType: b.propertyType,
    neighbourhoodId: b.neighbourhoodId,
    price: b.price,
    bedrooms: b.bedrooms,
    bathrooms: b.bathrooms,
    size: b.size,
    viewType: b.viewType,
    furnishing: b.furnishing,
    floor: b.floor,
    totalFloors: b.totalFloors,
    buildYear: b.buildYear,
    occupancy: b.occupancy,
    parking: b.parking,
    publicUnitNo: b.publicUnitNo,
    privateUnitNo: b.privateUnitNo,
    availabilityDate: b.availabilityDate,
    mortgageStatus: b.mortgageStatus,
    priceType: b.priceType,
    maxCheques: b.maxCheques,
    deposit: b.deposit,
  };
}

/** Primary core update — purpose/availability/assignee on the Listing row. */
export function buildPrimaryCoreUpdate(v: InformationValues): {
  purpose: 'for_sale' | 'for_rent';
  availability: string;
  assigneeId?: string;
} {
  const body = buildPrimaryListingBody(v);
  return {
    purpose: body.purpose,
    availability: body.availability,
    ...(body.assigneeId ? { assigneeId: body.assigneeId } : {}),
  };
}
