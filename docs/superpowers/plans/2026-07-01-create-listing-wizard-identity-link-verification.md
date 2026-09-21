# Identity Verification — Send Verification Link (full parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Send Verification Link method (Entrust; UAE Pass disabled "coming soon") to the identity section at web parity — method toggle, generate/copy/share/reset, hydration of real verified/pending state from the lead's documents, verification-result card, cross-method locking.

**Architecture:** Rewrite `IdentitySection` into a container that hydrates from `getLeadDocuments` + `getLeadDetail` and switches between a new `IdentityLinkTab` and an extracted `IdentityManualTab`. Link actions (generate/share) added to the existing hook; a new `use-lead-identity` query hook supplies the hydration source. Verified state updates via refetch (mount, after mutations, "Refresh status") — same as web.

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind, TanStack Query, axios (`apiClient`), expo-clipboard, RN `Linking`.

## Global Constraints

- **No test runner.** Verify every task with `pnpm exec tsc --noEmit` + `pnpm lint`. No unit tests. Manual QA at the end.
- Strict TypeScript; prop types use `Readonly<{...}>`.
- Prettier: single quotes, semicolons, trailing commas, 100-col, 2-space; `prettier-plugin-tailwindcss` sorts classes.
- Semantic Tailwind tokens only (`bg-card`, `bg-background`, `bg-muted`, `bg-brand`, `text-foreground`, `text-muted-foreground`, `text-brand`, `text-destructive`, `border-border`, `border-brand`) — no hardcoded hex except the single sanctioned `'#ffffff'` already in the manual tab's rejected-button label.
- API paths prefixed `/api/v1`. `apiClient` unwraps `{ success, data }`.
- Icons are Lucide keys via the `Icon` atom; if tsc rejects a key as not assignable to `IconName`, swap to a valid Lucide key and report.
- A parallel "listings compare" effort commits to the same branch under `src/features/listings/*`. Touch ONLY files under `src/features/listing-wizard/`. Commit with the exact `git add` paths per task; never `git add -A`/`.` (unrelated `.gitignore`, `DatePicker.tsx`, `src/features/listings/*` must stay out).
- Spec: [`docs/superpowers/specs/2026-07-01-create-listing-wizard-identity-link-verification-design.md`](../specs/2026-07-01-create-listing-wizard-identity-link-verification-design.md).

---

### Task 1: Link services + document types

**Files:**

- Modify: `src/features/listing-wizard/services.ts` (append)

**Interfaces:**

- Consumes: `apiClient`; existing `DocVerifyStatus` (from the earlier identity work).
- Produces:
  - `type VerificationProvider = 'ENTRUST' | 'UAEPASS'`
  - `type VerificationMethod = 'LINK' | 'MANUAL'`
  - `interface VerificationDetail { workflowRunId?: string; applicantId?: string; fullName?: string | null; documentType?: string | null; issuingCountry?: string | null; dateOfBirth?: string | null; breakdown?: string[] }`
  - `interface LeadDocument { id; documentType; fileUrl; fileName; fileSize: number|null; mimeType: string|null; notes: string|null; verificationStatus: DocVerifyStatus; verificationMethod: VerificationMethod|null; verifiedAt: string|null; verifiedBy: { firstName: string; lastName: string }|null; verificationDetail: VerificationDetail|null; createdAt: string }`
  - `getLeadDocuments(leadId: string): Promise<LeadDocument[]>`
  - `generateLeadVerificationLink(leadId: string, provider: VerificationProvider, reset?: boolean): Promise<{ id: string; url: string }>`
  - `shareLeadVerificationLink(leadId: string, linkId: string, mode: 'WHATSAPP' | 'EMAIL'): Promise<void>`

- [ ] **Step 1: Append the types + services**

Append to `src/features/listing-wizard/services.ts`:

