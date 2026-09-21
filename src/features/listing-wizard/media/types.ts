/** A media item in the wizard gallery. Newly-picked: has `uri`, no `id`. Re-seeded after a
 *  save (resync): has `id` + `url`, no `uri`. Exactly one item is the hero (order 0). */
export interface WizardMediaItem {
  id?: string;
  uri?: string;
  url?: string;
  name: string;
  mimeType: string;
  type: 'image' | 'video';
  altText: string;
  isHero: boolean;
  order: number;
}

/** A supporting document picked for upload (secondary branch). */
export interface WizardDocItem {
  uri: string;
  name: string;
  mimeType: string;
}
