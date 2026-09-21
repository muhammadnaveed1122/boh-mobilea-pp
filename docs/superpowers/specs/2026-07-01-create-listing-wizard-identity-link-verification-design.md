# Create-Listing Wizard — Identity Verification "Send Verification Link" (full parity)

**Date:** 2026-07-01
**Repo:** `boh-mobile`
**Depends on:** [`2026-07-01-create-listing-wizard-identity-verification-design.md`](./2026-07-01-create-listing-wizard-identity-verification-design.md)

## Goal

Complete the Identity Verification section at full web parity by adding the **Send Verification
Link** method (provider Entrust; UAE Pass disabled "coming soon") alongside the existing Manual
Review. Add a method toggle, hydrate real verified/pending state from the lead's documents,
implement generate/copy/share/reset, the verification-result card, and cross-method locking.

## Web reference

`IdentityVerificationSection` (lead scope) — method toggle (Send Verification Link | Manual
Review); link tab with provider Select (Entrust; UAE Pass disabled "(coming soon)"), Generate
Verification Link button (label + reset logic), generated-link card (Copy + Share WhatsApp/Email),
Pending/Verified badges, `VerificationDetailCard`; manual tab (upload + Mark Verified/Rejected +
Internal Notes). Mutual exclusivity between methods; Reset confirm dialog.

## Current mobile state

- `IdentitySection` (`components/IdentitySection.tsx`) implements Manual Review only: pick →
  Mark Verified/Rejected + Internal Notes, live against the lead, uploaded doc visible. No method
  toggle, no link flow, no hydration from server documents (starts empty each session).
- `use-identity-verification` hook: `uploadAndVerify`, `updateNotes`, `isBusy`.
- `services.ts`: `uploadLeadDocument`, `verifyLeadDocument`, `updateLeadDocumentNotes`, types
  `DocVerifyStatus`/`IdentityDoc`; plus `getLeadDetail` (returns `phone`/`email`).
- `MediaStep` Documents card renders `IdentitySection` (secondary + leadId) and the separate
  "Notes / Remarks" textarea — the latter is unchanged by this work.
- Deps present: `expo-clipboard`, `expo-linking`, `@tanstack/react-query`.

## Out of scope

- `manual-override` (admin force-result) and `simulate` (QA fake-outcome) endpoints — not part of
  the agent-facing wizard flow.
- Real-time push of external verification. The badge updates on **refetch** (on mount, after
  mutations, and via an explicit "Refresh status" affordance) — the owner completes verification
  externally on the provider's page; same model as web (which also re-queries, not live-push).
- UAE Pass functionality — disabled placeholder ("Coming soon") only, matching web.

## Backend contract (lead-scoped, `/api/v1`, apiClient unwraps `{ success, data }`)

- **List docs** — `GET /api/v1/leads/:leadId/documents` → `LeadDocument[]`.
- **Generate link** — `POST /api/v1/leads/:leadId/identity-verification/link` JSON
  `{ provider: 'ENTRUST' | 'UAEPASS', reset?: boolean }` → `{ id: string; url: string }`.
- **Share link** — `POST /api/v1/leads/:leadId/identity-verification/link/:linkId/share` JSON
  `{ mode: 'WHATSAPP' | 'EMAIL' }` → void.

### Types (add to `services.ts`)

```ts
type VerificationProvider = 'ENTRUST' | 'UAEPASS';
type VerificationMethod = 'LINK' | 'MANUAL';
interface VerificationDetail {
  workflowRunId?: string;
  applicantId?: string;
  fullName?: string | null;
  documentType?: string | null;
  issuingCountry?: string | null;
  dateOfBirth?: string | null;
  breakdown?: string[];
}
interface LeadDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  verificationStatus: DocVerifyStatus; // 'PENDING' | 'VERIFIED' | 'REJECTED'
  verificationMethod?: VerificationMethod | null;
  verifiedAt?: string | null;
  verifiedBy?: { firstName: string; lastName: string } | null;
  verificationDetail?: VerificationDetail | null;
  createdAt: string;
}
```

Map server rows defensively (missing fields → sane defaults; unknown status → `'PENDING'`).

## Architecture

### Services (append)

- `getLeadDocuments(leadId): Promise<LeadDocument[]>`
- `generateLeadVerificationLink(leadId, provider, reset?): Promise<{ id: string; url: string }>`
- `shareLeadVerificationLink(leadId, linkId, mode: 'WHATSAPP' | 'EMAIL'): Promise<void>`

### Hooks

- `hooks/use-lead-identity.ts` — `useLeadIdentity(leadId)`:
  - `useQuery(['lead-documents', leadId], () => getLeadDocuments(leadId))` → derive `latestDoc`
    (newest `EMIRATES_ID` by `createdAt`).
  - `useQuery(['lead-detail', leadId], () => getLeadDetail(leadId))` → `contact { phone, email }`.
  - Returns `{ latestDoc, contact, isLoading, refetch }`.
- Extend `hooks/use-identity-verification.ts`: add `generateLink(leadId, provider, reset?)` and
  `shareLink(leadId, linkId, mode)`; keep `uploadAndVerify`/`updateNotes`; `isBusy` covers all.

### Components (`components/`)

