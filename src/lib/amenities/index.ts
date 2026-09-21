export * from './images';
export * from './icons';
export * from './helpers';

/** Minimal common amenity shape the resolvers operate on. */
export interface CanonicalAmenity {
  id: string;
  name: string;
  slug?: string;
  icon?: string | null;
  description?: string;
  isVisible?: boolean;
  sortOrder?: number;
}
