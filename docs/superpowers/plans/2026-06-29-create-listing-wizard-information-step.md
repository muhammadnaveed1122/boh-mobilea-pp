# Create Listing Wizard — Information Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Create-Listing wizard scaffold (4-step stepper) and a faithful mobile replica of the web **Information** step — both Primary and Secondary branches, every field, all API selects with loading/error/empty states. Form + validation only; "Save & continue" is a no-op.

**Architecture:** New feature folder `src/features/listing-wizard/`. A single `useAppForm` (TanStack Form + Zod) holds all Information-step values; `CreateListingWizard` owns the form and renders a stepper + the `InformationStep` (composed of section components that receive the `form`) + a footer. API selects fetch via TanStack Query hooks and render through a shared `ApiSelectField` (loading/error/retry/empty). A new `FormMultiSelect` field handles spoken languages.

**Tech Stack:** Expo Router, React 19, TanStack Query + TanStack React Form, Zod, axios `apiClient`, NativeWind v4, TypeScript strict.

## Global Constraints

- **No test runner** in this repo. Verify EVERY task with `pnpm exec tsc --noEmit` (0 errors) AND `pnpm lint` (0 errors), then manual QA. Do NOT add a test framework (project rule).
- Package manager **pnpm**. Never touch `package-lock.json`.
- Styling: semantic Tailwind tokens only (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-brand`, `text-brand-foreground`, `text-destructive`). No hard-coded hex except where existing listings code already does.
- Props typed `Readonly<{...}>`. Single quotes, semis, trailing commas, 100-col, 2-space (prettier auto-runs on commit).
- Imports: `@/` → `src/`, `@theme` → `theme`.
- eslint sonarjs cognitive-complexity cap = **20**; duplicate-string threshold 5. Decompose / extract helpers if a function trips it.
- Mobile axios base = `EXPO_PUBLIC_API_BASE_URL`; all backend paths are prefixed `/api/v1/...` (matches existing `services.ts`). Endpoint prefixes are assumed — flagged for QA, do not block on them.
- Branch: `feat/mobile-project-listing` (current). Commit after each task.
- **Save & continue is a no-op this increment.** No create POST, no draft, no steps 2–4 bodies, no server-side search.

---

### Task 1: Constants + types

**Files:**

- Create: `src/features/listing-wizard/constants.ts`
- Create: `src/features/listing-wizard/types.ts`

**Interfaces:**

- Produces: option arrays `COMPLETION_STATUS_OPTIONS`, `PURPOSE_OPTIONS`, `PURPOSE_OPTIONS_SALE_ONLY`, `PROPERTY_TYPE_GROUPS`, `PROPERTY_USE_BY_TYPE`, `UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE`, `FURNISHING_OPTIONS`, `VIEW_OPTIONS`, `AVAILABILITY_OPTIONS`, `AVAILABILITY_OPTIONS_RENT`, `GENDER_OPTIONS`, `OWNER_SOURCE_OPTIONS`, `SPOKEN_LANGUAGE_OPTIONS`, `RENT_PRICE_TYPE_OPTIONS`, `MORTGAGE_STATUS_OPTIONS`, `OCCUPANCY_OPTIONS`, `NATIONALITY_OPTIONS`; types `Opt`, `CompletionStatus`, `ListingBranch`, `WizardStepId`, `branchFor(status)`.

- [ ] **Step 1: Create `types.ts`**

```typescript
export interface Opt {
  value: string;
  label: string;
}

export type CompletionStatus =
  | 'ready_primary'
  | 'off_plan_primary'
  | 'ready_secondary'
  | 'off_plan_secondary';

export type ListingBranch = 'primary' | 'secondary';
export type WizardStepId = 'information' | 'description' | 'media' | 'portals';

export function branchFor(status: string): ListingBranch | null {
  if (status === 'ready_primary' || status === 'off_plan_primary') return 'primary';
  if (status === 'ready_secondary' || status === 'off_plan_secondary') return 'secondary';
  return null;
}

export function isOffPlan(status: string): boolean {
  return status === 'off_plan_primary' || status === 'off_plan_secondary';
}
```

- [ ] **Step 2: Create `constants.ts`** (verbatim option arrays ported from web — exact values)

```typescript
import type { Opt } from './types';

export const COMPLETION_STATUS_OPTIONS: readonly Opt[] = [
  { value: 'ready_primary', label: 'Ready Primary' },
  { value: 'off_plan_primary', label: 'Off-plan Primary' },
  { value: 'ready_secondary', label: 'Ready Secondary' },
  { value: 'off_plan_secondary', label: 'Off-plan Secondary' },
];

export const PURPOSE_OPTIONS: readonly Opt[] = [
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
];
export const PURPOSE_OPTIONS_SALE_ONLY: readonly Opt[] = [{ value: 'sale', label: 'For Sale' }];

/** Grouped property types (mixed_use excluded, per web). */
export const PROPERTY_TYPE_GROUPS: readonly { title: string; options: readonly Opt[] }[] = [
  {
    title: 'Residential',
    options: [
      { value: 'apartment', label: 'Apartment' },
      { value: 'villa', label: 'Villa' },
      { value: 'townhouse', label: 'Townhouse' },
      { value: 'residential_plot', label: 'Residential Plot' },
    ],
  },
  {
    title: 'Commercial',
    options: [
      { value: 'office', label: 'Office' },
      { value: 'retail', label: 'Retail' },
      { value: 'warehouse', label: 'Warehouse' },
      { value: 'commercial_plot', label: 'Commercial Plot' },
    ],
  },
];

/** propertyUse derived from a propertyType's group. */
export const PROPERTY_USE_BY_TYPE: Record<string, 'residential' | 'commercial'> = {
  apartment: 'residential',
  villa: 'residential',
  townhouse: 'residential',
  residential_plot: 'residential',
  office: 'commercial',
  retail: 'commercial',
  warehouse: 'commercial',
  commercial_plot: 'commercial',
};

export const UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE: Record<string, readonly Opt[]> = {
  apartment: [
    { value: 'studio', label: 'Studio' },
    { value: 'one_br', label: '1BR' },
    { value: 'two_br', label: '2BR' },
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
    { value: 'six_br_plus', label: '6BR+' },
    { value: 'penthouse', label: 'Penthouse' },
  ],
  villa: [
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
    { value: 'six_br_plus', label: '6BR+' },
    { value: 'mansion', label: 'Mansion' },
  ],
  townhouse: [
    { value: 'two_br', label: '2BR' },
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
  ],
  residential_plot: [{ value: 'residential_plot', label: 'Residential Plot' }],
  office: [
    { value: 'shell_core', label: 'Shell & Core' },
    { value: 'fitted', label: 'Fitted' },
    { value: 'furnished', label: 'Furnished' },
    { value: 'full_floor', label: 'Full Floor' },
  ],
  retail: [
    { value: 'retail_unit', label: 'Retail Unit' },
    { value: 'fnb_unit', label: 'F&B Unit' },
    { value: 'kiosk', label: 'Kiosk' },
  ],
  warehouse: [{ value: 'warehouse', label: 'Warehouse' }],
  commercial_plot: [{ value: 'commercial_plot', label: 'Commercial Plot' }],
};

export const FURNISHING_OPTIONS: readonly Opt[] = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'semi_furnished', label: 'Semi Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
];

