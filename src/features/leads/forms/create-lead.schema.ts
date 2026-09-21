import { z } from 'zod';

export const INTEREST_VALUES = ['landlord', 'buyer', 'seller', 'tenant'] as const;
export const INTEREST_TYPE_VALUES = [
  'sell_my_property',
  'rent_out_my_property',
  'find_a_property_to_rent',
  'find_a_property_to_buy',
  'get_valuation',
  'buying_selling_and_transaction',
  'other',
] as const;
export const PROPERTY_TYPE_VALUES = ['residential', 'commercial'] as const;
export const PRIORITY_VALUES = ['hot', 'warm', 'cold'] as const;

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Enter a valid phone number'),
  interest: z.enum(INTEREST_VALUES).optional(),
  interestType: z.enum(INTEREST_TYPE_VALUES).optional(),
  propertyType: z.enum(PROPERTY_TYPE_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  additionalNotes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>;

export const CREATE_LEAD_DEFAULTS: CreateLeadFormValues = {
  name: '',
  email: '',
  phone: '',
  interest: undefined,
  interestType: undefined,
  propertyType: undefined,
  priority: undefined,
  additionalNotes: '',
};
