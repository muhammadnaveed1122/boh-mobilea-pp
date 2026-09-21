import {
  formatAedExact,
  formatSizeRange,
  propertyTypeLabel,
} from '@/features/new-projects/utils/format';
import { stripHtml } from '@/features/new-projects/utils/html';
import {
  filterVisibleAmenities,
  normalizeAmenityMedia,
  resolveAmenityLabel,
  sortAmenities,
} from '@/lib/amenities';
import type {
  PropertyAmenityItem,
  PropertyAttribute,
  PropertyDetail,
  PropertyLocationSection,
  PropertyMedia,
} from '../types';
import { asArray, asCount, asNumber, asRecord, asString, isHttpUrl } from './record';

// ---------- shared helpers ----------

function toMedia(items: unknown[]): PropertyMedia[] {
  return items
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => r !== undefined && isHttpUrl(asString(r.mediaUrl)))
    .sort((a, b) => (asNumber(a.sortOrder) ?? 0) - (asNumber(b.sortOrder) ?? 0))
    .map((r) => ({
      type: asString(r.mediaType) === 'video' ? ('video' as const) : ('image' as const),
      url: asString(r.mediaUrl) ?? '',
      altText: asString(r.altText),
    }));
}

/**
 * Human listing reference (S-1042 / R-1042). It sits at the payload ROOT next to `sections`, but
 * primary (project) and secondary (opportunity) listings differ in key casing and nesting, so probe
 * both records and both casings — same lookup web does in `extractListingMeta`.
 */
