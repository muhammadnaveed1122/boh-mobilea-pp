# Mobile signup — Date of Birth + Terms consent

**Date:** 2026-06-13
**Repos touched:** `boh-mobile` (UI, validation, payload), `boh-lead-magnet-backend` (persist consent)

## Problem

Mobile sign-up currently collects only name, email, phone. We need to also collect:

1. **Date of birth** — required, via a date selector built as an in-repo react-native-reusables (RNR) atom.
2. **Terms consent** — a checkbox the user must tick to agree to the Terms & Conditions and Privacy Policy, with tappable links to those pages. Consent must be persisted.

## Decisions

- **Date UI:** new RNR-pattern atom wrapping `@react-native-community/datetimepicker` (already installed; same approach as `AttendanceRangeSheet`). No new dependency, no custom calendar grid.
- **DOB rules:** required; **must be 18+**; reject future dates, ages under 18, and dates before 1900. Enforced on both client and backend.
- **Terms:** hard client-side gate (Sign Up disabled until checked) **and** persisted server-side.
- **Backend compatibility:** the signup endpoint also serves the web frontend. `termsAccepted` is **optional** in the DTO so web is unaffected; mobile enforces it client-side. Backend persists a **timestamp** (`termsAcceptedAt`), not a boolean, for consent audit value.
- **Validation timing:** signup form switches from `onSubmit`-only validators to `onChange` so the Sign Up button live-gates on DOB + terms.

## Current state (verified)

- Backend signup DTO already accepts optional `dateOfBirth` (`YYYY-MM-DD`) and persists it to `UserProfile.dateOfBirth`. **No DOB backend work needed.**
- Backend has **no** terms-acceptance field anywhere.
- `@react-native-community/datetimepicker` v8.4.4 + `date-fns` v4 already present in `boh-mobile`.
- Terms/Privacy URLs live in `src/config/app-links.json` (`termsAndConditions`, `privacyPolicy`) and are opened via `openLink` — reuse, do not duplicate.

## Design — boh-mobile

### 1. New atom: `src/components/atoms/DatePicker.tsx`

RNR-pattern, semantic-token styled.

- **Trigger:** bordered `Pressable` row (`border-border bg-card`) showing the formatted date (`date-fns` `format`, e.g. `PPP`) or a muted placeholder, with a trailing chevron icon.
- **Picker:** `@react-native-community/datetimepicker` in `mode="date"`. iOS uses `display="spinner"` (shown inline/in a contained area when opened); Android opens the native dialog on press and closes on change — mirror the platform branch used in `AttendanceRangeSheet.tsx`.
- **Props:** `value: Date | null`, `onChange: (d: Date) => void`, `placeholder?: string`, `minimumDate?: Date`, `maximumDate?: Date`, `disabled?: boolean`.
- Color values come from `useThemeColor`; classes from semantic Tailwind tokens.

### 2. New form field: `src/components/molecules/forms/input-fields/date-picker.tsx`