export const VIEW_OPTIONS: readonly Opt[] = [
  { value: 'sea_view', label: 'Sea View' },
  { value: 'city_view', label: 'City View' },
  { value: 'garden_view', label: 'Garden View' },
  { value: 'pool_view', label: 'Pool View' },
  { value: 'canal_view', label: 'Canal View' },
  { value: 'golf_view', label: 'Golf View' },
  { value: 'landmark_view', label: 'Landmark View' },
  { value: 'community_view', label: 'Community View' },
  { value: 'park_view', label: 'Park View' },
  { value: 'marina_view', label: 'Marina View' },
  { value: 'boulevard_view', label: 'Boulevard View' },
  { value: 'other', label: 'Other' },
];

const AVAILABILITY_BASE: readonly Opt[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'off_market', label: 'Off Market' },
  { value: 'unavailable', label: 'Unavailable' },
];
export const AVAILABILITY_OPTIONS: readonly Opt[] = [
  ...AVAILABILITY_BASE,
  { value: 'sold', label: 'Sold' },
];
export const AVAILABILITY_OPTIONS_RENT: readonly Opt[] = [
  ...AVAILABILITY_BASE,
  { value: 'rented', label: 'Rented' },
];

export const GENDER_OPTIONS: readonly Opt[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const OWNER_SOURCE_OPTIONS: readonly Opt[] = [
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'portal', label: 'Portal' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'other', label: 'Other' },
];

export const SPOKEN_LANGUAGE_OPTIONS: readonly Opt[] = [
  'English',
  'Arabic',
  'Hindi',
  'Urdu',
  'French',
  'Spanish',
  'Russian',
  'Mandarin',
  'German',
  'Italian',
  'Portuguese',
  'Tagalog',
  'Bengali',
  'Persian',
  'Turkish',
  'Malayalam',
  'Tamil',
  'Punjabi',
].map((l) => ({ value: l, label: l }));

export const RENT_PRICE_TYPE_OPTIONS: readonly Opt[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

export const MORTGAGE_STATUS_OPTIONS: readonly Opt[] = [
  { value: 'mortgaged', label: 'Mortgaged' },
  { value: 'no_mortgage', label: 'No mortgage' },
];

export const OCCUPANCY_OPTIONS: readonly Opt[] = [
  { value: 'owner_occupied', label: 'Owner Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'rented', label: 'Rented' },
];

/** ISO alpha-2 nationality list (ported from web nationalityOptions.ts). */
export const NATIONALITY_OPTIONS: readonly Opt[] = [
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'IN', label: 'India' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'EG', label: 'Egypt' },
  { value: 'PH', label: 'Philippines' },
  { value: 'JO', label: 'Jordan' },
  { value: 'LB', label: 'Lebanon' },
  { value: 'SY', label: 'Syria' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'IT', label: 'Italy' },
  { value: 'RU', label: 'Russia' },
  { value: 'CN', label: 'China' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'other', label: 'Other' },
];
```

> NOTE: The implementer SHOULD open the web file
> `boh-lead-magnet/src/components/molecules/form/nationality-select/nationalityOptions.ts` and copy the
> FULL country list verbatim (it has 50+ entries). The array above is a correct-shape starter; replace
> it with the complete web list so parity holds.

- [ ] **Step 3: Typecheck, lint, commit**

```bash
cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/constants.ts src/features/listing-wizard/types.ts
git commit -m "feat(listing-wizard): add information-step constants and types"
```

---

### Task 2: API services

**Files:**

- Create: `src/features/listing-wizard/services.ts`

**Interfaces:**

- Consumes: `apiClient` from `@/lib/api`; `Opt` from `./types`.
- Produces: `getNeighbourhoods(search?)`, `getOwnerLeads(search?)`, `getLeadDetail(id)`, `getOwnerProperties(leadId, search?)`, `getListingProjects(search?)`, `getListingUnitTypes(projectId)`, `getWizardAgents()` — each returning `Opt[]` (or a detail object for `getLeadDetail`). Plus `LeadDetail`, `ProjectOption`, `UnitTypeOption` types.

> NOTE: Reuse existing mobile services where the endpoint + shape already match. `getListingAgents()` in
> `src/features/listings/services.ts` hits `/api/v1/opportunity-listing/agents` (returns `{id,name}`) —
> if the web `/agents` agent list is equivalent for assignee selection, the implementer MAY reuse
> `getListingAgents` instead of adding `getWizardAgents`; note the choice in the report. Otherwise add
> `getWizardAgents` per below.

- [ ] **Step 1: Create `services.ts`**

```typescript
import { apiClient } from '@/lib/api';
import type { Opt } from './types';

interface Paginated<T> {
  items: T[];
  page?: number;
  totalPages?: number;
}

export interface ProjectOption extends Opt {
  developerId?: string | null;
  developerName?: string | null;
}

export interface UnitTypeOption extends Opt {
  usedPurposes?: string[];
}

export interface LeadDetail {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  assigneeId?: string | null;
}

export async function getNeighbourhoods(search?: string): Promise<Opt[]> {
  const { data } = await apiClient.get<Paginated<{ id: string; name: string }>>(
    '/api/v1/locations/neighbourhoods',
    { params: { page: 1, limit: 50, search: search?.trim() || undefined } },
  );
  return (data.items ?? []).map((n) => ({ value: n.id, label: n.name }));
}

export async function getOwnerLeads(search?: string): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{ id: string; name?: string | null; email?: string | null }>
  >('/api/v1/leads', {
    params: {
      interest: 'seller',
      search: search?.trim() || undefined,
      page: 1,
      perPage: 50,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
  });
  return (data.items ?? []).map((l) => ({
    value: l.id,
    label: l.name?.trim() ? l.name : (l.email ?? 'Unnamed lead'),
  }));
}

export async function getLeadDetail(id: string): Promise<LeadDetail> {
  const { data } = await apiClient.get<LeadDetail>(`/api/v1/leads/${id}`);
  return data;
}

export async function getOwnerProperties(leadId: string, search?: string): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{ id: string; projectBuilding?: string | null; unitNumber?: string | null }>
  >('/api/v1/opportunities', {
    params: { leadId, search: search?.trim() || undefined, limit: 20 },
  });
  return (data.items ?? []).map((o) => ({
    value: o.id,
    label: o.projectBuilding?.trim() ? o.projectBuilding : `Unit ${o.unitNumber ?? ''}`.trim(),
  }));
}

export async function getListingProjects(search?: string): Promise<ProjectOption[]> {
  const { data } = await apiClient.get<
    Paginated<{
      id: string;
      name: string;
      developerId?: string | null;
      developerName?: string | null;
    }>
  >('/api/v1/listings/projects', { params: { search: search?.trim() || undefined } });
  return (data.items ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    developerId: p.developerId ?? null,
    developerName: p.developerName ?? null,
  }));
}

export async function getListingUnitTypes(projectId: string): Promise<UnitTypeOption[]> {
  const { data } = await apiClient.get<
    Paginated<{
      id: string;
      displayLabel?: string | null;
      unitType?: string | null;
      usedPurposes?: string[];
    }>
  >('/api/v1/listings/unit-types', { params: { projectId } });
  return (data.items ?? []).map((u) => ({
    value: u.id,
    label: u.displayLabel ?? u.unitType ?? u.id,
    usedPurposes: u.usedPurposes ?? [],
  }));
}