function readReference(...sources: (Record<string, unknown> | undefined)[]): string | undefined {
  for (const record of sources) {
    if (!record) continue;
    for (const key of ['reference', 'referenceNo', 'reference_no']) {
      const value = asString(record[key])?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

function pushAttr(out: PropertyAttribute[], icon: string, label: string, value?: string): void {
  const v = value?.trim();
  if (v) out.push({ icon, label, value: v });
}

interface SortableAmenity extends PropertyAmenityItem {
  sortOrder: number;
  isVisible: boolean;
}

function toAmenities(items: unknown[]): PropertyAmenityItem[] {
  const mapped = items
    .map((raw, idx): SortableAmenity | null => {
      const r = asRecord(raw);
      if (!r) return null;
      const ref = asRecord(r.amenity);
      const customTitle = asString(r.customTitle);
      const refName = asString(ref?.name) ?? asString(r.name);
      if (!customTitle && !refName) return null;
      const id = asString(r.id) ?? asString(ref?.id) ?? `amenity-${String(idx)}`;
      return {
        id,
        name: resolveAmenityLabel({ customTitle, name: refName }),
        slug: asString(ref?.slug) ?? asString(r.slug) ?? id,
        icon: asString(ref?.icon) ?? asString(r.icon),
        description: asString(r.customDescription) ?? asString(ref?.description),
        media: sortAmenities(normalizeAmenityMedia(asArray(r.media))).map((m) => ({
          type: m.mediaType,
          url: m.mediaUrl,
          altText: m.altText ?? undefined,
        })),
        sortOrder: asNumber(r.sortOrder) ?? idx,
        isVisible: r.isVisible !== false,
      };
    })
    .filter((a): a is SortableAmenity => a !== null);

  return sortAmenities(filterVisibleAmenities(mapped)).map(
    ({ sortOrder: _sortOrder, isVisible: _isVisible, ...rest }) => rest,
  );
}

function readPin(
  loc: Record<string, unknown>,
): { latitude: number; longitude: number } | undefined {
  const pin = asRecord(loc.customPinLocation);
  const center = asRecord(loc.mapCenter);
  const lat = asNumber(pin?.latitude) ?? asNumber(loc.latitude) ?? asNumber(center?.latitude);
  const lng = asNumber(pin?.longitude) ?? asNumber(loc.longitude) ?? asNumber(center?.longitude);
  if (lat === undefined || lng === undefined) return undefined;
  return { latitude: lat, longitude: lng };
}

function toLocation(loc: Record<string, unknown> | undefined): PropertyLocationSection | undefined {
  if (!loc) return undefined;
  const rawCategories = asArray(loc.categories).length > 0 ? loc.categories : loc.categoryTabs;
  const categories = asArray(rawCategories)
    .map(asRecord)
    .filter((c): c is Record<string, unknown> => c !== undefined && c.isVisible !== false)
    .map((c) => ({
      name: asString(c.title) ?? asString(c.customTitle) ?? asString(c.name) ?? '',
      distanceGroups: asArray(c.distanceGroups)
        .map(asRecord)
        .filter((g): g is Record<string, unknown> => g !== undefined)
        .map((g) => ({
          rangeLabel: asString(g.rangeLabel) ?? '',
          entries: asArray(g.entries)
            .map(asRecord)
            .filter((e): e is Record<string, unknown> => e !== undefined)
            .map((e) => ({
              name: asString(e.name) ?? '',
              address: asString(e.address),
              latitude: asNumber(e.latitude),
              longitude: asNumber(e.longitude),
            })),
        })),
    }));

  const customPinLocation = readPin(loc);
  if (categories.length === 0 && !customPinLocation) return undefined;
  return {
    title: asString(loc.title),
    tagline: asString(loc.tagline),
    customPinLocation,
    categories,
  };
}

function toTrakheesi(raw: Record<string, unknown> | undefined): PropertyDetail['trakheesi'] {
  if (!raw) return undefined;
  const qrCodeUrl = asString(raw.qrCodeUrl);
  const permitNumber = asString(raw.permitNumber);
  if (!isHttpUrl(qrCodeUrl) && !permitNumber) return undefined;
  return { permitNumber, qrCodeUrl, qrCodeAltText: asString(raw.qrCodeAltText) };
}

function aboutTexts(about: Record<string, unknown> | undefined): string[] {
  if (!about) return [];
  return [asString(about.textSection1), asString(about.textSection2)]
    .map((t) => stripHtml(t))
    .filter((t): t is string => t.length > 0);
}

// ---------- buy-project listing (ListingCmsPageResponseDto) ----------

function buildBuyAttributes(h: Record<string, unknown>): PropertyAttribute[] {
  const attrs: PropertyAttribute[] = [];
  pushAttr(attrs, 'Building', 'Developer', asString(h.developerName));
  pushAttr(attrs, 'House', 'Type', propertyTypeLabel(asString(h.propertyType)) ?? undefined);
  const sizeMin = asNumber(h.sizeMin);
  const sizeMax = asNumber(h.sizeMax);
  if (sizeMin !== undefined || sizeMax !== undefined) {
    pushAttr(attrs, 'Maximize', 'Size', formatSizeRange(sizeMin, sizeMax));
  }
  const beds = asCount(h.bedrooms);
  if (beds && beds > 0) pushAttr(attrs, 'BedDouble', 'Bedrooms', String(beds));
  const baths = asCount(h.bathrooms);
  if (baths && baths > 0) pushAttr(attrs, 'Bath', 'Baths', String(baths));
  pushAttr(
    attrs,
    'Eye',
    'View',
    propertyTypeLabel(asString(h.viewType) ?? asString(h.view)) ?? undefined,
  );
  pushAttr(attrs, 'Calendar', 'Handover', asString(h.handoverDate));
  return attrs;
}

export function normalizeBuyListingDetail(raw: unknown): PropertyDetail {
  const root = asRecord(raw) ?? {};
  const sections = asRecord(root.sections) ?? {};
  const hero = asRecord(sections.hero);
  const highlights = asRecord(sections.highlights) ?? {};
  const about = asRecord(sections.about);
  const amenities = asRecord(sections.amenities);
  const faq = asRecord(sections.faq);

  const price =
    asNumber(highlights.publicPrice) ??
    asNumber(highlights.derivedPrice) ??
    asNumber(highlights.price) ??
    0;
  const title = asString(highlights.mainHeading) ?? asString(hero?.mainTitle) ?? 'Property';
  const amenityItems = toAmenities(asArray(amenities?.items));

  return {
    listingId: asString(root.listingId),
    reference: readReference(root, asRecord(root.property), asRecord(root.listingMeta)),
    title,
    location:
      propertyTypeLabel(asString(highlights.segmentName)) ?? asString(highlights.segmentName),
    priceLabel: formatAedExact(price),
    price,
    hero: {
      mainTitle: title,
      subTitle: asString(hero?.subTitle),
      media: toMedia(asArray(hero?.media)),
    },
    attributes: buildBuyAttributes(highlights),
    about: about
      ? {
          mainTitle: asString(about.mainTitle),
          texts: aboutTexts(about),
          additionalDescription: stripHtml(asString(about.additionalDescription)) || undefined,
          media: toMedia(asArray(about.media)),
        }
      : undefined,
    amenities:
      amenityItems.length > 0
        ? {
            title: asString(amenities?.title),
            tagline: asString(amenities?.tagline),
            items: amenityItems,
          }
        : undefined,
    locationSection: toLocation(asRecord(sections.location)),
    faq: asArray(faq?.items)
      .map(asRecord)
      .filter((i): i is Record<string, unknown> => i !== undefined)
      .map((i) => ({ question: asString(i.question) ?? '', answer: asString(i.answer) ?? '' }))
      .filter((i) => i.question.length > 0),
    trakheesi: toTrakheesi(asRecord(root.trakheesiPermit)),
    agent: toAgentInfo(root),
  };
}

// ---------- opportunity listing (OpportunityListingResponseDto) ----------

function buildOpportunityAttributes(d: Record<string, unknown>): PropertyAttribute[] {
  const attrs: PropertyAttribute[] = [];
  pushAttr(attrs, 'House', 'Type', propertyTypeLabel(asString(d.propertyType)) ?? undefined);
  pushAttr(attrs, 'LayoutGrid', 'Unit Type', propertyTypeLabel(asString(d.unitType)) ?? undefined);
  pushAttr(attrs, 'Maximize', 'Size', asString(d.builtUpArea));
  const beds = asCount(d.bedrooms);
  if (beds && beds > 0) pushAttr(attrs, 'BedDouble', 'Bedrooms', String(beds));
  const baths = asCount(d.bathrooms);
  if (baths && baths > 0) pushAttr(attrs, 'Bath', 'Baths', String(baths));
  pushAttr(attrs, 'Eye', 'View', propertyTypeLabel(asString(d.view)) ?? undefined);
  pushAttr(attrs, 'Sofa', 'Furnishing', propertyTypeLabel(asString(d.furnishing)) ?? undefined);
  return attrs;
}

function buildOpportunityAbout(
  about: Record<string, unknown> | undefined,
  aboutMedia: PropertyMedia[],
): PropertyDetail['about'] {
  if (about) {
    return {
      mainTitle: asString(about.mainTitle) ?? asString(about.title),
      texts: aboutTexts(about),
      additionalDescription: stripHtml(asString(about.additionalDescription)) || undefined,
      media: aboutMedia,
    };
  }
  if (aboutMedia.length > 0) return { texts: [], media: aboutMedia };
  return undefined;
}

/**
 * Both the buy-listing (`ListingCmsPageResponseDto`) and opportunity payloads expose the
 * assigned agent under `agentInfo`; the opportunity one additionally carries role/phone.
 */
function toAgentInfo(raw: Record<string, unknown>): PropertyDetail['agent'] {
  const info = asRecord(raw.agentInfo);
  const name = asString(info?.name);
  if (!info || !name) return undefined;
  return {
    name,
    role: asString(info.role),
    avatarUrl: asString(info.avatarUrl),
    phone: asString(info.phone),
    whatsapp: asString(info.whatsapp) ?? asString(info.phone),
  };
}

export function normalizeOpportunityDetail(raw: unknown): PropertyDetail {
  const root = asRecord(raw) ?? {};
  const sections = asRecord(root.sections) ?? {};
  const mediaBySection = asRecord(root.media) ?? {};
  const derived = asRecord(root.derived) ?? {};
  const hero = asRecord(sections.hero);
  const about = asRecord(sections.about);
  const highlights = asRecord(sections.highlights);

  const price = asNumber(derived.askingPrice) ?? asNumber(highlights?.publicPrice) ?? 0;
  const title =
    asString(root.name) ?? asString(hero?.mainTitle) ?? asString(hero?.title) ?? 'Property';
  const aboutMedia = [
    ...toMedia(asArray(mediaBySection['about-image-1'])),
    ...toMedia(asArray(mediaBySection['about-image-2'])),
  ];
  const amenityItems = toAmenities(asArray(root.amenities));

  return {
    listingId: asString(root.id),
    reference: readReference(root, asRecord(root.property), asRecord(root.listingMeta)),
    title,
    location:
      asString(highlights?.segmentName) ??
      asString(asRecord(sections.location)?.title) ??
      asString(hero?.subTitle) ??
      asString(hero?.subtitle),
    priceLabel: formatAedExact(price),
    price,
    hero: {
      mainTitle: title,
      subTitle: asString(hero?.subTitle) ?? asString(hero?.subtitle),
      media: toMedia(asArray(mediaBySection.hero)),
    },
    attributes: buildOpportunityAttributes(derived),
    about: buildOpportunityAbout(about, aboutMedia),
    amenities: amenityItems.length > 0 ? { items: amenityItems } : undefined,
    locationSection: toLocation(asRecord(sections.location)),
    faq: [],
    trakheesi: toTrakheesi(asRecord(root.trakheesiPermit)),
    agent: toAgentInfo(root),
  };
}
