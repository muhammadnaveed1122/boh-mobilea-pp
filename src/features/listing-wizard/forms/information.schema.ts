import { z } from 'zod';

import { branchFor } from '../types';

const positiveIntString = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number');

type Req = (path: string, message: string) => void;
type Blank = (v: string | undefined) => boolean;
type RawData = {
  ownerSourceMode: string;
  existingOwnerId: string;
  ownerName: string;
  ownerPhone: string;
  propertySourceMode: string;
  existingPropertyId: string;
  bedrooms: string;
  bathrooms: string;
  unitNumber: string;
  purpose: string;
  askingPrice: string;
  projectId: string;
  developerId: string;
};

function refineSecondaryBranch(data: RawData, req: Req, blank: Blank): void {
  if (data.ownerSourceMode === 'brand_new' || blank(data.existingOwnerId)) {
    if (blank(data.ownerName)) req('ownerName', 'Name is required');
    if (blank(data.ownerPhone)) req('ownerPhone', 'Phone is required');
  }
  if (data.propertySourceMode === 'new' || blank(data.existingPropertyId)) {
    if (blank(data.bedrooms)) req('bedrooms', 'Bedrooms is required');
    if (blank(data.bathrooms)) req('bathrooms', 'Bathrooms is required');
    if (blank(data.unitNumber)) req('unitNumber', 'Unit number is required');
    if (data.purpose === 'sale' && blank(data.askingPrice)) req('askingPrice', 'Price is required');
  }
}

function refinePrimaryBranch(
  data: Pick<
    RawData,
    'projectId' | 'developerId' | 'bedrooms' | 'bathrooms' | 'purpose' | 'askingPrice'
  >,
  req: Req,
  blank: Blank,
): void {
  if (blank(data.projectId)) req('projectId', 'Project is required');
  if (blank(data.developerId)) req('developerId', 'Developer is required');
  if (blank(data.bedrooms)) req('bedrooms', 'Bedrooms is required');
  if (blank(data.bathrooms)) req('bathrooms', 'Bathrooms is required');
  if (data.purpose === 'sale' && blank(data.askingPrice)) req('askingPrice', 'Price is required');
}

export const informationSchema = z
  .object({
    // Type
    propertyType: z.string().trim(),
    completionStatus: z.string().trim().min(1, 'Completion status is required'),
    purpose: z.string().trim().min(1, 'Purpose is required'),
    // Location
    neighbourhoodId: z.string().trim().min(1, 'Community is required'),
    // Secondary — owner
    ownerSourceMode: z.enum(['brand_new', 'existing_owner']),
    existingOwnerId: z.string().trim(),
    ownerName: z.string().trim(),
    ownerEmail: z.union([z.literal(''), z.string().email('Enter a valid email')]),
    ownerPhone: z.string().trim(),
    ownerSecondaryPhone: z.string().trim(),
    ownerGender: z.string().trim(),
    ownerBirthdate: z.string().trim(),
    ownerSource: z.string().trim(),
    ownerNationality: z.string().trim(),
    ownerLanguages: z.array(z.string()),
    assigneeId: z.string().trim(),
    // Secondary — property
    propertySourceMode: z.enum(['new', 'existing']),
    existingPropertyId: z.string().trim(),
    unitType: z.string().trim(),
    bedrooms: positiveIntString,
    builtUpArea: z.string().trim(),
    bathrooms: positiveIntString,
    furnishing: z.string().trim(),
    view: z.string().trim(),
    projectBuilding: z.string().trim(),
    towerBlock: z.string().trim(),
    unitNumber: z.string().trim(),
    floor: z.string().trim(),
    projectAddress: z.string().trim(),
    // Pricing (shared)
    askingPrice: z.string().trim(),
    priceType: z.string().trim(),
    maxCheques: positiveIntString,
    deposit: z.string().trim(),
    mortgageStatus: z.string().trim(),
    // Primary
    projectId: z.string().trim(),
    developerId: z.string().trim(),
    availability: z.string().trim(),
    size: z.string().trim(),
    totalFloors: z.string().trim(),
    buildYear: z.string().trim(),
    occupancy: z.string().trim(),
    parking: positiveIntString,
    availabilityDate: z.string().trim(),
    publicUnitNo: z.string().trim(),
    privateUnitNo: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    const branch = branchFor(data.completionStatus);
    const req = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const blank = (v: string | undefined) => !v || v.trim() === '';

    if (branch === 'secondary') {
      refineSecondaryBranch(data, req, blank);
    }
    if (branch === 'primary') {
      refinePrimaryBranch(data, req, blank);
    }
  });

export type InformationValues = z.infer<typeof informationSchema>;

export const INFORMATION_DEFAULTS: InformationValues = {
  propertyType: '',
  completionStatus: '',
  purpose: '',
  neighbourhoodId: '',
  ownerSourceMode: 'brand_new',
  existingOwnerId: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerSecondaryPhone: '',
  ownerGender: '',
  ownerBirthdate: '',
  ownerSource: '',
  ownerNationality: '',
  ownerLanguages: [],
  assigneeId: '',
  propertySourceMode: 'new',
  existingPropertyId: '',
  unitType: '',
  bedrooms: '',
  builtUpArea: '',
  bathrooms: '',
  furnishing: '',
  view: '',
  projectBuilding: '',
  towerBlock: '',
  unitNumber: '',
  floor: '',
  projectAddress: '',
  askingPrice: '',
  priceType: 'year',
  maxCheques: '',
  deposit: '',
  mortgageStatus: '',
  projectId: '',
  developerId: '',
  availability: '',
  size: '',
  totalFloors: '',
  buildYear: '',
  occupancy: '',
  parking: '',
  availabilityDate: '',
  publicUnitNo: '',
  privateUnitNo: '',
};
