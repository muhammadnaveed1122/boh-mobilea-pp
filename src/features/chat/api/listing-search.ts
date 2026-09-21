/**
 * Listing lookup for the `property_listing` template's image header.
 *
 * Reads the same catalogue the Properties tab shows (`getPropertiesFeed`), so
 * the agent picks from listings they already recognise — and the same source
 * web's picker uses (`/public/projects?type=buy`, plus opportunity listings).
 *
 * Search is client-side over the fetched feed. The feed endpoint takes no
 * search param, and the picker only ever shows a short list, so filtering in
 * memory avoids a second, differently-shaped request.
 *
 * Listings with no image are dropped: the URL becomes the template's IMAGE
 * header, and Meta rejects an image-header send whose media is missing (131008).
 */

import { getPropertiesFeed } from '@/features/properties/services';
import type { PropertyCard } from '@/features/properties/types';

import type { ListingCard } from '../models/contact';

function toListingCard(card: PropertyCard): ListingCard | null {
  // Videos cannot back an image header — take the first still.
  const image = card.media.find((m) => m.type === 'image');
  if (!image || image.url === '') return null;
  return {
    id: card.id,
    title: card.title,
    imageUrl: image.url,
    priceLabel: card.priceLabel,
    location: card.location ?? '',
  };
}

function matches(card: ListingCard, needle: string): boolean {
  if (needle === '') return true;
  return card.title.toLowerCase().includes(needle) || card.location.toLowerCase().includes(needle);
}

export async function searchListings(search: string): Promise<ListingCard[]> {
  const feed = await getPropertiesFeed('buy');
  const needle = search.trim().toLowerCase();
  return feed
    .map(toListingCard)
    .filter((l): l is ListingCard => l !== null)
    .filter((l) => matches(l, needle))
    .slice(0, 30);
}