- `IdentitySection` (rewrite → container): calls `useLeadIdentity`; derives
  `isLinkVerified` (`latestDoc.verificationStatus==='VERIFIED' && verificationMethod==='LINK'`),
  `isManualVerified` (VERIFIED && method!=='LINK'), `isAlreadyVerified` (VERIFIED any method).
  Renders `MethodToggle` (default `manual` when a manual doc exists, else `link`) + the active tab.
  Passes `latestDoc`, derived flags, `contact`, `refetch`, and the hook actions down.
- `MethodToggle` — two-segment control ("Send Verification Link" | "Manual Review"), active pill,
  semantic tokens, ≥44pt.
- `IdentityLinkTab`:
  - Provider selector: two chips — **Entrust** (selectable, default) and **UAE Pass** disabled with
    a "Coming soon" caption (opacity ~0.45, non-pressable).
  - Generate button (primary, single CTA): label = `getGenerateLabel(isLinkVerified,
isManualVerified, hasGeneratedThisSession)` → "Generate Verification Link" / "Link Generated"
    (disabled) / "Reset & Regenerate". Disabled while `isBusy` / already-generated-this-session /
    manual-verified. On press: if `isAlreadyVerified` → `Alert.alert` confirm → `generateLink(reset:true)`;
    else `generateLink(reset:false)`. Store `{ url, linkId }` in local state.
  - Generated-link card (shown when a link exists this session): truncated URL + **Copy Link**
    (`Clipboard.setStringAsync` + success toast) + **Share** row (WhatsApp + Email icon buttons):
    build `https://wa.me/<digits>?text=…` / `mailto:<email>?subject=…&body=…` from `contact`; open
    via `Linking.openURL`; then `shareLink(linkId, 'WHATSAPP'|'EMAIL')`. Each share button disabled
    when the matching contact field is missing.
  - Badge: **Pending Verification** (Clock) when a link exists and not yet verified; **Verified**
    (CircleCheck) when `isAlreadyVerified`. Icon + text.
  - **Refresh status** — a small text button that calls `refetch()` (with a spinner) so the agent
    can pull the latest verification state after the owner completes it.
  - `VerificationResultCard` when `isLinkVerified` and `latestDoc.verificationDetail` present.
  - "Verified via Manual Review" note (with the shield icon) when `isManualVerified` — Generate
    disabled in that state.
- `IdentityManualTab`: the existing manual-review UI (upload + Mark Verified/Rejected + Internal
  Notes), extracted from the current `IdentitySection`, now hydrated from `latestDoc` (file/status/
  notes seed from the server doc when present). Shows a "verified via link — reset to verify
  manually" locked message when `isLinkVerified`.
- `VerificationResultCard`: labeled rows — Verified name, Document type, Issuing country, Date of
  birth, Provider, Verified (date), Verified by; a "Checks" list from `breakdown`; provider refs
  (workflow/applicant) truncated. Shows a graceful "provider returned no extracted details" note
  when extraction is empty (matches web).

### Provider labels

`ENTRUST → "Entrust"`, `UAEPASS → "UAE Pass"`.

## Data flow / hydration

- On mount `useLeadIdentity` fetches documents + contact. `IdentitySection` derives flags and
  seeds both tabs. After `generateLink`/`shareLink`/`uploadAndVerify`/`updateNotes`, call
  `refetch()` so derived state reflects the server. "Refresh status" also calls `refetch()`.
- `hasGeneratedThisSession` is local (the just-returned link), independent of server state, so the
  agent shares/copies the freshly-generated link without re-generating on every render (web parity).

## Error handling

- Every mutation shows an error toast on failure and does not advance state. Generate/share/copy
  disabled during `isBusy`. Reset always behind an `Alert.alert` confirm.

## UI/UX (ui-ux-pro-max)

- `MethodToggle` = segmented tab (progressive disclosure); one primary CTA (Generate) per view.
- Provider: Entrust active chip; UAE Pass disabled + "Coming soon" (reduced opacity, non-pressable).
- Loading/disabled states on Generate/Copy/Share; Reset behind a confirm dialog (destructive).
- Status badges are icon+text (not color-only). Result card = labeled rows, whitespace-grouped,
  long provider refs truncate. Copy/Share ≥44pt with `accessibilityLabel`. Semantic tokens only;
  the single sanctioned `'#ffffff'` (rejected-button label) stays in the manual tab.

## Files

- Modify: `services.ts` (types + 3 services).
- Create: `hooks/use-lead-identity.ts`.
- Modify: `hooks/use-identity-verification.ts` (add generateLink/shareLink).
- Create: `components/MethodToggle.tsx`, `components/IdentityLinkTab.tsx`,
  `components/IdentityManualTab.tsx`, `components/VerificationResultCard.tsx`.
- Rewrite: `components/IdentitySection.tsx` (container).
- Unchanged: `MediaStep.tsx` (still renders `<IdentitySection leadId=… />`), Documents Notes/Remarks.

## Open items (resolved)

- Full web parity for the link flow (generate/copy/share/reset/badges/result card/hydration).
- UAE Pass disabled "coming soon" placeholder.
- Notes/Remarks: unchanged (already present).
- Verified state via refetch (mount + after mutations + "Refresh status"); no live push (web parity).
- `manual-override` / `simulate`: out of scope.
