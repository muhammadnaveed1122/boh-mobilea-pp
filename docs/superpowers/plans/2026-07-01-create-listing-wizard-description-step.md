# Create-Listing Wizard — Description Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the wizard's Description step (step 2) — a required Title + Description that persists the listing's hero content — at full backend parity with the web wizard.

**Architecture:** Turn `CreateListingWizard` from a single terminal screen into a 2-step flow. Step 1 (Information) now advances to step 2 (Description) after creating the lead/opportunity (or primary listing). Step 2 captures hero Title + Description and upserts them to the listing content record — creating the opportunity-listing first for the secondary branch, or upserting the CMS hero section for the primary branch.

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind v4, TanStack React Form + Zod, TanStack Query, axios (`apiClient`).

## Global Constraints

- **No test runner.** Verify every task with `npx tsc --noEmit` + `pnpm lint`. No unit tests. Manual QA at the end.
- Strict TypeScript (`strict: true`). Prop types use `Readonly<{...}>`.
- Prettier: single quotes, semicolons, trailing commas, 100-col, 2-space. `prettier-plugin-tailwindcss` auto-sorts classes.
- Semantic Tailwind tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) — no hardcoded hex.
- API paths prefixed `/api/v1`. `apiClient` unwraps the `{ success, data }` envelope (returns inner `data`).
- `apiClient` default header is `Content-Type: application/json` — FormData POSTs MUST override to `multipart/form-data` per request (RN's XHR appends the boundary).
- Spec: [`docs/superpowers/specs/2026-07-01-create-listing-wizard-description-step-design.md`](../specs/2026-07-01-create-listing-wizard-description-step-design.md).

---

### Task 1: Content services (create opportunity-listing + upsert hero)

**Files:**

- Modify: `src/features/listing-wizard/services.ts` (append at end, after `createOpportunity`)

**Interfaces:**

- Consumes: `apiClient` from `@/lib/api`.
- Produces:
  - `createOpportunityListing(opportunityId: string, body: { name?: string }): Promise<{ id: string }>`
  - `upsertOpportunityListingHero(listingId: string, fields: HeroFields): Promise<void>`
  - `upsertPrimaryListingHero(listingId: string, fields: HeroFields): Promise<void>`
  - `interface HeroFields { title: string; description: string }`

- [ ] **Step 1: Add the services**

Append to `src/features/listing-wizard/services.ts`:

```ts
// ---------------------------------------------------------------------------
// Listing content (Description step) — mirrors the web wizard's hero save.
//   Secondary → POST /opportunity-listing/opportunity/:id  then  POST .../:listingId/hero
//   Primary   → POST /listing-cms/:listingId?section=hero
// Hero endpoints are multipart (they also accept media); here we send text only.
// ---------------------------------------------------------------------------

export interface HeroFields {
  title: string;
  description: string;
}

/** Secondary branch — create the opportunity-listing row for a saved opportunity. */
export async function createOpportunityListing(
  opportunityId: string,
  body: { name?: string },
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    `/api/v1/opportunity-listing/opportunity/${opportunityId}`,
    body,
  );
  return data;
}

/** Secondary branch — upsert the hero section (title + description) as multipart. */
export async function upsertOpportunityListingHero(
  listingId: string,
  fields: HeroFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', '');
  fd.append('view360Link', '');
  fd.append('existingMedia', '[]');
  fd.append('newMediaAltTexts', '[]');
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** Primary branch — upsert the CMS hero section (title + description) as multipart. */
export async function upsertPrimaryListingHero(
  listingId: string,
  fields: HeroFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subTitle', '');
  fd.append('description', fields.description);
  fd.append('existingMedia', '[]');
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
    headers: { 'Content-Type': 'multipart/form-data', 'X-Use-FormData': 'true' },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors in `services.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add hero content services for Description step"
```

---

### Task 2: Description form + schema

**Files:**

- Create: `src/features/listing-wizard/forms/description.schema.ts`
- Create: `src/features/listing-wizard/forms/description.form.ts`

**Interfaces:**

- Consumes: `useAppForm` from `@/components/molecules/forms/hook`.
- Produces:
  - `descriptionSchema` (Zod), `DescriptionValues` type, `DESCRIPTION_DEFAULTS`
  - `useDescriptionForm(onValidSubmit: (values: DescriptionValues) => Promise<void>)`
  - `DescriptionForm = ReturnType<typeof useDescriptionForm>`

- [ ] **Step 1: Write the schema**

Create `src/features/listing-wizard/forms/description.schema.ts`:

```ts
import { z } from 'zod';

/** Description step — hero Title + Description (both feed the Property Finder push). */
export const descriptionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type DescriptionValues = z.infer<typeof descriptionSchema>;

export const DESCRIPTION_DEFAULTS: DescriptionValues = {
  title: '',
  description: '',
};
```

- [ ] **Step 2: Write the form hook**

Create `src/features/listing-wizard/forms/description.form.ts`:

```ts
import { useAppForm } from '@/components/molecules/forms/hook';

import {
  DESCRIPTION_DEFAULTS,
  type DescriptionValues,
  descriptionSchema,
} from './description.schema';

/**
 * `onValidSubmit` runs only after the schema passes — `form.handleSubmit()` validates first
 * (marking fields touched + surfacing errors) and invokes onSubmit solely for a valid payload.
 */
export function useDescriptionForm(onValidSubmit: (values: DescriptionValues) => Promise<void>) {
  return useAppForm({
    defaultValues: DESCRIPTION_DEFAULTS,
    validators: { onSubmit: descriptionSchema },
    onSubmit: async ({ value }) => {
      await onValidSubmit(value);
    },
  });
}

export type DescriptionForm = ReturnType<typeof useDescriptionForm>;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/listing-wizard/forms/description.schema.ts src/features/listing-wizard/forms/description.form.ts
git commit -m "feat(listing-wizard): add Description step form + schema"
```

---

### Task 3: `use-save-content` hook

**Files:**

- Create: `src/features/listing-wizard/hooks/use-save-content.ts`

**Interfaces:**

- Consumes: `createOpportunityListing`, `upsertOpportunityListingHero`, `upsertPrimaryListingHero` (Task 1); `DescriptionValues` (Task 2); `ListingBranch` from `../types`.
- Produces:
  - `interface WizardCreated { branch: ListingBranch; leadId?: string; opportunityId?: string; listingId?: string }`
  - `interface SaveContentArgs { created: WizardCreated; values: DescriptionValues }`
  - `useSaveContent(): UseMutationResult<string, Error, SaveContentArgs>` — resolves the listing id.

- [ ] **Step 1: Write the hook**

Create `src/features/listing-wizard/hooks/use-save-content.ts`:

```ts
import { useMutation } from '@tanstack/react-query';

import type { DescriptionValues } from '../forms/description.schema';
import {
  createOpportunityListing,
  upsertOpportunityListingHero,
  upsertPrimaryListingHero,
} from '../services';
import type { ListingBranch } from '../types';

/** Ids + branch produced by the Information step; carried into the Description step. */
export interface WizardCreated {
  branch: ListingBranch;
  leadId?: string;
  opportunityId?: string;
  listingId?: string;
}

export interface SaveContentArgs {
  created: WizardCreated;
  values: DescriptionValues;
}

/**
 * Persists the Description step's hero (Title + Description). Secondary: creates the
 * opportunity-listing on first save (when no listingId yet), then upserts hero. Primary:
 * upserts the CMS hero section on the listing created in the Information step. Resolves
 * the listing id so the caller can store it (idempotent re-saves upsert the same listing).
 */
export function useSaveContent() {
  return useMutation<string, Error, SaveContentArgs>({
    mutationFn: async ({ created, values }) => {
      const fields = { title: values.title, description: values.description };

      if (created.branch === 'primary') {
        if (created.listingId === undefined) {
          throw new Error('Create the listing first.');
        }
        await upsertPrimaryListingHero(created.listingId, fields);
        return created.listingId;
      }

      // secondary
      if (created.opportunityId === undefined) {
        throw new Error('Save the property step first.');
      }
      let listingId = created.listingId;
      if (listingId === undefined) {
        const listing = await createOpportunityListing(created.opportunityId, {
          name: values.title.trim().slice(0, 120),
        });
        listingId = listing.id;
      }
      await upsertOpportunityListingHero(listingId, fields);
      return listingId;
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/hooks/use-save-content.ts
git commit -m "feat(listing-wizard): add use-save-content hook for hero persistence"
```

---

### Task 4: `DescriptionStep` component

**Files:**

- Create: `src/features/listing-wizard/components/steps/DescriptionStep.tsx`

**Interfaces:**

- Consumes: `WizardCard` from `../WizardCard`; `DescriptionForm` from `../../forms/description.form`; `field.Input` + `field.Textarea` from the shared form hook.
- Produces: `DescriptionStep({ form }: Readonly<{ form: DescriptionForm }>)`.

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/steps/DescriptionStep.tsx`:

```tsx
import { ScrollView, View } from 'react-native';

import type { DescriptionForm } from '../../forms/description.form';
import { WizardCard } from '../WizardCard';

/**
 * Description step (wizard step 2) — the hero Title + Description used for portals such as
 * Property Finder. Mirrors the web `descriptionOnly` content tab (single "Hero & Basics" card).
 */
export function DescriptionStep({ form }: Readonly<{ form: DescriptionForm }>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <WizardCard
          icon="FileText"
          title="Hero & Basics"
          description="The title and description used for portals such as Property Finder."
        >
          <form.AppField name="title">
            {(field) => <field.Input label="Title" required placeholder="Title" />}
          </form.AppField>

          <form.AppField name="description">
            {(field) => (
              <field.Textarea
                label="Description"
                required
                numberOfLines={5}
                placeholder="Describe the property — sent to Property Finder on publish."
              />
            )}
          </form.AppField>
        </WizardCard>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `icon="FileText"` errors (not a valid `IconName`), replace with `"AlignLeft"` (also a Lucide key) and re-run.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/components/steps/DescriptionStep.tsx
git commit -m "feat(listing-wizard): add DescriptionStep screen"
```

---

### Task 5: Per-step `WizardFooter`

**Files:**

- Modify: `src/features/listing-wizard/components/WizardFooter.tsx`

**Interfaces:**

- Produces: `WizardFooter` with added optional props `primaryLabel?: string` (default `'Create & Continue'`), `onBack?: () => void`, `showSaveDraft?: boolean` (default `true`). Existing callers keep working unchanged (all new props optional).

- [ ] **Step 1: Rewrite the footer**

Replace the whole body of `src/features/listing-wizard/components/WizardFooter.tsx`:

```tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';

type SubmitMode = 'draft' | 'continue';

/**
 * Action bar for the create wizard. A single primary CTA gets its own full-width row so its
 * label never truncates; the subordinate actions sit on a second row. Only the in-flight
 * action shows a spinner; all buttons lock while submitting.
 *
 * Step 1 uses the defaults (Cancel + Save as Draft + "Create & Continue"). Later steps pass
 * `onBack` (the left button becomes "Back"), a custom `primaryLabel`, and `showSaveDraft={false}`.
 */
export function WizardFooter({
  onCancel,
  onSaveDraft,
  onCreate,
  submittingMode,
  primaryLabel = 'Create & Continue',
  onBack,
  showSaveDraft = true,
}: Readonly<{
  onCancel: () => void;
  onSaveDraft: () => void;
  onCreate: () => void;
  submittingMode: SubmitMode | null;
  primaryLabel?: string;
  onBack?: () => void;
  showSaveDraft?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const isSubmitting = submittingMode !== null;

  return (
    <View
      className="gap-2.5 border-t border-border bg-background px-4 pt-3"
      style={{ paddingBottom: 12 + insets.bottom }}
    >
      <Button
        size="lg"
        onPress={onCreate}
        disabled={isSubmitting}
        loading={submittingMode === 'continue'}
      >
        <Text>{primaryLabel}</Text>
      </Button>

      <View className="flex-row gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onPress={onBack ?? onCancel}
          disabled={isSubmitting}
        >
          <Text>{onBack ? 'Back' : 'Cancel'}</Text>
        </Button>
        {showSaveDraft && (
          <Button
            variant="outline"
            className="flex-1"
            onPress={onSaveDraft}
            disabled={isSubmitting}
            loading={submittingMode === 'draft'}
          >
            <Text>Save as Draft</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/components/WizardFooter.tsx
git commit -m "feat(listing-wizard): make WizardFooter per-step configurable"
```

---

### Task 6: Wire the 2-step flow in `CreateListingWizard`

**Files:**

- Modify: `src/features/listing-wizard/components/CreateListingWizard.tsx` (full rewrite)

**Interfaces:**

- Consumes: `useInformationForm`, `useDescriptionForm`, `useCreateListing`, `useSaveContent` + `WizardCreated`, `branchFor`, `InformationStep`, `DescriptionStep`, `WizardFooter`, `WizardStepper`.
- Produces: `CreateListingWizard()` (default export unchanged — same route usage).

- [ ] **Step 1: Rewrite the wizard**

Replace the whole file `src/features/listing-wizard/components/CreateListingWizard.tsx`:

```tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { useDescriptionForm } from '../forms/description.form';
import { useInformationForm } from '../forms/information.form';
import { useCreateListing } from '../hooks/use-create-listing';
import { useSaveContent, type WizardCreated } from '../hooks/use-save-content';
import { branchFor } from '../types';
import { DescriptionStep } from './steps/DescriptionStep';
import { InformationStep } from './steps/InformationStep';
import { WizardFooter } from './WizardFooter';
import { WizardStepper } from './WizardStepper';

type SubmitMode = 'draft' | 'continue';

export function CreateListingWizard() {
  const insets = useSafeAreaInsets();
  const createListing = useCreateListing();
  const saveContent = useSaveContent();

  const [stepIndex, setStepIndex] = useState(0);
  const [created, setCreated] = useState<WizardCreated | null>(null);

  // Both step-1 footer buttons share one submit path; the mode changes the success toast,
  // whether we advance vs exit, and which button shows the spinner.
  const modeRef = useRef<SubmitMode>('continue');
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);

  const informationForm = useInformationForm(async (values) => {
    try {
      const result = await createListing.mutateAsync(values);
      const branch = branchFor(values.completionStatus);
      if (branch === null) {
        throw new Error('Select a completion status before saving.');
      }
      const next: WizardCreated =
        result.kind === 'listing'
          ? { branch, listingId: result.id }
          : { branch, opportunityId: result.id };
      setCreated(next);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the listing.');
      throw error; // rethrow so handleSubmit settles as failed (skips the success path below).
    }
    if (modeRef.current === 'draft') {
      showToast('success', 'Saved as draft');
      router.back();
      return;
    }
    showToast('success', 'Listing created');
    setStepIndex(1);
  });

  const descriptionForm = useDescriptionForm(async (values) => {
    if (created === null) {
      showToast('error', 'Complete the information step first.');
      throw new Error('missing created ids');
    }
    try {
      const listingId = await saveContent.mutateAsync({ created, values });
      // Store the listing id so a second save upserts the same listing (no duplicate).
      setCreated({ ...created, listingId });
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the content.');
      throw error;
    }
    // Per product decision: save + stay on the step (Media step not built yet).
    showToast('success', 'Listing content saved');
  });

  const submitInformation = (mode: SubmitMode) => {
    modeRef.current = mode;
    setPendingMode(mode);
    informationForm.handleSubmit().finally(() => setPendingMode(null));
  };

  const submitDescription = () => {
    setPendingMode('continue');
    descriptionForm.handleSubmit().finally(() => setPendingMode(null));
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text className="text-xl font-bold text-foreground">Create Listing</Text>
      </View>
      <WizardStepper activeIndex={stepIndex} />
      <View className="flex-1">
        {stepIndex === 0 ? (
          <InformationStep form={informationForm} />
        ) : (
          <DescriptionStep form={descriptionForm} />
        )}
      </View>
      {stepIndex === 0 ? (
        <WizardFooter
          onCancel={() => router.back()}
          onSaveDraft={() => submitInformation('draft')}
          onCreate={() => submitInformation('continue')}
          submittingMode={pendingMode}
        />
      ) : (
        <WizardFooter
          onCancel={() => router.back()}
          onSaveDraft={() => {}}
          onCreate={submitDescription}
          submittingMode={pendingMode}
          primaryLabel="Save Content"
          onBack={() => setStepIndex(0)}
          showSaveDraft={false}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/components/CreateListingWizard.tsx
git commit -m "feat(listing-wizard): wire 2-step flow with Description step"
```

---

### Task 7: Manual QA

No automated tests (project rule). Run the app and verify on device/simulator.

- [ ] **Step 1: Launch**

Run: `pnpm ios` (or `pnpm android`). Sign in as a user with listing-create permission and open Create Listing.

- [ ] **Step 2: Secondary branch — full flow**
  1. Step 1: pick a **secondary** completion status (`ready_secondary` / `off_plan_secondary`), fill the required owner + property fields.
  2. Tap **Create & Continue** → toast "Listing created", stepper advances to **Description**.
  3. Leave both fields empty, tap **Save Content** → inline "Title is required" + "Description is required" errors; no request sent.
  4. Fill Title + Description, tap **Save Content** → toast "Listing content saved", stays on the step.
  5. In the in-app Network Logger (`/(app)/network-logs`) confirm: `POST /api/v1/opportunity-listing/opportunity/:id` (201) then `POST /api/v1/opportunity-listing/:listingId/hero` (multipart, 200/201).
  6. Tap **Save Content** again → only the `.../hero` upsert fires (no second create — same listing id).
  7. Tap **Back** → returns to Information with data intact.

- [ ] **Step 3: Primary branch**
  1. Step 1: pick a **primary** completion status (`ready_primary` / `off_plan_primary`), fill developer/project/purpose/agent + required fields.
  2. **Create & Continue** → toast, advance to Description.
  3. Fill Title + Description, **Save Content** → toast; Network Logger shows `POST /api/v1/listing-cms/:listingId?section=hero` (multipart, header `X-Use-FormData: true`, 200).

- [ ] **Step 4: Draft path unchanged**

  On step 1, tap **Save as Draft** → creates lead/opportunity (or primary listing), toast "Saved as draft", exits to listings. No Description step.

- [ ] **Step 5: FormData sanity**

  If either hero POST returns 400/415 or the server sees empty fields, the multipart boundary was not set — inspect the request in Network Logger and, if needed, drop the explicit `Content-Type` header so axios/RN sets it with a boundary (see Global Constraints).

---

## Self-Review

**Spec coverage:**

- Backend contract (secondary create + hero; primary CMS hero; FormData note) → Task 1. ✓
- Multi-step wizard restructure + step-1 advance + Save-as-Draft terminal → Task 6. ✓
- `description.schema` / `description.form` → Task 2. ✓
- `DescriptionStep` (Hero & Basics card, Title + Description, verbatim copy) → Task 4. ✓
- `use-save-content` (branch logic, idempotent listing id) → Task 3. ✓
- `WizardFooter` per-step (Back + Save Content, no draft) → Task 5. ✓
- Save + stay on step behavior → Task 6 (`descriptionForm` onValidSubmit). ✓
- UI/UX (WizardCard reuse, semantic tokens, keyboard handling, required/error) → Tasks 4–5. ✓
- Out of scope (Media/Portals/resume/publish) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**Type consistency:** `HeroFields` (Task 1) consumed by Task 3. `WizardCreated` (Task 3) consumed by Task 6. `DescriptionForm` (Task 2) consumed by Tasks 4 & 6. `createOpportunityListing` returns `{ id }`, used as `listing.id`. `useCreateListing` result `{ kind: 'listing' | 'opportunity', id }` mapped in Task 6. `branchFor` returns `ListingBranch | null` — null guarded. ✓