- `FormDatePicker` — reads `useFieldContext<string>()`, wraps the `DatePicker` atom in `FormBase` (label + error layout).
- Form state holds an **ISO `yyyy-MM-dd` string**. The field converts string ↔ `Date` at the boundary (string → `Date` for the atom's `value`; atom `Date` → `yyyy-MM-dd` via `date-fns` `format` on change).
- Register in `src/components/molecules/forms/hook.ts` `fieldComponents` as `DatePicker`.

### 3. Schema: `src/features/auth/forms/signup.schema.ts`

Add to `signupSchema`:

```ts
dateOfBirth: z
  .string()
  .min(1, 'Date of birth is required')
  .refine((s) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const min = new Date('1900-01-01');
    if (d > now || d < min) return false;
    // 18+ check
    const eighteen = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
    return d <= eighteen;
  }, 'You must be at least 18 years old'),
termsAccepted: z
  .boolean()
  .refine((v) => v === true, 'You must agree to the Terms & Conditions and Privacy Policy'),
```

### 4. Form hook: `src/features/auth/forms/signup.form.ts`

- `defaultValues`: add `dateOfBirth: ''`, `termsAccepted: false`.
- Change `validators` from `{ onSubmit: signupSchema }` to `{ onChange: signupSchema }` (live gating).

### 5. SignupFields in `src/features/auth/components/AuthForm.tsx`

- **DOB field** after the Phone field:
  `<form.AppField name="dateOfBirth">{(field) => <field.DatePicker placeholder="Date of birth" maximumDate={eighteenYearsAgo} />}</form.AppField>` where `eighteenYearsAgo` is `new Date(y-18, m, d)` — caps the picker so under-18 dates can't be chosen (schema is the source of truth; this is UX).
- **Terms row** (custom — `FormCheckbox` only accepts a string label, but we need inline tappable links):
  - `form.AppField name="termsAccepted"` → render the `Checkbox` atom (`checked={field.state.value}`, `onCheckedChange={field.handleChange}`) next to a `Text` containing two `Pressable` links: "Terms & Conditions" → `openLink(APP_LINKS.termsAndConditions)`, "Privacy Policy" → `openLink(APP_LINKS.privacyPolicy)`.
  - Show the field's validation error below the row when present (read from `field.state.meta`).
- Submit handler: pass `dateOfBirth: values.dateOfBirth` and `termsAccepted: values.termsAccepted` into `signupUser(...)`.
- The existing `form.Subscribe` `canSubmit` gate now reflects DOB + terms because validators run `onChange`.

### 6. Types + service

- `src/types/auth.types.ts` `SignupRequest`: add `dateOfBirth?: string;` and `termsAccepted?: boolean;`.
- `src/features/auth/services.ts` `signupUser` already spreads the request body + `channel` → no change.

## Design — boh-lead-magnet-backend

### 1. DTO: `src/modules/auth/dto/signup.dto.ts`

Add terms consent:

```ts
@IsOptional()
@IsBoolean()
termsAccepted?: boolean;
```

**18+ enforcement on existing `dateOfBirth`:** the field stays optional, but when present it must be a date ≥18 years ago. Add a custom class-validator constraint (e.g. `@IsMinimumAge(18)`) or a `@Validate` check on `dateOfBirth` that returns false when `new Date(value) > (today - 18y)`. Keep `@IsOptional()` so absent DOB (web) still passes; only validate the age bound when a value is supplied. Reuse the existing `IsValidName`-style custom-decorator pattern in that module for the implementation.

### 2. Prisma: `prisma/schema/users.prisma` — `UserProfile`

Add column:

```prisma
termsAcceptedAt DateTime? @map("terms_accepted_at")
```

Generate + run a migration.

### 3. Service: `src/modules/auth/auth.service.ts` `signup`

- Accept `termsAccepted` param.
- When `termsAccepted === true`, include `termsAcceptedAt: new Date()` in the `UserProfile` create payload (alongside the existing conditional `dateOfBirth`).

### 4. Controller: `src/modules/auth/auth.controller.ts`

Pass `dto.termsAccepted` through to `authService.signup(...)`.

## Out of scope

- Profile-screen terms links (already exist).
- Web frontend signup form (DTO field optional → unaffected; can adopt the checkbox later).
- DOB backend persistence (already implemented).

## Verification

No test runner in `boh-mobile` (per project convention: verify via `tsc` + `pnpm lint` + manual QA). Backend: existing test/lint commands per its CLAUDE.md, plus a successful migration.

Manual QA checklist:

- Sign Up button stays disabled until a valid DOB is picked and terms is checked.
- Picking a future date / clearing DOB / an under-18 date shows the validation error; picker is capped at 18 years ago.
- Backend rejects a signup whose `dateOfBirth` is under 18.
- Terms links open the correct URLs.
- A mobile signup persists `dateOfBirth` and `termsAcceptedAt` on `UserProfile`.
- Web signup still succeeds without sending `termsAccepted`.