export async function getWizardAgents(): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{
      id: string;
      email?: string | null;
      profile?: {
        fullName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    }>
  >('/api/v1/agents', { params: { page: 1, limit: 100, isActive: true } });
  return (data.items ?? []).map((a) => {
    const full = a.profile?.fullName?.trim();
    const composed = [a.profile?.firstName, a.profile?.lastName].filter(Boolean).join(' ').trim();
    return { value: a.id, label: full || composed || (a.email ?? 'Agent') };
  });
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add information-step API services"
```

---

### Task 3: Query hooks

**Files:**

- Create: `src/features/listing-wizard/hooks/use-wizard-options.ts`

**Interfaces:**

- Consumes: services from Task 2; `@tanstack/react-query` `useQuery`.
- Produces: `useNeighbourhoods()`, `useOwnerLeads()`, `useOwnerProperties(leadId?)`, `useListingProjects()`, `useListingUnitTypes(projectId?)`, `useWizardAgents()`, `useLeadDetailQuery(id?)` — each returning `{ data, isLoading, isError, refetch }` (options arrays default `[]`).

- [ ] **Step 1: Create `hooks/use-wizard-options.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import {
  getLeadDetail,
  getListingProjects,
  getListingUnitTypes,
  getNeighbourhoods,
  getOwnerLeads,
  getOwnerProperties,
  getWizardAgents,
  type LeadDetail,
  type Opt,
  type ProjectOption,
  type UnitTypeOption,
} from '../services';

const FIVE_MIN = 5 * 60 * 1000;

export function useNeighbourhoods() {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'neighbourhoods'],
    queryFn: () => getNeighbourhoods(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useOwnerLeads() {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'owner-leads'],
    queryFn: () => getOwnerLeads(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useOwnerProperties(leadId?: string) {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'owner-properties', leadId],
    queryFn: () => getOwnerProperties(leadId as string),
    enabled: !!leadId,
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useListingProjects() {
  const q = useQuery<ProjectOption[]>({
    queryKey: ['wizard', 'projects'],
    queryFn: () => getListingProjects(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useListingUnitTypes(projectId?: string) {
  const q = useQuery<UnitTypeOption[]>({
    queryKey: ['wizard', 'unit-types', projectId],
    queryFn: () => getListingUnitTypes(projectId as string),
    enabled: !!projectId,
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useWizardAgents() {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'agents'],
    queryFn: () => getWizardAgents(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useLeadDetailQuery(id?: string) {
  return useQuery<LeadDetail>({
    queryKey: ['wizard', 'lead-detail', id],
    queryFn: () => getLeadDetail(id as string),
    enabled: !!id,
  });
}
```

> NOTE: `Opt` is exported from `./types` (Task 1) but re-imported here from `../services` for
> convenience — the implementer must ensure `services.ts` re-exports `Opt` (`export type { Opt } from './types';`)
> OR change these imports to pull `Opt` from `../types`. Pick one and keep it consistent; tsc will enforce it.

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/hooks/use-wizard-options.ts
git commit -m "feat(listing-wizard): add option-fetching query hooks"
```

---

### Task 4: MultiSelect atom + FormMultiSelect field

**Files:**

- Create: `src/components/atoms/MultiSelect.tsx`
- Create: `src/components/molecules/forms/input-fields/multi-select.tsx`
- Modify: `src/components/molecules/forms/hook.ts` (register `MultiSelect`)

**Interfaces:**

- Consumes: existing `Select` atom primitives, `Checkbox` atom, `FormBase`, `useFieldContext`.
- Produces: `MultiSelect` atom (`value: string[]`, `onValueChange: (v: string[]) => void`, `options`, `placeholder`); `FormMultiSelect` field (registered as `MultiSelect` in `useAppForm`).

- [ ] **Step 1: Read the existing primitives**

Read `src/components/atoms/Select.tsx` (bottom-sheet pattern), `src/components/atoms/Checkbox.tsx`, and `src/components/molecules/forms/input-fields/select.tsx` + `formbase.tsx`. Mirror the Select bottom-sheet structure for `MultiSelect`.

- [ ] **Step 2: Create `MultiSelect.tsx`** — a bottom-sheet (same Modal/portal approach as `Select`) listing options with a `Checkbox` per row; tapping toggles membership in the `value` array; trigger shows a summary ("N selected" or the single label). Keep the component under cognitive-complexity 20 by extracting the row renderer.

```typescript
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';

interface MultiSelectProps {
  value: string[];
  onValueChange: (next: string[]) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  hasError,
}: Readonly<MultiSelectProps>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} selected`;

  const toggle = (v: string) => {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          'h-12 flex-row items-center justify-between rounded-xl border bg-card px-3',
          hasError ? 'border-destructive' : 'border-border',
          disabled && 'opacity-50',
        )}
      >
        <Text
          className={cn('flex-1 text-sm', selectedLabels.length ? 'text-foreground' : 'text-muted-foreground')}
          numberOfLines={1}
        >
          {summary}
        </Text>
        <Icon name="ChevronDown" size={18} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50" style={palette}>
          <Pressable className="flex-1" onPress={() => setOpen(false)} accessibilityLabel="Dismiss" />
          <View className="max-h-[70%] rounded-t-3xl bg-background" style={{ paddingBottom: 12 + insets.bottom }}>
            <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
              <Text className="text-base font-semibold text-foreground">Select</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text className="text-sm font-medium text-brand">Done</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => toggle(o.value)}
                  className="mb-1 flex-row items-center gap-3 rounded-xl px-2 py-3"
                >
                  <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                  <Text className="flex-1 text-sm text-foreground">{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
```

> NOTE: Match the `Checkbox` atom's actual prop names (`checked`/`onCheckedChange` are typical RNR; the
> implementer must confirm against `src/components/atoms/Checkbox.tsx` and adjust). If `ChevronDown` is
> not a valid `IconName`, use the same chevron the `Select` atom uses.

- [ ] **Step 3: Create `FormMultiSelect`** (`input-fields/multi-select.tsx`)

```typescript
import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { MultiSelect } from '@/components/atoms/MultiSelect';

type FormMultiSelectProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
};

export function FormMultiSelect({
  label,
  required,
  options,
  placeholder = 'Select…',
  disabled,
}: Readonly<FormMultiSelectProps>) {
  const field = useFieldContext<string[]>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  return (
    <FormBase label={label} required={required}>
      <MultiSelect
        value={field.state.value ?? []}
        onValueChange={(next) => {
          field.handleChange(next);
          field.handleBlur();
        }}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        hasError={hasError}
      />
    </FormBase>
  );
}
```

> NOTE: Confirm `FormBase`'s exported prop type name and the `useFieldContext` import path against
> `src/components/molecules/forms/input-fields/select.tsx` (the existing FormSelect) and mirror exactly.

- [ ] **Step 4: Register in `hook.ts`** — add the import and the `MultiSelect: FormMultiSelect` entry to `fieldComponents`.

```typescript
import { FormMultiSelect } from './input-fields/multi-select';
// ...inside fieldComponents:
    MultiSelect: FormMultiSelect,
```

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/atoms/MultiSelect.tsx src/components/molecules/forms/input-fields/multi-select.tsx src/components/molecules/forms/hook.ts
git commit -m "feat(forms): add MultiSelect atom and FormMultiSelect field"
```

---

### Task 5: ApiSelectField (loading / error / empty wrapper)

**Files:**

- Create: `src/features/listing-wizard/components/ApiSelectField.tsx`

**Interfaces:**

- Consumes: `Select` primitives, `FormBase`, `useFieldContext`, `Opt`.
- Produces: `ApiSelectField` — props `{ label, required?, placeholder?, options: Opt[], isLoading, isError, onRetry, disabled?, onSelected?(value) }`. Renders inside a `form.AppField` via the field-context pattern (it reads the current field value/handlers itself), showing loading/error/empty states around a `Select`.

- [ ] **Step 1: Create `ApiSelectField.tsx`**

```typescript
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { useFieldContext } from '@/components/molecules/forms/contexts';
import { FormBase } from '@/components/molecules/forms/formbase';
import type { Opt } from '../types';

interface Props {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: Opt[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  disabled?: boolean;
  /** Called in addition to field.handleChange when an option is picked (e.g. prefill). */
  onSelected?: (value: string | undefined) => void;
}

export function ApiSelectField({
  label,
  required,
  placeholder = 'Select…',
  options,
  isLoading,
  isError,
  onRetry,
  disabled,
  onSelected,
}: Readonly<Props>) {
  const field = useFieldContext<string | undefined>();
  const brand = useThemeColor('--brand');
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  const current = field.state.value ? options.find((o) => o.value === field.state.value) : undefined;

  return (
    <FormBase label={label} required={required}>
      {isError ? (
        <View className="rounded-xl border border-destructive bg-card px-3 py-3">
          <Text className="text-xs text-destructive">Could not load options.</Text>
          <Pressable onPress={onRetry} hitSlop={8} className="mt-1">
            <Text className="text-xs font-semibold text-brand">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <Select
          value={current}
          disabled={disabled || isLoading}
          onValueChange={(opt) => {
            field.handleChange(opt?.value);
            field.handleBlur();
            onSelected?.(opt?.value);
          }}
        >
          <SelectTrigger hasError={hasError}>
            {isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={brand} />
                <Text className="text-sm text-muted-foreground">Loading…</Text>
              </View>
            ) : (
              <SelectValue placeholder={options.length === 0 ? 'No options' : placeholder} />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} label={o.label} />
            ))}
          </SelectContent>
        </Select>
      )}
    </FormBase>
  );
}
```

> NOTE: Confirm `SelectTrigger` accepts `hasError`, and `Select` accepts `disabled` — both are used by
> the existing `FormSelect`. Match exactly. If `useFieldContext`/`FormBase` import paths differ, mirror
> `input-fields/select.tsx`.

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/ApiSelectField.tsx
git commit -m "feat(listing-wizard): add ApiSelectField (loading/error/empty select)"
```

---

### Task 6: Information form schema + form hook

**Files:**

- Create: `src/features/listing-wizard/forms/information.schema.ts`
- Create: `src/features/listing-wizard/forms/information.form.ts`

**Interfaces:**

- Consumes: `zod`, `useAppForm` from `@/components/molecules/forms/hook`.
- Produces: `informationSchema` (Zod, branch-aware via superRefine), `InformationValues` type, `INFORMATION_DEFAULTS`, `useInformationForm()`.

- [ ] **Step 1: Create `information.schema.ts`** — one flat value object covering both branches; `superRefine` enforces the branch-specific required fields (mirror web `wizardSchemas.ts`).

```typescript
import { z } from 'zod';
import { branchFor } from '../types';

const positiveIntString = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number');

export const informationSchema = z
  .object({
    // Type
    propertyType: z.string().trim().optional().default(''),
    completionStatus: z.string().trim().min(1, 'Completion status is required'),
    purpose: z.string().trim().min(1, 'Purpose is required'),
    // Location
    neighbourhoodId: z.string().trim().min(1, 'Community is required'),
    // Secondary — owner
    ownerSourceMode: z.enum(['brand_new', 'existing_owner']).default('brand_new'),
    existingOwnerId: z.string().trim().optional().default(''),
    ownerName: z.string().trim().optional().default(''),
    ownerEmail: z.union([z.literal(''), z.string().email('Enter a valid email')]).default(''),
    ownerPhone: z.string().trim().optional().default(''),
    ownerGender: z.string().trim().optional().default(''),
    ownerBirthdate: z.string().trim().optional().default(''),
    ownerSource: z.string().trim().optional().default(''),
    ownerNationality: z.string().trim().optional().default(''),
    ownerLanguages: z.array(z.string()).default([]),
    assigneeId: z.string().trim().optional().default(''),
    // Secondary — property
    propertySourceMode: z.enum(['new', 'existing']).default('new'),
    existingPropertyId: z.string().trim().optional().default(''),
    unitType: z.string().trim().optional().default(''),
    bedrooms: positiveIntString.optional().default(''),
    builtUpArea: z.string().trim().optional().default(''),
    bathrooms: positiveIntString.optional().default(''),
    furnishing: z.string().trim().optional().default(''),
    view: z.string().trim().optional().default(''),
    projectBuilding: z.string().trim().optional().default(''),
    towerBlock: z.string().trim().optional().default(''),
    unitNumber: z.string().trim().optional().default(''),
    floor: z.string().trim().optional().default(''),
    projectAddress: z.string().trim().optional().default(''),
    // Pricing (shared)
    askingPrice: z.string().trim().optional().default(''),
    priceType: z.string().trim().optional().default(''),
    maxCheques: positiveIntString.optional().default(''),
    deposit: z.string().trim().optional().default(''),
    mortgageStatus: z.string().trim().optional().default(''),
    // Primary
    projectId: z.string().trim().optional().default(''),
    developerId: z.string().trim().optional().default(''),
    availability: z.string().trim().optional().default(''),
    size: z.string().trim().optional().default(''),
    totalFloors: z.string().trim().optional().default(''),
    buildYear: z.string().trim().optional().default(''),
    occupancy: z.string().trim().optional().default(''),
    parking: positiveIntString.optional().default(''),
    availabilityDate: z.string().trim().optional().default(''),
    publicUnitNo: z.string().trim().optional().default(''),
    privateUnitNo: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
    const branch = branchFor(data.completionStatus);
    const req = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const blank = (v: string | undefined) => !v || v.trim() === '';

    if (branch === 'secondary') {
      if (data.ownerSourceMode === 'brand_new' || blank(data.existingOwnerId)) {
        if (blank(data.ownerName)) req('ownerName', 'Name is required');
        if (blank(data.ownerPhone)) req('ownerPhone', 'Phone is required');
      }
      if (data.propertySourceMode === 'new' || blank(data.existingPropertyId)) {
        if (blank(data.bedrooms)) req('bedrooms', 'Bedrooms is required');
        if (blank(data.bathrooms)) req('bathrooms', 'Bathrooms is required');
        if (blank(data.unitNumber)) req('unitNumber', 'Unit number is required');
        if (data.purpose === 'sale' && blank(data.askingPrice))
          req('askingPrice', 'Price is required');
      }
    }

    if (branch === 'primary') {
      if (blank(data.projectId)) req('projectId', 'Project is required');
      if (blank(data.developerId)) req('developerId', 'Developer is required');
      if (blank(data.bedrooms)) req('bedrooms', 'Bedrooms is required');
      if (blank(data.bathrooms)) req('bathrooms', 'Bathrooms is required');
      if (data.purpose === 'sale' && blank(data.askingPrice))
        req('askingPrice', 'Price is required');
    }
  });

export type InformationValues = z.infer<typeof informationSchema>;

export const INFORMATION_DEFAULTS: InformationValues = informationSchema.parse({
  completionStatus: '',
  purpose: '',
  neighbourhoodId: '',
});
```

> NOTE: `informationSchema.parse({...})` for defaults will THROW because `completionStatus`/`purpose`/
> `neighbourhoodId` are `min(1)` required. Instead build `INFORMATION_DEFAULTS` as a plain object literal
> with every field defaulted (`''`, `[]`, `'brand_new'`, `'new'`). The implementer must hand-write the
> defaults object (all keys, empty values) rather than `.parse({})`. Keep keys in sync with the schema.

- [ ] **Step 2: Create `information.form.ts`**

```typescript
import { useAppForm } from '@/components/molecules/forms/hook';
import { informationSchema, INFORMATION_DEFAULTS } from './information.schema';

export function useInformationForm() {
  return useAppForm({
    defaultValues: INFORMATION_DEFAULTS,
    validators: { onChange: informationSchema },
    onSubmit: async () => {
      // No-op this increment — "Save & continue" does nothing yet.
    },
  });
}
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/forms/information.schema.ts src/features/listing-wizard/forms/information.form.ts
git commit -m "feat(listing-wizard): add branch-aware information schema + form hook"
```

---

### Task 7: Type + Location sections

**Files:**

- Create: `src/features/listing-wizard/components/steps/TypeSection.tsx`
- Create: `src/features/listing-wizard/components/steps/LocationSection.tsx`

**Interfaces:**

- Consumes: the `form` instance from `useInformationForm` (passed as prop), `FormSelect`, `ApiSelectField`, `useNeighbourhoods`, constants, `isOffPlan`.
- Produces: `TypeSection({ form })`, `LocationSection({ form })`. The `form` type is `ReturnType<typeof useInformationForm>`.

> The `form` prop type is awkward to name; define a shared alias in `types.ts`:
> `export type InformationForm = ReturnType<typeof import('./forms/information.form').useInformationForm>;`
> — OR pass `form: any`-free by importing the hook's return type. Implementer: add
> `export type InformationForm = ReturnType<typeof useInformationForm>;` in `information.form.ts` and import it.

- [ ] **Step 1: Add `InformationForm` type export** to `forms/information.form.ts`:

```typescript
export type InformationForm = ReturnType<typeof useInformationForm>;
```

- [ ] **Step 2: Create `TypeSection.tsx`** — Property Type (grouped static), Completion Status (required), Purpose (required; sale-only when off-plan). Use `form.AppField` + `field.Select`. Flatten `PROPERTY_TYPE_GROUPS` into a single options array (the bottom-sheet Select has client search; grouping is optional — render flat for now).

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import {
  COMPLETION_STATUS_OPTIONS,
  PROPERTY_TYPE_GROUPS,
  PURPOSE_OPTIONS,
  PURPOSE_OPTIONS_SALE_ONLY,
} from '../../constants';
import { isOffPlan } from '../../types';
import type { InformationForm } from '../../forms/information.form';

const PROPERTY_TYPE_OPTIONS = PROPERTY_TYPE_GROUPS.flatMap((g) => g.options);

export function TypeSection({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-foreground">Type</Text>

      <form.AppField name="propertyType">
        {(field) => (
          <field.Select label="Property Type" options={PROPERTY_TYPE_OPTIONS} placeholder="Select property type" />
        )}
      </form.AppField>

      <form.AppField name="completionStatus">
        {(field) => (
          <field.Select
            label="Completion Status"
            required
            options={COMPLETION_STATUS_OPTIONS}
            placeholder="Select completion status"
          />
        )}
      </form.AppField>

      <form.Subscribe selector={(s) => s.values.completionStatus}>
        {(completionStatus) => (
          <form.AppField name="purpose">
            {(field) => (
              <field.Select
                label="Purpose"
                required
                options={isOffPlan(completionStatus) ? PURPOSE_OPTIONS_SALE_ONLY : PURPOSE_OPTIONS}
                placeholder="Select purpose"
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>
    </View>
  );
}
```

- [ ] **Step 3: Create `LocationSection.tsx`** — Community via `ApiSelectField` + `useNeighbourhoods`.

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { ApiSelectField } from '../ApiSelectField';
import { useNeighbourhoods } from '../../hooks/use-wizard-options';
import type { InformationForm } from '../../forms/information.form';

export function LocationSection({ form }: Readonly<{ form: InformationForm }>) {
  const neighbourhoods = useNeighbourhoods();
  return (
    <View className="mt-5 gap-3">
      <Text className="text-sm font-semibold text-foreground">Location</Text>
      <form.AppField name="neighbourhoodId">
        {() => (
          <ApiSelectField
            label="Community"
            required
            placeholder="Select community"
            options={neighbourhoods.data}
            isLoading={neighbourhoods.isLoading}
            isError={neighbourhoods.isError}
            onRetry={() => neighbourhoods.refetch()}
          />
        )}
      </form.AppField>
    </View>
  );
}
```

> NOTE: `ApiSelectField` reads the field via `useFieldContext`, so it must render INSIDE `form.AppField`'s
> child (the field context is provided there). Confirm TanStack Form provides field context to descendants
> rendered within the `AppField` children function; if not, pass the field explicitly instead. The
> implementer verifies against how `field.Select` resolves its context and mirrors it.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/steps/TypeSection.tsx src/features/listing-wizard/components/steps/LocationSection.tsx src/features/listing-wizard/forms/information.form.ts
git commit -m "feat(listing-wizard): add Type and Location sections"
```

---

### Task 8: Secondary branch — Owner + Property sections

**Files:**

- Create: `src/features/listing-wizard/components/steps/OwnerSection.tsx`
- Create: `src/features/listing-wizard/components/steps/SecondaryPropertySection.tsx`
- Create: `src/features/listing-wizard/components/steps/SegmentedToggle.tsx` (shared 2-option toggle)

**Interfaces:**

- Consumes: `form`, `FormInput`/`FormPhoneInput`/`FormDatePicker`/`FormSelect`/`FormMultiSelect`, `ApiSelectField`, hooks (`useOwnerLeads`, `useLeadDetailQuery`, `useOwnerProperties`, `useWizardAgents`), constants, `UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE`.
- Produces: `OwnerSection({ form })`, `SecondaryPropertySection({ form })`, `SegmentedToggle({ value, onChange, left, right })`.

- [ ] **Step 1: Create `SegmentedToggle.tsx`** (reused by both branches' source pickers)

```typescript
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  left: { value: string; label: string };
  right: { value: string; label: string };
}

export function SegmentedToggle({ value, onChange, left, right }: Readonly<Props>) {
  return (
    <View className="flex-row rounded-full border border-border bg-card p-1">
      {[left, right].map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={cn('flex-1 items-center rounded-full py-2', active ? 'bg-brand' : 'bg-transparent')}
          >
            <Text className={cn('text-xs font-semibold', active ? 'text-brand-foreground' : 'text-muted-foreground')}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Create `OwnerSection.tsx`** — full owner block. Worked examples for EVERY field-type used; apply the same pattern to each field listed.

Fields (in order): source toggle → existing-owner ApiSelect (when existing) → Name, Email, Phone, Gender, DOB, Source, Nationality, Languages (multi), Assignee (ApiSelect). On existing-owner select, fetch `useLeadDetailQuery` and prefill via `form.setFieldValue`.

```typescript
import { useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { ApiSelectField } from '../ApiSelectField';
import { SegmentedToggle } from './SegmentedToggle';
import {
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  OWNER_SOURCE_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
} from '../../constants';
import { useLeadDetailQuery, useOwnerLeads, useWizardAgents } from '../../hooks/use-wizard-options';
import type { InformationForm } from '../../forms/information.form';

export function OwnerSection({ form }: Readonly<{ form: InformationForm }>) {
  const leads = useOwnerLeads();
  const agents = useWizardAgents();

  return (
    <View className="mt-5 gap-3">
      <Text className="text-sm font-semibold text-foreground">Owner</Text>

      <form.Subscribe selector={(s) => s.values.ownerSourceMode}>
        {(mode) => (
          <>
            <SegmentedToggle
              value={mode}
              onChange={(v) => form.setFieldValue('ownerSourceMode', v as 'brand_new' | 'existing_owner')}
              left={{ value: 'brand_new', label: 'Create new owner' }}
              right={{ value: 'existing_owner', label: 'Select existing owner' }}
            />
            {mode === 'existing_owner' ? (
              <form.AppField name="existingOwnerId">
                {() => (
                  <ApiSelectField
                    label="Existing Owner"
                    placeholder="Search owner"
                    options={leads.data}
                    isLoading={leads.isLoading}
                    isError={leads.isError}
                    onRetry={() => leads.refetch()}
                    onSelected={(id) => form.setFieldValue('existingOwnerId', id ?? '')}
                  />
                )}
              </form.AppField>
            ) : null}
          </>
        )}
      </form.Subscribe>

      <OwnerPrefill form={form} />

      <form.AppField name="ownerName">
        {(field) => <field.Input label="Name" required placeholder="Owner name" />}
      </form.AppField>
      <form.AppField name="ownerEmail">
        {(field) => <field.Input label="Email" placeholder="owner@email.com" keyboardType="email-address" />}
      </form.AppField>
      <form.AppField name="ownerPhone">
        {(field) => <field.PhoneInput label="Phone" required />}
      </form.AppField>
      <form.AppField name="ownerGender">
        {(field) => <field.Select label="Gender" options={GENDER_OPTIONS} placeholder="Select gender" />}
      </form.AppField>
      <form.AppField name="ownerBirthdate">
        {(field) => <field.DatePicker label="Date of Birth" />}
      </form.AppField>
      <form.AppField name="ownerSource">
        {(field) => <field.Select label="Source" options={OWNER_SOURCE_OPTIONS} placeholder="Select source" />}
      </form.AppField>
      <form.AppField name="ownerNationality">
        {(field) => <field.Select label="Nationality" options={NATIONALITY_OPTIONS} placeholder="Select nationality" />}
      </form.AppField>
      <form.AppField name="ownerLanguages">
        {(field) => <field.MultiSelect label="Spoken Languages" options={SPOKEN_LANGUAGE_OPTIONS} placeholder="Select languages" />}
      </form.AppField>
      <form.AppField name="assigneeId">
        {() => (
          <ApiSelectField
            label="Listing Assignee"
            placeholder="Select agent"
            options={agents.data}
            isLoading={agents.isLoading}
            isError={agents.isError}
            onRetry={() => agents.refetch()}
          />
        )}
      </form.AppField>
    </View>
  );
}

/** Prefills owner fields when an existing owner is chosen. */
function OwnerPrefill({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe selector={(s) => s.values.existingOwnerId}>
      {(ownerId) => <OwnerPrefillInner form={form} ownerId={ownerId} />}
    </form.Subscribe>
  );
}

function OwnerPrefillInner({ form, ownerId }: Readonly<{ form: InformationForm; ownerId: string }>) {
  const { data } = useLeadDetailQuery(ownerId || undefined);
  useEffect(() => {
    if (!data) return;
    form.setFieldValue('ownerName', data.name ?? '');
    form.setFieldValue('ownerEmail', data.email ?? '');
    form.setFieldValue('ownerPhone', data.phone ?? '');
    form.setFieldValue('ownerGender', data.gender ?? '');
    form.setFieldValue('ownerBirthdate', data.birthdate ?? '');
    form.setFieldValue('ownerSource', data.source ?? '');
    form.setFieldValue('ownerNationality', data.nationality ?? '');
    form.setFieldValue('ownerLanguages', data.languages ?? []);
  }, [data, form]);
  return null;
}
```

> NOTE: Confirm `field.Input` accepts `keyboardType` passthrough; if not, the implementer adds it to
> `FormInput`'s prop passthrough or drops it. Confirm `field.DatePicker`/`field.PhoneInput`/`field.MultiSelect`
> names match the registered `fieldComponents`. Match the exact prop API of each existing field component.

- [ ] **Step 3: Create `SecondaryPropertySection.tsx`** — property source toggle, existing-property ApiSelect (uses chosen ownerId), then: Unit Type (options by propertyType), Bedrooms, Built-up Area, Bathrooms, Furnishing, View, Project/Building, Tower/Block, Unit Number, Floor, Project Address, then a shared `PricingFields` (see Task 9 note). Use the same `form.AppField` patterns as Step 2. Unit-type options:

```typescript
import { UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE } from '../../constants';
// inside, read propertyType via form.Subscribe and:
const unitTypeOptions = UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE[propertyType] ?? [];
// existing property options:
const properties = useOwnerProperties(ownerId || undefined); // ownerId from form.Subscribe on existingOwnerId
```

Render every field with the matching `field.Input`/`field.Select` per the Owner pattern. Number fields use `field.Input` with `keyboardType="numeric"`. Include the `PricingFields` block (Task 9 produces it as a shared component) gated by purpose: sale → Asking Price (required) + Mortgage Status; rent → Asking Price + Price Type + Max Cheques + Deposit.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/steps/OwnerSection.tsx src/features/listing-wizard/components/steps/SecondaryPropertySection.tsx src/features/listing-wizard/components/steps/SegmentedToggle.tsx
git commit -m "feat(listing-wizard): add secondary owner + property sections"
```

---

### Task 9: Shared PricingFields + Primary branch sections

**Files:**

- Create: `src/features/listing-wizard/components/steps/PricingFields.tsx`
- Create: `src/features/listing-wizard/components/steps/PrimaryProjectSection.tsx`
- Create: `src/features/listing-wizard/components/steps/PrimaryPropertySection.tsx`

**Interfaces:**

- Consumes: `form`, field components, `ApiSelectField`, `useListingProjects`, `useListingUnitTypes`, `useWizardAgents`, constants.
- Produces: `PricingFields({ form, purpose })`, `PrimaryProjectSection({ form })`, `PrimaryPropertySection({ form })`.

- [ ] **Step 1: Create `PricingFields.tsx`** — purpose-aware pricing block reused by both branches.

```typescript
import { View } from 'react-native';
import { MORTGAGE_STATUS_OPTIONS, RENT_PRICE_TYPE_OPTIONS } from '../../constants';
import type { InformationForm } from '../../forms/information.form';

export function PricingFields({ form, purpose }: Readonly<{ form: InformationForm; purpose: string }>) {
  const isRent = purpose === 'rent';
  return (
    <View className="gap-3">
      <form.AppField name="askingPrice">
        {(field) => (
          <field.Input label={isRent ? 'Rent Price' : 'Asking Price'} required={purpose === 'sale'} keyboardType="numeric" placeholder="AED" />
        )}
      </form.AppField>
      {isRent ? (
        <>
          <form.AppField name="priceType">
            {(field) => <field.Select label="Price Type" options={RENT_PRICE_TYPE_OPTIONS} placeholder="Per…" />}
          </form.AppField>
          <form.AppField name="maxCheques">
            {(field) => <field.Input label="Max Cheques" keyboardType="numeric" />}
          </form.AppField>
          <form.AppField name="deposit">
            {(field) => <field.Input label="Deposit" keyboardType="numeric" />}
          </form.AppField>
        </>
      ) : (
        <form.AppField name="mortgageStatus">
          {(field) => <field.Select label="Mortgage Status" options={MORTGAGE_STATUS_OPTIONS} placeholder="Select status" />}
        </form.AppField>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Create `PrimaryProjectSection.tsx`** — Project (ApiSelect; on select set developerId+developerName via `onSelected` reading the chosen `ProjectOption`), Developer (read-only display of developerName; store developerId), Unit Type (ApiSelect by projectId, disable used purposes), Availability (static, sold↔rented by purpose), Assignee (ApiSelect).

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { ApiSelectField } from '../ApiSelectField';
import { AVAILABILITY_OPTIONS, AVAILABILITY_OPTIONS_RENT } from '../../constants';
import { useListingProjects, useListingUnitTypes, useWizardAgents } from '../../hooks/use-wizard-options';
import type { InformationForm } from '../../forms/information.form';

export function PrimaryProjectSection({ form }: Readonly<{ form: InformationForm }>) {
  const projects = useListingProjects();
  const agents = useWizardAgents();

  return (
    <View className="mt-5 gap-3">
      <Text className="text-sm font-semibold text-foreground">Project</Text>

      <form.AppField name="projectId">
        {() => (
          <ApiSelectField
            label="Project"
            required
            placeholder="Select project"
            options={projects.data}
            isLoading={projects.isLoading}
            isError={projects.isError}
            onRetry={() => projects.refetch()}
            onSelected={(id) => {
              const proj = projects.data.find((p) => p.value === id);
              form.setFieldValue('developerId', proj?.developerId ?? '');
              form.setFieldValue('unitType', '');
            }}
          />
        )}
      </form.AppField>

      {/* Developer — display the resolved developerName, disabled. Store developerId in form. */}
      <form.Subscribe selector={(s) => s.values.projectId}>
        {(projectId) => {
          const proj = projects.data.find((p) => p.value === projectId);
          return (
            <View>
              <Text className="mb-1 text-sm text-foreground">Developer</Text>
              <View className="h-12 justify-center rounded-xl border border-border bg-muted px-3">
                <Text className="text-sm text-muted-foreground">{proj?.developerName ?? '—'}</Text>
              </View>
            </View>
          );
        }}
      </form.Subscribe>

      <form.Subscribe selector={(s) => ({ projectId: s.values.projectId, purpose: s.values.purpose })}>
        {({ projectId, purpose }) => <UnitTypeField form={form} projectId={projectId} purpose={purpose} />}
      </form.Subscribe>

      <form.Subscribe selector={(s) => s.values.purpose}>
        {(purpose) => (
          <form.AppField name="availability">
            {(field) => (
              <field.Select
                label="Availability"
                options={purpose === 'rent' ? AVAILABILITY_OPTIONS_RENT : AVAILABILITY_OPTIONS}
                placeholder="Select availability"
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>

      <form.AppField name="assigneeId">
        {() => (
          <ApiSelectField
            label="Assigned Agent"
            placeholder="Select agent"
            options={agents.data}
            isLoading={agents.isLoading}
            isError={agents.isError}
            onRetry={() => agents.refetch()}
          />
        )}
      </form.AppField>
    </View>
  );
}

function UnitTypeField({ form, projectId, purpose }: Readonly<{ form: InformationForm; projectId: string; purpose: string }>) {
  const unitTypes = useListingUnitTypes(projectId || undefined);
  const options = unitTypes.data.map((u) => ({
    value: u.value,
    label: (u.usedPurposes ?? []).includes(purpose) ? `${u.label} (already listed)` : u.label,
  }));
  return (
    <form.AppField name="unitType">
      {() => (
        <ApiSelectField
          label="Unit Type"
          placeholder="Select unit type"
          options={options}
          isLoading={unitTypes.isLoading}
          isError={unitTypes.isError}
          onRetry={() => unitTypes.refetch()}
          disabled={!projectId}
        />
      )}
    </form.AppField>
  );
}
```

- [ ] **Step 3: Create `PrimaryPropertySection.tsx`** — Bedrooms (req), Bathrooms (req), Size, View, Furnishing, Floor, Total Floors, Build Year, Occupancy, Parking, Availability Date, Public Unit No., Private Unit No., then `<PricingFields form purpose>`. Same `form.AppField` patterns; numbers use `keyboardType="numeric"`; selects use the constants (`VIEW_OPTIONS`, `FURNISHING_OPTIONS`, `OCCUPANCY_OPTIONS`).

- [ ] **Step 4: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/steps/PricingFields.tsx src/features/listing-wizard/components/steps/PrimaryProjectSection.tsx src/features/listing-wizard/components/steps/PrimaryPropertySection.tsx
git commit -m "feat(listing-wizard): add pricing + primary branch sections"
```

---

### Task 10: InformationStep orchestrator

**Files:**

- Create: `src/features/listing-wizard/components/steps/InformationStep.tsx`

**Interfaces:**

- Consumes: all section components, `form`, `branchFor`.
- Produces: `InformationStep({ form })` — renders Type + Location always; then branch sections by `completionStatus`.

- [ ] **Step 1: Create `InformationStep.tsx`**

```typescript
import { ScrollView, View } from 'react-native';
import { TypeSection } from './TypeSection';
import { LocationSection } from './LocationSection';
import { OwnerSection } from './OwnerSection';
import { SecondaryPropertySection } from './SecondaryPropertySection';
import { PrimaryProjectSection } from './PrimaryProjectSection';
import { PrimaryPropertySection } from './PrimaryPropertySection';
import { branchFor } from '../../types';
import type { InformationForm } from '../../forms/information.form';

export function InformationStep({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TypeSection form={form} />
      <LocationSection form={form} />
      <form.Subscribe selector={(s) => s.values.completionStatus}>
        {(status) => {
          const branch = branchFor(status);
          if (branch === 'secondary') {
            return (
              <View>
                <OwnerSection form={form} />
                <SecondaryPropertySection form={form} />
              </View>
            );
          }
          if (branch === 'primary') {
            return (
              <View>
                <PrimaryProjectSection form={form} />
                <PrimaryPropertySection form={form} />
              </View>
            );
          }
          return null;
        }}
      </form.Subscribe>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/steps/InformationStep.tsx
git commit -m "feat(listing-wizard): add InformationStep orchestrator"
```

---

### Task 11: Wizard scaffold + route + wiring

**Files:**

- Create: `src/features/listing-wizard/components/WizardStepper.tsx`
- Create: `src/features/listing-wizard/components/WizardFooter.tsx`
- Create: `src/features/listing-wizard/components/CreateListingWizard.tsx`
- Create: `app/(app)/listings/create.tsx`
- Modify: `app/(app)/_layout.tsx` (register `listings/create`)
- Modify: `src/features/listings/components/ListingsLandingScreen.tsx` (wire `onCreate`)

**Interfaces:**

- Consumes: `useInformationForm`, `InformationStep`, `BackButton`, `PERMISSIONS`/`useRequirePermission`.
- Produces: `WizardStepper`, `WizardFooter`, `CreateListingWizard`, the route, nav registration, FAB wiring.

- [ ] **Step 1: Create `WizardStepper.tsx`** — 4 segments; Information active (brand), others muted, non-tappable.

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

const STEPS = ['Information', 'Description', 'Media & Documents', 'Portals'] as const;

export function WizardStepper({ activeIndex }: Readonly<{ activeIndex: number }>) {
  return (
    <View className="flex-row gap-1 px-4 pb-2">
      {STEPS.map((label, i) => (
        <View key={label} className="flex-1 gap-1">
          <View className={cn('h-1 rounded-full', i <= activeIndex ? 'bg-brand' : 'bg-border')} />
          <Text
            className={cn('text-[10px] font-semibold', i === activeIndex ? 'text-foreground' : 'text-muted-foreground')}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Create `WizardFooter.tsx`** — Cancel + no-op "Save & continue".

```typescript
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';

export function WizardFooter({ onCancel }: Readonly<{ onCancel: () => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row gap-3 border-t border-border bg-background px-4 py-3"
      style={{ paddingBottom: 12 + insets.bottom }}
    >
      <Button variant="outline" className="flex-1" onPress={onCancel}>
        <Text>Cancel</Text>
      </Button>
      {/* No-op this increment — Save & continue does nothing yet. */}
      <Button className="flex-1" onPress={() => {}}>
        <Text>Save & continue</Text>
      </Button>
    </View>
  );
}
```

> NOTE: Confirm `Button` supports a `variant="outline"` (check `src/components/atoms/Button.tsx`); if the
> variant name differs, use the matching one. If `Button` doesn't take `className`, wrap in a flex View.

- [ ] **Step 3: Create `CreateListingWizard.tsx`** — owns the form, header (BackButton + title), stepper, InformationStep, footer.

```typescript
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Text } from '@/components/atoms/Text';
import { useInformationForm } from '../forms/information.form';
import { InformationStep } from './steps/InformationStep';
import { WizardFooter } from './WizardFooter';
import { WizardStepper } from './WizardStepper';

export function CreateListingWizard() {
  const insets = useSafeAreaInsets();
  const form = useInformationForm();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text className="text-xl font-bold text-foreground">Create Listing</Text>
      </View>
      <WizardStepper activeIndex={0} />
      <View className="flex-1">
        <InformationStep form={form} />
      </View>
      <WizardFooter onCancel={() => router.back()} />
    </View>
  );
}
```

- [ ] **Step 4: Create the route `app/(app)/listings/create.tsx`**

```typescript
import { Redirect } from 'expo-router';
import { CreateListingWizard } from '@/features/listing-wizard/components/CreateListingWizard';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CreateListingRoute() {
  const state = useRequirePermission([
    PERMISSIONS.LISTINGS_CREATE,
    PERMISSIONS.OPPORTUNITY_LISTING_CREATE,
  ]);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/listings" />;
  return <CreateListingWizard />;
}
```

> NOTE: Confirm `useRequirePermission` accepts an array (any-of). If it only accepts a single code, gate on
> `OPPORTUNITY_LISTING_CREATE` and note it. Check the signature in `src/lib/rbac`.

- [ ] **Step 5: Register in `app/(app)/_layout.tsx`** — add after `listings/rent`:

```typescript
      <Stack.Screen name="listings/create" />
```

- [ ] **Step 6: Wire the FAB** in `ListingsLandingScreen.tsx` — replace the no-op `onCreate`:

```typescript
const onCreate = () => router.push('/listings/create');
```

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listing-wizard/components/WizardStepper.tsx src/features/listing-wizard/components/WizardFooter.tsx src/features/listing-wizard/components/CreateListingWizard.tsx "app/(app)/listings/create.tsx" "app/(app)/_layout.tsx" src/features/listings/components/ListingsLandingScreen.tsx
git commit -m "feat(listing-wizard): wizard scaffold, create route, wire Create FAB"
```

- [ ] **Step 8: Manual QA**

Run the app. Verify:

1. Listings → "+ Create" FAB → wizard opens; header + 4-step stepper (Information active).
2. Type section: Property Type, Completion Status, Purpose render; off-plan statuses collapse Purpose to "For Sale".
3. Choosing a `*_secondary` status reveals Owner + Property sections; `*_primary` reveals Project + Property-details.
4. Community / Existing Owner / Existing Property / Project / Unit Type / Agent selects show **loading**, then options; kill network → **error + Retry** works.
5. Existing-owner select prefills owner fields; project select fills Developer + clears Unit Type.
6. Languages multi-select works; DOB date picker works; phone input works.
7. Validation: required fields show errors (Completion Status, Purpose, Community, branch requireds). "Save & continue" does nothing (no-op).
8. **Endpoint check:** if a select shows error/empty unexpectedly, inspect the call (`/api/v1/locations/neighbourhoods`, `/leads`, `/opportunities`, `/listings/projects`, `/listings/unit-types`, `/agents`) and fix the path/params in `services.ts` only.

---

## Self-Review

**Spec coverage:**

- Scaffold (stepper, header, footer, no-op continue) → Task 11. ✔
- Route + permission gate + FAB wiring → Task 11. ✔
- Type/Location sections → Task 7. ✔
- Secondary owner + property (all fields, source toggles, existing search + prefill) → Task 8. ✔
- Primary project + property details → Task 9. ✔
- All static enums → Task 1. ✔
- API selects (7) + loading/error/empty → Tasks 2,3,5; consumed in 7,8,9. ✔
- FormMultiSelect (languages) → Task 4. ✔
- Branch-aware validation → Task 6. ✔
- Off-plan→sale-only, propertyUse derivation, unit-type-by-type → Tasks 1,7,8. ✔
- Out of scope (POST/steps 2-4/draft/server-search) → not implemented. ✔

**Placeholder scan:** No TBD/TODO. `> NOTE` blocks are real implementer guidance (verify atom prop APIs, copy full nationality list, confirm field-context behavior, endpoint paths) — not deferred work. The `INFORMATION_DEFAULTS` note explicitly tells the implementer to hand-write the defaults object (don't `.parse({})`).

**Type consistency:** `InformationForm` defined in `information.form.ts` (Task 7 step 1), consumed by every section. `Opt`/`ProjectOption`/`UnitTypeOption`/`LeadDetail` from services (Task 2), used in hooks (Task 3) + sections. Field names in sections match the schema keys exactly (Task 6). `ApiSelectField` prop shape consistent across Tasks 5/7/8/9. Hook return shape `{data,isLoading,isError,refetch}` consistent.

**Risk callouts for execution:** several `> NOTE`s depend on exact mobile atom/field-component prop APIs (Checkbox, Button variant, field.Input keyboardType, FormBase prop name, useRequirePermission array, field context for ApiSelectField). The implementer of each task must read the referenced existing file and conform; tsc will catch mismatches. The biggest unknown is whether a non-`field.*` component (`ApiSelectField`/`FormMultiSelect` used outside the `field.X` registry) receives TanStack field context when rendered inside `form.AppField`'s child — Task 7 step 3 NOTE flags verifying this; if it doesn't work, the fallback is to register `ApiSelect` as a proper field component or pass the field instance explicitly.
