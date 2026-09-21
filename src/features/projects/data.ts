export type ListingStatus = 'Draft' | 'Submitted' | 'Approved' | 'Published';

export interface InterestedLead {
  id: string;
  name: string;
  intent: string;
  status: 'New' | 'Contacted' | 'Qualified';
}

export interface ListingActivity {
  id: string;
  icon: 'FilePlus' | 'Send' | 'CircleCheck' | 'Globe' | 'Eye';
  title: string;
  description: string;
  timestamp: string;
}

export interface Listing {
  id: string;
  title: string;
  location: string;
  priceAED: number;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  status: ListingStatus;
  reference: string;
  listedLabel: string;
  description: string;
  activity: ListingActivity[];
  interested: InterestedLead[];
}

export const STATUS_STYLES: Record<ListingStatus, { bg: string; fg: string }> = {
  Draft: { bg: '#F5F5F5', fg: '#525252' },
  Submitted: { bg: '#DBEAFE', fg: '#2563EB' },
  Approved: { bg: '#FFEDD5', fg: '#EA580C' },
  Published: { bg: '#DCFCE7', fg: '#16A34A' },
};

const baseActivity: ListingActivity[] = [
  {
    id: 'a1',
    icon: 'FilePlus',
    title: 'Listing created',
    description: 'Draft created by agent',
    timestamp: '5 days ago',
  },
  {
    id: 'a2',
    icon: 'Send',
    title: 'Submitted for review',
    description: 'Sent to compliance team',
    timestamp: '4 days ago',
  },
  {
    id: 'a3',
    icon: 'CircleCheck',
    title: 'Approved',
    description: 'Cleared by compliance',
    timestamp: '2 days ago',
  },
  {
    id: 'a4',
    icon: 'Globe',
    title: 'Published',
    description: 'Live on public marketplace',
    timestamp: '1 day ago',
  },
];

const baseInterested: InterestedLead[] = [
  { id: 'l1', name: 'Aisha Khan', intent: 'Buyer · Villa', status: 'Qualified' },
  { id: 'l2', name: 'Omar Saleh', intent: 'Buyer · Apartment', status: 'Contacted' },
];

export const LISTINGS: Listing[] = [
  {
    id: '1',
    title: '3BR Villa, Palm Jumeirah',
    location: 'Palm Jumeirah, Dubai',
    priceAED: 8_500_000,
    type: 'Villa',
    beds: 3,
    baths: 4,
    sqft: 4200,
    status: 'Published',
    reference: 'BOH-1001',
    listedLabel: 'Listed 5d ago',
    description: 'Beachfront villa with private pool and direct sea view. Fully furnished.',
    activity: baseActivity,
    interested: baseInterested,
  },
  {
    id: '2',
    title: '2BR Apartment, Marina Heights',
    location: 'Dubai Marina, Dubai',
    priceAED: 2_200_000,
    type: 'Apartment',
    beds: 2,
    baths: 2,
    sqft: 1250,
    status: 'Approved',
    reference: 'BOH-1002',
    listedLabel: 'Listed 3d ago',
    description: 'High-floor unit with marina view. Walking distance to JBR beach.',
    activity: baseActivity.slice(0, 3),
    interested: baseInterested.slice(0, 1),
  },
  {
    id: '3',
    title: 'Off-Plan Unit B-402',
    location: 'Business Bay, Dubai',
    priceAED: 1_800_000,
    type: 'Apartment',
    beds: 2,
    baths: 2,
    sqft: 980,
    status: 'Published',
    reference: 'BOH-1003',
    listedLabel: 'Listed 8d ago',
    description: 'Off-plan unit handover Q4 2027. Flexible payment plan available.',
    activity: baseActivity,
    interested: [],
  },
  {
    id: '4',
    title: '1BR Studio, JVC',
    location: 'Jumeirah Village Circle',
    priceAED: 750_000,
    type: 'Studio',
    beds: 1,
    baths: 1,
    sqft: 480,
    status: 'Draft',
    reference: 'BOH-1004',
    listedLabel: 'Created 1d ago',
    description: 'Compact studio near park. Ideal investment unit.',
    activity: baseActivity.slice(0, 1),
    interested: [],
  },
  {
    id: '5',
    title: '4BR Penthouse, DIFC',
    location: 'DIFC, Dubai',
    priceAED: 15_000_000,
    type: 'Penthouse',
    beds: 4,
    baths: 5,
    sqft: 6800,
    status: 'Submitted',
    reference: 'BOH-1005',
    listedLabel: 'Submitted 12h ago',
    description: 'Full-floor penthouse with private terrace and skyline view.',
    activity: baseActivity.slice(0, 2),
    interested: baseInterested,
  },
  {
    id: '6',
    title: 'Townhouse, Arabian Ranches',
    location: 'Arabian Ranches, Dubai',
    priceAED: 4_300_000,
    type: 'Townhouse',
    beds: 3,
    baths: 3,
    sqft: 2400,
    status: 'Approved',
    reference: 'BOH-1006',
    listedLabel: 'Listed 6d ago',
    description: 'Family townhouse with private garden. Community pool access.',
    activity: baseActivity.slice(0, 3),
    interested: baseInterested.slice(1),
  },
  {
    id: '7',
    title: 'Loft, City Walk',
    location: 'City Walk, Dubai',
    priceAED: 3_100_000,
    type: 'Loft',
    beds: 2,
    baths: 2,
    sqft: 1400,
    status: 'Draft',
    reference: 'BOH-1007',
    listedLabel: 'Created 2d ago',
    description: 'Double-height loft in the heart of City Walk.',
    activity: baseActivity.slice(0, 1),
    interested: [],
  },
  {
    id: '8',
    title: 'Studio, Downtown',
    location: 'Downtown, Dubai',
    priceAED: 1_250_000,
    type: 'Studio',
    beds: 1,
    baths: 1,
    sqft: 620,
    status: 'Published',
    reference: 'BOH-1008',
    listedLabel: 'Listed 10d ago',
    description: 'Burj view studio with hotel-style amenities.',
    activity: baseActivity,
    interested: baseInterested,
  },
];

export function formatAED(value: number): string {
  return `AED ${value.toLocaleString('en-US')}`;
}

export function getListing(id: string): Listing | undefined {
  return LISTINGS.find((l) => l.id === id);
}

export function leadInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const LEAD_STATUS_STYLES: Record<InterestedLead['status'], { bg: string; fg: string }> = {
  New: { bg: '#F5F5F5', fg: '#525252' },
  Contacted: { bg: '#DBEAFE', fg: '#2563EB' },
  Qualified: { bg: '#DCFCE7', fg: '#16A34A' },
};