```ts
// ---------------------------------------------------------------------------
// Identity Verification — Send Verification Link (lead-scoped). Generate/share
// the provider link + list docs for hydration of verified/pending state.
// ---------------------------------------------------------------------------

export type VerificationProvider = 'ENTRUST' | 'UAEPASS';
export type VerificationMethod = 'LINK' | 'MANUAL';

export interface VerificationDetail {
  workflowRunId?: string;
  applicantId?: string;
  fullName?: string | null;
  documentType?: string | null;
  issuingCountry?: string | null;
  dateOfBirth?: string | null;
  breakdown?: string[];
}

export interface LeadDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  verificationStatus: DocVerifyStatus;
  verificationMethod: VerificationMethod | null;
  verifiedAt: string | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  verificationDetail: VerificationDetail | null;
  createdAt: string;
}

function readStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function mapLeadDocument(raw: unknown): LeadDocument {
  const d = (raw ?? {}) as Record<string, unknown>;
  const s = d.verificationStatus;
  const verificationStatus: DocVerifyStatus = s === 'VERIFIED' || s === 'REJECTED' ? s : 'PENDING';
  const m = d.verificationMethod;
  const verificationMethod: VerificationMethod | null = m === 'LINK' || m === 'MANUAL' ? m : null;
  const vb = d.verifiedBy as Record<string, unknown> | null | undefined;
  const detail = d.verificationDetail as VerificationDetail | null | undefined;
  return {
    id: String(d.id ?? ''),
    documentType: String(d.documentType ?? ''),
    fileUrl: readStr(d.fileUrl) ?? '',
    fileName: readStr(d.fileName) ?? 'document',
    fileSize: typeof d.fileSize === 'number' ? d.fileSize : null,
    mimeType: readStr(d.mimeType),
    notes: readStr(d.notes),
    verificationStatus,
    verificationMethod,
    verifiedAt: readStr(d.verifiedAt),
    verifiedBy:
      vb && typeof vb === 'object'
        ? { firstName: String(vb.firstName ?? ''), lastName: String(vb.lastName ?? '') }
        : null,
    verificationDetail: detail && typeof detail === 'object' ? detail : null,
    createdAt: readStr(d.createdAt) ?? '',
  };
}

/** List the owner's documents (for hydrating identity verification state). */
export async function getLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  const { data } = await apiClient.get<unknown[]>(`/api/v1/leads/${leadId}/documents`);
  return (Array.isArray(data) ? data : []).map(mapLeadDocument);
}

/** Generate (or, with reset, regenerate) a provider verification link for the owner. */
export async function generateLeadVerificationLink(
  leadId: string,
  provider: VerificationProvider,
  reset?: boolean,
): Promise<{ id: string; url: string }> {
  const { data } = await apiClient.post<{ id: string; url: string }>(
    `/api/v1/leads/${leadId}/identity-verification/link`,
    { provider, reset },
  );
  return { id: data.id, url: data.url };
}

/** Record that the verification link was shared via WhatsApp or Email (activity timeline). */
export async function shareLeadVerificationLink(
  leadId: string,
  linkId: string,
  mode: 'WHATSAPP' | 'EMAIL',
): Promise<void> {
  await apiClient.post(`/api/v1/leads/${leadId}/identity-verification/link/${linkId}/share`, {
    mode,
  });
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint` (no new errors in services.ts). Confirm `DocVerifyStatus` already exists in the file (from the earlier identity work) — do not redefine.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add verification-link + lead-documents services"
```

---

### Task 2: `use-lead-identity` hydration hook

**Files:**

- Create: `src/features/listing-wizard/hooks/use-lead-identity.ts`

**Interfaces:**

- Consumes: `getLeadDocuments`, `getLeadDetail`, `LeadDocument` (`../services`); `useQuery`.
- Produces:
  - `interface LeadContact { phone: string | null; email: string | null }`
  - `useLeadIdentity(leadId: string): { latestDoc: LeadDocument | null; contact: LeadContact; isLoading: boolean; refetch: () => Promise<void> }`

- [ ] **Step 1: Write the hook**

Create `src/features/listing-wizard/hooks/use-lead-identity.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getLeadDetail, getLeadDocuments, type LeadDocument } from '../services';

export interface LeadContact {
  phone: string | null;
  email: string | null;
}

/**
 * Hydration source for the identity section: the owner's latest EMIRATES_ID document (drives
 * verified/pending state + method) and the owner's contact (for link sharing). Re-query via
 * `refetch` after mutations or on demand — external verification is not pushed live.
 */
export function useLeadIdentity(leadId: string) {
  const docsQuery = useQuery({
    queryKey: ['lead-documents', leadId],
    queryFn: () => getLeadDocuments(leadId),
    enabled: leadId !== '',
  });
  const detailQuery = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => getLeadDetail(leadId),
    enabled: leadId !== '',
  });

  const docs = docsQuery.data ?? [];
  const latestDoc =
    docs
      .filter((d) => d.documentType === 'EMIRATES_ID')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;

  const contact: LeadContact = {
    phone: detailQuery.data?.phone ?? null,
    email: detailQuery.data?.email ?? null,
  };

  const refetch = async (): Promise<void> => {
    await docsQuery.refetch();
  };

  return {
    latestDoc: latestDoc as LeadDocument | null,
    contact,
    isLoading: docsQuery.isLoading,
    refetch,
  };
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`. Confirm `getLeadDetail` exists in `services.ts` and returns an object with optional `phone`/`email` (it does).
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/hooks/use-lead-identity.ts
git commit -m "feat(listing-wizard): add use-lead-identity hydration hook"
```

---

### Task 3: Add generate/share to `use-identity-verification`

**Files:**

- Modify: `src/features/listing-wizard/hooks/use-identity-verification.ts`

**Interfaces:**

- Consumes: `generateLeadVerificationLink`, `shareLeadVerificationLink`, `VerificationProvider` (`../services`).
- Produces (added to the hook's return): `generateLink(leadId: string, provider: VerificationProvider, reset?: boolean): Promise<{ id: string; url: string }>`, `shareLink(leadId: string, linkId: string, mode: 'WHATSAPP' | 'EMAIL'): Promise<void>`.

- [ ] **Step 1: Extend the hook**

In `src/features/listing-wizard/hooks/use-identity-verification.ts`, add to the imports:

```ts
import {
  generateLeadVerificationLink,
  shareLeadVerificationLink,
  type VerificationProvider,
} from '../services';
```

Inside `useIdentityVerification`, before the `return`, add the two functions and include them in the returned object:

```ts
const generateLink = async (
  leadId: string,
  provider: VerificationProvider,
  reset?: boolean,
): Promise<{ id: string; url: string }> => {
  setIsBusy(true);
  try {
    return await generateLeadVerificationLink(leadId, provider, reset);
  } finally {
    setIsBusy(false);
  }
};

const shareLink = async (
  leadId: string,
  linkId: string,
  mode: 'WHATSAPP' | 'EMAIL',
): Promise<void> => {
  setIsBusy(true);
  try {
    await shareLeadVerificationLink(leadId, linkId, mode);
  } finally {
    setIsBusy(false);
  }
};

return { uploadAndVerify, updateNotes, generateLink, shareLink, isBusy };
```

(Replace the existing `return { uploadAndVerify, updateNotes, isBusy };` line with the object above.)

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/hooks/use-identity-verification.ts
git commit -m "feat(listing-wizard): add generateLink + shareLink to identity hook"
```

---

### Task 4: `VerificationResultCard`

**Files:**

- Create: `src/features/listing-wizard/components/VerificationResultCard.tsx`

**Interfaces:**

- Consumes: `VerificationDetail` (`../services`); atoms `Icon`, `Text`; `useThemeColor`.
- Produces: `VerificationResultCard({ detail, verifiedAt, verifiedByName, providerLabel }: Readonly<{ detail: VerificationDetail; verifiedAt: string | null; verifiedByName: string | null; providerLabel: string }>)`.

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/VerificationResultCard.tsx`:

```tsx
import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import type { VerificationDetail } from '../services';

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-xs font-medium text-foreground">{value}</Text>
    </View>
  );
}

export function VerificationResultCard({
  detail,
  verifiedAt,
  verifiedByName,
  providerLabel,
}: Readonly<{
  detail: VerificationDetail;
  verifiedAt: string | null;
  verifiedByName: string | null;
  providerLabel: string;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');

  const rows: { label: string; value: string }[] = [];
  if (detail.fullName) rows.push({ label: 'Verified name', value: detail.fullName });
  if (detail.documentType)
    rows.push({ label: 'Document type', value: humanize(detail.documentType) });
  if (detail.issuingCountry)
    rows.push({ label: 'Issuing country', value: detail.issuingCountry.toUpperCase() });
  if (detail.dateOfBirth) rows.push({ label: 'Date of birth', value: detail.dateOfBirth });
  rows.push({ label: 'Provider', value: providerLabel });
  if (verifiedAt) rows.push({ label: 'Verified', value: verifiedAt });
  if (verifiedByName) rows.push({ label: 'Verified by', value: verifiedByName });

  const breakdown = detail.breakdown ?? [];
  const hasExtraction = Boolean(detail.fullName) || Boolean(detail.documentType);

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-1.5">
        <Icon name="ShieldCheck" size={16} color={brand} />
        <Text className="text-sm font-medium text-foreground">Verification result</Text>
      </View>

      <View className="gap-1.5">
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </View>

      {!hasExtraction ? (
        <Text className="text-[11px] text-muted-foreground">
          The provider did not return extracted document details. Review the verification in the
          provider dashboard using the reference below.
        </Text>
      ) : null}

      {breakdown.length > 0 ? (
        <View className="gap-1">
          <Text className="text-[10px] font-medium uppercase text-muted-foreground">Checks</Text>
          {breakdown.map((item) => (
            <View key={item} className="flex-row items-center gap-1.5">
              <Icon name="Check" size={11} color={brand} />
              <Text className="text-[11px] text-muted-foreground">{humanize(item)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {detail.workflowRunId !== undefined || detail.applicantId !== undefined ? (
        <View className="gap-0.5 border-t border-border pt-2">
          <Text className="text-[10px] font-medium text-muted-foreground">Provider reference</Text>
          {detail.workflowRunId !== undefined ? (
            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
              Workflow: {detail.workflowRunId}
            </Text>
          ) : null}
          {detail.applicantId !== undefined ? (
            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
              Applicant: {detail.applicantId}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (if `ShieldCheck`/`Check` reject as `IconName`, swap to valid Lucide keys and report), `pnpm lint`. `mutedFg` may be unused if not referenced — remove the declaration if lint flags it.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/VerificationResultCard.tsx
git commit -m "feat(listing-wizard): add VerificationResultCard"
```

---

### Task 5: `MethodToggle`

**Files:**

- Create: `src/features/listing-wizard/components/MethodToggle.tsx`

**Interfaces:**

- Produces:
  - `type IdentityMethod = 'link' | 'manual'`
  - `MethodToggle({ value, onChange }: Readonly<{ value: IdentityMethod; onChange: (m: IdentityMethod) => void }>)`

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/MethodToggle.tsx`:

```tsx
import { Pressable, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export type IdentityMethod = 'link' | 'manual';

const OPTIONS: { id: IdentityMethod; label: string }[] = [
  { id: 'link', label: 'Send Verification Link' },
  { id: 'manual', label: 'Manual Review' },
];

export function MethodToggle({
  value,
  onChange,
}: Readonly<{ value: IdentityMethod; onChange: (m: IdentityMethod) => void }>) {
  return (
    <View className="flex-row rounded-full bg-muted p-1">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            className={cn(
              'flex-1 items-center justify-center rounded-full py-2',
              active ? 'bg-brand' : 'bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/MethodToggle.tsx
git commit -m "feat(listing-wizard): add identity MethodToggle"
```

---

### Task 6: `IdentityLinkTab`

**Files:**

- Create: `src/features/listing-wizard/components/IdentityLinkTab.tsx`

**Interfaces:**

- Consumes: `useIdentityVerification` (for `generateLink`/`shareLink`/`isBusy`); `LeadContact` (`../hooks/use-lead-identity`); `LeadDocument`, `VerificationProvider` (`../services`); `VerificationResultCard`; `showToast`; atoms `Button`, `Icon`(+`IconName`), `Text`; `cn`; `useThemeColor`; `expo-clipboard`; RN `Alert`, `Linking`, `Pressable`, `View`.
- Produces:
  - `interface IdentityLinkTabProps { leadId: string; latestDoc: LeadDocument | null; contact: LeadContact; isLinkVerified: boolean; isManualVerified: boolean; isAlreadyVerified: boolean; onRefetch: () => Promise<void> }`
  - `IdentityLinkTab(props: Readonly<IdentityLinkTabProps>)`

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/IdentityLinkTab.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useIdentityVerification } from '../hooks/use-identity-verification';
import type { LeadContact } from '../hooks/use-lead-identity';
import type { LeadDocument, VerificationProvider } from '../services';
import { VerificationResultCard } from './VerificationResultCard';

const PROVIDER_LABEL: Record<VerificationProvider, string> = {
  ENTRUST: 'Entrust',
  UAEPASS: 'UAE Pass',
};

export interface IdentityLinkTabProps {
  leadId: string;
  latestDoc: LeadDocument | null;
  contact: LeadContact;
  isLinkVerified: boolean;
  isManualVerified: boolean;
  isAlreadyVerified: boolean;
  onRefetch: () => Promise<void>;
}

function generateLabel(isLinkVerified: boolean, hasGenerated: boolean): string {
  if (hasGenerated) return 'Link Generated';
  if (isLinkVerified) return 'Reset & Regenerate';
  return 'Generate Verification Link';
}

function waHref(phone: string | null, link: string): string | undefined {
  const digits = phone?.replace(/\D/g, '');
  if (!digits) return undefined;
  const msg = `Please complete your identity verification using this secure link: ${link}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

function mailHref(email: string | null, link: string): string | undefined {
  if (!email) return undefined;
  const subject = 'Complete your identity verification';
  const body = `Please complete your identity verification using this secure link:\n\n${link}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function IdentityLinkTab({
  leadId,
  latestDoc,
  contact,
  isLinkVerified,
  isManualVerified,
  isAlreadyVerified,
  onRefetch,
}: Readonly<IdentityLinkTabProps>) {
  const brand = useThemeColor('--brand');
  const brandFg = useThemeColor('--brand-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const { generateLink, shareLink, isBusy } = useIdentityVerification();

  const [provider, setProvider] = useState<VerificationProvider>('ENTRUST');
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);

  const hasGenerated = link !== null;

  const doGenerate = async (reset: boolean) => {
    try {
      const res = await generateLink(leadId, provider, reset);
      setLink(res);
      await onRefetch();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not generate link.');
    }
  };

  const onGenerate = () => {
    if (isManualVerified) return;
    if (isAlreadyVerified) {
      Alert.alert(
        'Reset verification?',
        'This clears the current verified result and generates a new verification link. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: () => void doGenerate(true) },
        ],
      );
      return;
    }
    void doGenerate(false);
  };

  const copy = async () => {
    if (link === null) return;
    await Clipboard.setStringAsync(link.url);
    showToast('success', 'Verification link copied');
  };

  const share = async (mode: 'WHATSAPP' | 'EMAIL') => {
    if (link === null) return;
    const href =
      mode === 'WHATSAPP' ? waHref(contact.phone, link.url) : mailHref(contact.email, link.url);
    if (href === undefined) {
      showToast(
        'error',
        mode === 'WHATSAPP' ? 'No phone for this owner.' : 'No email for this owner.',
      );
      return;
    }
    try {
      await Linking.openURL(href);
      await shareLink(leadId, link.id, mode);
    } catch {
      showToast('error', 'Could not open share.');
    }
  };

  return (
    <View className="gap-4">
      {/* Provider */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setProvider('ENTRUST')}
          accessibilityRole="button"
          accessibilityState={{ selected: provider === 'ENTRUST' }}
          accessibilityLabel="Entrust provider"
          className={cn(
            'flex-1 items-center rounded-lg border px-3 py-2.5',
            provider === 'ENTRUST' ? 'border-brand bg-brand/10' : 'border-border bg-background',
          )}
        >
          <Text
            className={cn(
              'text-sm font-medium',
              provider === 'ENTRUST' ? 'text-brand' : 'text-foreground',
            )}
          >
            Entrust
          </Text>
        </Pressable>
        <View
          accessibilityState={{ disabled: true }}
          className="flex-1 items-center rounded-lg border border-border bg-muted px-3 py-2 opacity-50"
        >
          <Text className="text-sm font-medium text-muted-foreground">UAE Pass</Text>
          <Text className="text-[10px] text-muted-foreground">Coming soon</Text>
        </View>
      </View>

      {isManualVerified ? (
        <View className="flex-row items-center gap-1.5 rounded-xl border border-border bg-card p-3">
          <Icon name="ShieldCheck" size={16} color={brand} />
          <Text className="flex-1 text-xs text-muted-foreground">
            Verified via Manual Review. Manage it from the Manual Review tab.
          </Text>
        </View>
      ) : (
        <Button onPress={onGenerate} disabled={isBusy || hasGenerated} loading={isBusy}>
          <Text>{generateLabel(isLinkVerified, hasGenerated)}</Text>
        </Button>
      )}

      {/* Generated-link card */}
      {hasGenerated ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-3">
          <Text className="text-xs font-medium text-muted-foreground">Verification Link</Text>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {link?.url}
            </Text>
            <Pressable
              onPress={() => void copy()}
              accessibilityRole="button"
              accessibilityLabel="Copy verification link"
              className="flex-row items-center gap-1 rounded-full bg-brand px-3 py-1.5 active:opacity-80"
            >
              <Icon name="Copy" size={12} color={brandFg} />
              <Text className="text-xs font-medium" style={{ color: brandFg }}>
                Copy
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-muted-foreground">Share via:</Text>
            <Pressable
              onPress={() => void share('WHATSAPP')}
              accessibilityRole="button"
              accessibilityLabel="Share via WhatsApp"
              className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-80"
            >
              <Icon name="MessageCircle" size={16} color={brand} />
            </Pressable>
            <Pressable
              onPress={() => void share('EMAIL')}
              accessibilityRole="button"
              accessibilityLabel="Share via Email"
              className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-80"
            >
              <Icon name="Mail" size={16} color={brand} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Status badge */}
      <View className="flex-row items-center gap-2">
        {isAlreadyVerified ? (
          <View className="flex-row items-center gap-1">
            <Icon name="CircleCheck" size={14} color={brand} />
            <Text className="text-xs font-medium" style={{ color: brand }}>
              Verified
            </Text>
          </View>
        ) : hasGenerated ? (
          <View className="flex-row items-center gap-1">
            <Icon name="Clock" size={14} color={mutedFg} />
            <Text className="text-xs text-muted-foreground">Pending Verification</Text>
          </View>
        ) : null}
        <View className="flex-1" />
        <Pressable
          onPress={() => void onRefetch()}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Refresh verification status"
        >
          <Text className="text-xs font-medium text-brand">Refresh status</Text>
        </Pressable>
      </View>

      {isLinkVerified && latestDoc?.verificationDetail ? (
        <VerificationResultCard
          detail={latestDoc.verificationDetail}
          verifiedAt={latestDoc.verifiedAt}
          verifiedByName={
            latestDoc.verifiedBy
              ? `${latestDoc.verifiedBy.firstName} ${latestDoc.verifiedBy.lastName}`.trim()
              : null
          }
          providerLabel={PROVIDER_LABEL[provider]}
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
  - Icons used: `ShieldCheck`, `Copy`, `MessageCircle`, `Mail`, `CircleCheck`, `Clock`. If any is rejected as `IconName`, swap to a valid Lucide key (`ShieldCheck`→`ShieldCheck` or `Shield`; `MessageCircle`→`MessageCircle` or `Send`) and report.
  - `useThemeColor('--brand-foreground')` is called inside JSX twice (Copy icon + text). If lint/rules-of-hooks flags it, hoist `const brandFg = useThemeColor('--brand-foreground')` to the top with the other theme colors and use `brandFg`. Prefer hoisting proactively.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/IdentityLinkTab.tsx
git commit -m "feat(listing-wizard): add IdentityLinkTab (generate/copy/share/result)"
```

---

### Task 7: `IdentityManualTab` (extract + hydrate)

**Files:**

- Create: `src/features/listing-wizard/components/IdentityManualTab.tsx`

**Interfaces:**

- Consumes: `useIdentityVerification`; `pickSingleDocument`; `WizardDocItem`; `DocVerifyStatus`, `IdentityDoc`, `LeadDocument` (`../services`); `showToast`; atoms `Button`, `Icon`(+`IconName`), `Label`, `Text`, `Textarea`; `cn`; `useThemeColor`; RN `Image`, `Linking`, `Pressable`, `View`.
- Produces:
  - `interface IdentityManualTabProps { leadId: string; latestDoc: LeadDocument | null; isLinkVerified: boolean; onRefetch: () => Promise<void> }`
  - `IdentityManualTab(props: Readonly<IdentityManualTabProps>)`

- [ ] **Step 1: Write the component**

This is the current `IdentitySection` manual UI, moved here, seeded from `latestDoc`, with a lock message when `isLinkVerified`, and `onRefetch()` after a successful mark. Create `src/features/listing-wizard/components/IdentityManualTab.tsx`:

```tsx
import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useIdentityVerification } from '../hooks/use-identity-verification';
import { pickSingleDocument } from '../media/pickers';
import type { WizardDocItem } from '../media/types';
import type { DocVerifyStatus, IdentityDoc, LeadDocument } from '../services';

function isImageFile(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function docIcon(mime: string, name: string): IconName {
  if (isImageFile(mime, name)) return 'Image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'FileText';
  return 'File';
}

/** Seed an IdentityDoc from a server LeadDocument when it represents a real manual upload
 *  (has a file). A synthetic link doc (LINK method, empty fileUrl) is not a manual doc. */
function seedManualDoc(latest: LeadDocument | null): IdentityDoc | null {
  if (latest === null) return null;
  if (latest.verificationMethod === 'LINK' && latest.fileUrl === '') return null;
  return {
    id: latest.id,
    fileName: latest.fileName,
    fileUrl: latest.fileUrl,
    mimeType: latest.mimeType ?? '',
  };
}

export interface IdentityManualTabProps {
  leadId: string;
  latestDoc: LeadDocument | null;
  isLinkVerified: boolean;
  onRefetch: () => Promise<void>;
}

export function IdentityManualTab({
  leadId,
  latestDoc,
  isLinkVerified,
  onRefetch,
}: Readonly<IdentityManualTabProps>) {
  const brand = useThemeColor('--brand');
  const brandFg = useThemeColor('--brand-foreground');
  const destructive = useThemeColor('--destructive');
  const mutedFg = useThemeColor('--muted-foreground');
  const { uploadAndVerify, updateNotes, isBusy } = useIdentityVerification();

  const seeded = seedManualDoc(latestDoc);
  const seededStatus: DocVerifyStatus =
    seeded !== null && latestDoc ? latestDoc.verificationStatus : 'PENDING';

  const [pendingFile, setPendingFile] = useState<WizardDocItem | null>(null);
  const [uploaded, setUploaded] = useState<IdentityDoc | null>(seeded);
  const [notes, setNotes] = useState(latestDoc?.notes ?? '');
  const [status, setStatus] = useState<DocVerifyStatus>(seededStatus);

  const displayName = pendingFile?.name ?? uploaded?.fileName;
  const displayMime = pendingFile?.mimeType ?? uploaded?.mimeType ?? '';
  const previewUri =
    uploaded?.fileUrl !== undefined && uploaded.fileUrl !== ''
      ? uploaded.fileUrl
      : pendingFile?.uri;
  const hasFile = pendingFile !== null || uploaded !== null;

  const statusMeta: Record<DocVerifyStatus, { label: string; icon: IconName; color: string }> = {
    PENDING: { label: 'Pending', icon: 'Clock', color: mutedFg },
    VERIFIED: { label: 'Verified', icon: 'CircleCheck', color: brand },
    REJECTED: { label: 'Rejected', icon: 'CircleX', color: destructive },
  };

  if (isLinkVerified) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-xl border border-border bg-card p-3">
        <Icon name="ShieldCheck" size={16} color={brand} />
        <Text className="flex-1 text-xs text-muted-foreground">
          Already verified via verification link. To verify manually instead, reset it from the Send
          Verification Link tab.
        </Text>
      </View>
    );
  }

  const pick = async () => {
    const f = await pickSingleDocument();
    if (f === null) return;
    setPendingFile(f);
    setUploaded(null);
    setStatus('PENDING');
  };

  const openDoc = async () => {
    if (previewUri === undefined) return;
    try {
      const ok = await Linking.canOpenURL(previewUri);
      if (!ok) {
        showToast('error', 'Cannot open this document.');
        return;
      }
      await Linking.openURL(previewUri);
    } catch {
      showToast('error', 'Cannot open this document.');
    }
  };

  const mark = async (next: 'VERIFIED' | 'REJECTED') => {
    if (!hasFile) return;
    if (next === 'REJECTED' && notes.trim() === '') {
      showToast('error', 'Add internal notes before rejecting.');
      return;
    }
    const fileForUpload: WizardDocItem = pendingFile ?? {
      uri: uploaded?.fileUrl ?? '',
      name: uploaded?.fileName ?? 'document',
      mimeType: uploaded?.mimeType ?? 'application/octet-stream',
    };
    try {
      const doc = await uploadAndVerify({
        leadId,
        file: fileForUpload,
        existingId: uploaded?.id,
        status: next,
        notes,
      });
      if (doc !== null) {
        setUploaded(doc);
        setPendingFile(null);
      }
      setStatus(next);
      await onRefetch();
      showToast('success', next === 'VERIFIED' ? 'Identity verified' : 'Identity marked rejected');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not update identity.');
    }
  };

  const sMeta = statusMeta[status];

  return (
    <View className="gap-3">
      {hasFile ? (
        <Pressable
          onPress={() => void openDoc()}
          accessibilityRole="button"
          accessibilityLabel="Open document"
          className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 active:opacity-80"
        >
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
            {previewUri !== undefined && isImageFile(displayMime, displayName ?? '') ? (
              <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Icon name={docIcon(displayMime, displayName ?? '')} size={20} color={mutedFg} />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name={sMeta.icon} size={12} color={sMeta.color} />
              <Text className="text-xs" style={{ color: sMeta.color }}>
                {sMeta.label}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void pick()}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Add Emirates ID or Passport"
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-6 active:opacity-80"
        >
          <Icon name="Plus" size={18} color={brand} />
          <Text className="text-sm font-medium text-foreground">Add Emirates ID / Passport</Text>
        </Pressable>
      )}

      {hasFile ? (
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className={cn('flex-1 border-brand', status === 'VERIFIED' && 'bg-brand')}
            disabled={isBusy || status === 'VERIFIED'}
            onPress={() => void mark('VERIFIED')}
          >
            <Text style={{ color: status === 'VERIFIED' ? brandFg : brand }}>
              {status === 'VERIFIED' ? 'Verified' : 'Mark Verified'}
            </Text>
          </Button>
          <Button
            variant="outline"
            className={cn('flex-1 border-destructive', status === 'REJECTED' && 'bg-destructive')}
            disabled={isBusy || status === 'REJECTED'}
            onPress={() => void mark('REJECTED')}
          >
            <Text style={{ color: status === 'REJECTED' ? '#ffffff' : destructive }}>
              {status === 'REJECTED' ? 'Rejected' : 'Mark Rejected'}
            </Text>
          </Button>
        </View>
      ) : null}

      <View className="gap-1.5">
        <Label>
          Internal Notes
          {status === 'REJECTED' ? <Text className="text-destructive"> *</Text> : null}
        </Label>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          onBlur={() => {
            if (uploaded !== null) void updateNotes(leadId, uploaded.id, notes);
          }}
          placeholder="Enter any additional notes here..."
          numberOfLines={3}
          editable={!isBusy}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint` (sonarjs cognitive-complexity cap 20). Icon fallbacks as before if any key rejects.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/IdentityManualTab.tsx
git commit -m "feat(listing-wizard): add IdentityManualTab (extracted + hydrated)"
```

---

### Task 8: Rewrite `IdentitySection` container

**Files:**

- Modify: `src/features/listing-wizard/components/IdentitySection.tsx` (full rewrite)

**Interfaces:**

- Consumes: `useLeadIdentity`; `MethodToggle` (+`IdentityMethod`); `IdentityLinkTab`; `IdentityManualTab`; `LeadDocument` (`../services`); atoms `Text`, `View`.
- Produces: `IdentitySection({ leadId }: Readonly<{ leadId: string }>)` (unchanged signature — `MediaStep` keeps rendering it).

- [ ] **Step 1: Rewrite the container**

Replace the whole file `src/features/listing-wizard/components/IdentitySection.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';

import { useLeadIdentity } from '../hooks/use-lead-identity';
import { IdentityLinkTab } from './IdentityLinkTab';
import { IdentityManualTab } from './IdentityManualTab';
import { MethodToggle, type IdentityMethod } from './MethodToggle';

export function IdentitySection({ leadId }: Readonly<{ leadId: string }>) {
  const { latestDoc, contact, refetch } = useLeadIdentity(leadId);

  const isAlreadyVerified = latestDoc?.verificationStatus === 'VERIFIED';
  const isLinkVerified = isAlreadyVerified && latestDoc?.verificationMethod === 'LINK';
  const isManualVerified = isAlreadyVerified && !isLinkVerified;
  // A real manual document (has a file) → default to the Manual tab; otherwise the Link tab.
  const hasManualDoc =
    latestDoc !== null && !(latestDoc.verificationMethod === 'LINK' && latestDoc.fileUrl === '');

  const [method, setMethod] = useState<IdentityMethod>('link');
  // Seed the default tab once from the hydrated document (manual doc → manual tab).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && latestDoc !== null) {
      setSeeded(true);
      if (hasManualDoc && !isLinkVerified) setMethod('manual');
    }
  }, [seeded, latestDoc, hasManualDoc, isLinkVerified]);

  return (
    <View className="gap-3 rounded-xl border border-border bg-background p-3">
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Identity Verification</Text>
        <Text className="text-xs text-muted-foreground">
          Complete identity verification with either Passport or Emirates ID.
        </Text>
      </View>

      <MethodToggle value={method} onChange={setMethod} />

      {method === 'link' ? (
        <IdentityLinkTab
          leadId={leadId}
          latestDoc={latestDoc}
          contact={contact}
          isLinkVerified={isLinkVerified}
          isManualVerified={isManualVerified}
          isAlreadyVerified={isAlreadyVerified}
          onRefetch={refetch}
        />
      ) : (
        <IdentityManualTab
          leadId={leadId}
          latestDoc={latestDoc}
          isLinkVerified={isLinkVerified}
          onRefetch={refetch}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (integration gate — all prior tasks' types must line up), `pnpm lint` (cognitive-complexity cap 20). `MediaStep` is unchanged (still `<IdentitySection leadId=… />`).
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/IdentitySection.tsx
git commit -m "feat(listing-wizard): rewrite IdentitySection with method toggle + hydration"
```

---

### Task 9: Manual QA

No automated tests (project rule). Run on device/simulator.

- [ ] **Step 1: Launch** — `pnpm ios` (or `pnpm android`); sign in with listing-create permission; open Create Listing.
- [ ] **Step 2: Reach the identity section** — secondary completion status + owner/property → Create & Continue → Description Save & Continue → Media step → Documents card → Identity Verification. The **method toggle** (Send Verification Link | Manual Review) shows; default tab is Link for a fresh owner.
- [ ] **Step 3: Link flow**
  1. Provider: **Entrust** selected; **UAE Pass** shows "Coming soon", is dimmed and not tappable.
  2. Tap **Generate Verification Link** → spinner → link card appears with the URL, **Copy** and **Share** (WhatsApp/Email); badge shows **Pending Verification**; button now reads **Link Generated** (disabled).
  3. Network Logger: `POST /api/v1/leads/:leadId/identity-verification/link {provider:'ENTRUST'}` (200).
  4. **Copy** → toast "Verification link copied"; paste elsewhere to confirm.
  5. **Share via WhatsApp / Email** → opens the app with a prefilled message; `POST .../link/:linkId/share {mode}` fires. If the owner has no phone/email, the matching button toasts "No phone/email for this owner."
  6. **Refresh status** → `GET /api/v1/leads/:leadId/documents` re-runs; if the owner has completed verification externally, badge flips to **Verified** and the **Verification result** card appears.
- [ ] **Step 4: Reset** — once verified, the button reads **Reset & Regenerate**; tapping it shows a confirm dialog; confirming calls generate with `reset:true` and returns to Pending.
- [ ] **Step 5: Manual tab + cross-lock**
  1. Switch to **Manual Review** → upload + Mark Verified/Rejected + Internal Notes (as before); state hydrates from the server doc if one exists.
  2. If identity was link-verified, the Manual tab shows the "verified via link — reset to verify manually" lock message.
  3. If manually verified, the Link tab shows "Verified via Manual Review" and Generate is disabled.
- [ ] **Step 6: Notes / Remarks** — the Documents card's separate "Notes / Remarks" textarea is still present and unchanged.

---

## Self-Review

**Spec coverage:**

- Link/doc services (getLeadDocuments, generate, share) + types → Task 1. ✓
- Hydration hook (`use-lead-identity`) → Task 2. ✓
- generateLink/shareLink on the hook → Task 3. ✓
- VerificationResultCard → Task 4. ✓
- MethodToggle → Task 5. ✓
- IdentityLinkTab (provider select w/ UAE Pass "coming soon", generate w/ label+reset, copy, share, badges, refresh, result card, manual-verified note) → Task 6. ✓
- IdentityManualTab (extract + hydrate + link-lock) → Task 7. ✓
- IdentitySection container (toggle, derived flags, default tab, wiring) → Task 8. ✓
- Verified via refetch (mount + after mutations + Refresh status) → Tasks 2/6/7. ✓
- Notes/Remarks unchanged; MediaStep untouched. ✓
- Out of scope (manual-override, simulate, live push, UAE Pass functionality) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**Type consistency:** `VerificationProvider`/`VerificationMethod`/`VerificationDetail`/`LeadDocument` (Task 1) used by Tasks 2/4/6/7/8. `LeadContact` (Task 2) used by Task 6. `generateLink`/`shareLink` (Task 3) used by Task 6. `IdentityMethod` (Task 5) used by Task 8. `IdentityLinkTabProps`/`IdentityManualTabProps` defined in their files, consumed by Task 8. `IdentityDoc`/`DocVerifyStatus`/`WizardDocItem`/`pickSingleDocument`/`uploadAndVerify`/`updateNotes` reused from the prior identity feature. `useThemeColor('--brand-foreground')` flagged to hoist in Task 6. ✓

**Known limitation (documented):** verified state is not pushed live — it appears after refetch (mount / after mutations / Refresh status), matching web.
