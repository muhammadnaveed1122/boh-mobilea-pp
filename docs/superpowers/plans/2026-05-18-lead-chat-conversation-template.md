# Lead → In-App Conversation + WhatsApp Template Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lead chat icon open the lead's conversation in-app — existing thread if it has messages, otherwise a WhatsApp template picker that bootstraps one — and ensure email send works in that conversation.

**Architecture:** A dedicated resolver route `/chat/lead/[leadId]` reuses the existing `ConversationScreen`. It resolves the lead's WhatsApp conversation via the backend `by-lead` endpoint and branches: existing conversation → `ConversationScreen`; no messages → `TemplatePicker` → send template → re-resolve → `ConversationScreen`. Email needs no new UI: `useConversation` already enables it from `conversation.leadId`.

**Tech Stack:** TypeScript, React Native (Expo Router, typed routes), TanStack Query, NativeWind, axios (`apiClient`).

**Project convention:** No test runner in `boh-mobile`. Per-task verification is `pnpm exec tsc --noEmit` + `pnpm lint` (+ manual QA on integration tasks). No test files.

---

## File Structure

**Create:**

- `src/features/chat/hooks/use-lead-conversation.ts` — query the lead's WhatsApp conversation.
- `src/features/chat/hooks/use-whatsapp-templates.ts` — query approved WhatsApp templates.
- `src/features/chat/hooks/use-send-template.ts` — mutation to send a template + invalidate.
- `src/features/chat/components/TemplatePicker.tsx` — template list + select + send.
- `src/features/chat/components/LeadConversationGate.tsx` — resolve + branch orchestrator.
- `app/(app)/chat/lead/[leadId].tsx` — RBAC-gated resolver route.

**Modify:**

- `src/features/chat/api/types.ts` — add `ApiWhatsappTemplate`, `SendTemplateInput`.
- `src/features/chat/api/services.ts` — add `getConversationByLead`, `getWhatsappTemplates`, `sendWhatsappTemplate`.
- `src/features/chat/hooks/keys.ts` — add `conversationByLead`, `whatsappTemplates`.
- `src/features/chat/index.ts` — export `LeadConversationGate`.
- `src/features/leads/components/LeadCard.tsx` — rewire chat button, drop `whatsApp()`/`Linking`.
- `src/features/leads/components/lead-detail/HeroHeaderCard.tsx` — rewire chat button, drop `openWhatsApp()`/`Linking`.

---

### Task 1: API types, services, query keys

**Files:**

- Modify: `src/features/chat/api/types.ts`
- Modify: `src/features/chat/api/services.ts`
- Modify: `src/features/chat/hooks/keys.ts`

- [ ] **Step 1: Add types to `src/features/chat/api/types.ts`**

Append at the end of the file (after `extractRows`):

```ts
/** A WhatsApp template row from `GET /chat/whatsapp/templates`. */
export interface ApiWhatsappTemplate {
  id: string;
  name: string;
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  category?: string | null;
  body?: string | null;
  headerType?: string | null;
  headerText?: string | null;
  footer?: string | null;
  placeholdersCount?: number | null;
}

/** Body for `POST /chat/whatsapp/messages/template`. */
export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  parameters?: string[];
}
```

- [ ] **Step 2: Add service functions to `src/features/chat/api/services.ts`**

Change the top imports:

```ts
import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api';

import {
  type ApiConversation,
  type ApiMessage,
  type ApiWhatsappTemplate,
  extractRows,
  type SendMessageInput,
  type SendTemplateInput,
} from './types';
```

Append at the end of the file:

```ts
export async function getConversationByLead(
  leadId: string,
  channel = 'whatsapp',
): Promise<ApiConversation | null> {
  try {
    const { data } = await apiClient.get<ApiConversation | null>(
      `${BASE}/conversations/by-lead/${leadId}`,
      { params: { channel } },
    );
    return data ?? null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function getWhatsappTemplates(): Promise<ApiWhatsappTemplate[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/whatsapp/templates`);
  return extractRows<ApiWhatsappTemplate>(data);
}

export async function sendWhatsappTemplate(input: SendTemplateInput): Promise<void> {
  await apiClient.post(`${BASE}/whatsapp/messages/template`, input);
}
```

- [ ] **Step 3: Add query keys to `src/features/chat/hooks/keys.ts`**

Replace the whole file with:

```ts
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  conversationByLead: (leadId: string) =>
    [...chatKeys.all, 'conversation-by-lead', leadId] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
  mediaUrl: (id: string) => [...chatKeys.all, 'media-url', id] as const,
  whatsappTemplates: () => [...chatKeys.all, 'whatsapp-templates'] as const,
};
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/api/types.ts src/features/chat/api/services.ts src/features/chat/hooks/keys.ts
git commit -m "feat(chat): by-lead conversation + whatsapp template api

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Data hooks

**Files:**

- Create: `src/features/chat/hooks/use-lead-conversation.ts`
- Create: `src/features/chat/hooks/use-whatsapp-templates.ts`
- Create: `src/features/chat/hooks/use-send-template.ts`

- [ ] **Step 1: Create `src/features/chat/hooks/use-lead-conversation.ts`**

```ts
import { useQuery } from '@tanstack/react-query';

import { getConversationByLead } from '../api/services';
import { chatKeys } from './keys';

/** Resolves the lead's WhatsApp conversation (or null if none yet). */
export function useLeadConversation(leadId: string) {
  return useQuery({
    queryKey: chatKeys.conversationByLead(leadId),
    queryFn: () => getConversationByLead(leadId, 'whatsapp'),
    enabled: !!leadId,
  });
}
```

- [ ] **Step 2: Create `src/features/chat/hooks/use-whatsapp-templates.ts`**

```ts
import { useQuery } from '@tanstack/react-query';

import { getWhatsappTemplates } from '../api/services';
import type { ApiWhatsappTemplate } from '../api/types';
import { chatKeys } from './keys';

/** Lists WhatsApp templates. Caller filters by `status`. */
export function useWhatsappTemplates() {
  return useQuery<ApiWhatsappTemplate[]>({
    queryKey: chatKeys.whatsappTemplates(),
    queryFn: getWhatsappTemplates,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Create `src/features/chat/hooks/use-send-template.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendWhatsappTemplate } from '../api/services';
import type { SendTemplateInput } from '../api/types';
import { chatKeys } from './keys';

/** Sends a WhatsApp template, then re-resolves the lead's conversation. */
export function useSendTemplate(leadId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, SendTemplateInput>({
    mutationFn: sendWhatsappTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversationByLead(leadId) }).catch(() => {});
      qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
    },
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/hooks/use-lead-conversation.ts src/features/chat/hooks/use-whatsapp-templates.ts src/features/chat/hooks/use-send-template.ts
git commit -m "feat(chat): lead conversation + template hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: TemplatePicker component

**Files:**

- Create: `src/features/chat/components/TemplatePicker.tsx`

- [ ] **Step 1: Create `src/features/chat/components/TemplatePicker.tsx`**

```tsx
/**
 * TemplatePicker — shown when a lead has no WhatsApp messages yet. Lists
 * approved templates; selecting one sends it to the lead's number. v1 supports
 * templates with 0 or 1 placeholder (the single placeholder is auto-filled with
 * the lead name); templates with more are listed but disabled.
 */

import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import type { ApiWhatsappTemplate } from '../api/types';
import { useSendTemplate } from '../hooks/use-send-template';
import { useWhatsappTemplates } from '../hooks/use-whatsapp-templates';

interface TemplatePickerProps {
  leadId: string;
  leadName: string;
  phone: string;
}

function placeholderCount(t: ApiWhatsappTemplate): number {
  return t.placeholdersCount ?? 0;
}

export function TemplatePicker({ leadId, leadName, phone }: Readonly<TemplatePickerProps>) {
  const canWrite = useCan(PERMISSIONS.CHAT_WRITE);
  const { data, isLoading, isError, refetch } = useWhatsappTemplates();
  const sendMutation = useSendTemplate(leadId);

  const templates = useMemo(() => (data ?? []).filter((t) => t.status === 'APPROVED'), [data]);

  if (!canWrite) {
    return (
      <EmptyState
        icon="Lock"
        title="No send permission"
        description="You don't have permission to start a WhatsApp conversation with this lead."
      />
    );
  }

  if (!phone) {
    return (
      <EmptyState
        icon="Phone"
        title="No phone number"
        description="This lead has no phone number to start a WhatsApp conversation."
      />
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState icon="CircleAlert" title="Couldn't load templates" />
        <Pressable
          onPress={() => {
            refetch().catch(() => {});
          }}
          accessibilityRole="button"
          className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon="Inbox"
        title="No approved templates"
        description="Ask an admin to create and approve a WhatsApp template."
      />
    );
  }

  const onSelect = (t: ApiWhatsappTemplate) => {
    const count = placeholderCount(t);
    if (count > 1) return;
    sendMutation.mutate(
      {
        to: phone,
        templateName: t.name,
        languageCode: t.language,
        parameters: count === 1 ? [leadName] : [],
      },
      {
        onError: () => {
          Alert.alert('Send failed', 'Could not send the template. Please try again.');
        },
      },
    );
  };

  return (
    <View className="flex-1">
      <View className="px-4 pb-2 pt-4">
        <Text variant="subheading">Start the conversation</Text>
        <Text variant="muted">Pick a WhatsApp template to send to {leadName}.</Text>
      </View>
      <ScrollView contentContainerClassName="gap-2 p-4" showsVerticalScrollIndicator={false}>
        {templates.map((t) => {
          const disabled = placeholderCount(t) > 1 || sendMutation.isPending;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t)}
              disabled={disabled}
              accessibilityRole="button"
              className="rounded-2xl bg-card p-4 active:opacity-80"
              style={{ opacity: disabled ? 0.5 : 1 }}
            >
              <Text className="text-sm font-semibold text-foreground">{t.name}</Text>
              {t.body ? (
                <Text variant="muted" numberOfLines={3} className="mt-1">
                  {t.body}
                </Text>
              ) : null}
              {placeholderCount(t) > 1 ? (
                <Text variant="error" className="mt-1 text-xs">
                  Needs more info — not supported yet
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {sendMutation.isPending ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If `useCan` is reported missing, confirm it is exported from `src/lib/rbac/index.ts` (it is: `export { useCan, useCanAll }`).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/TemplatePicker.tsx
git commit -m "feat(chat): whatsapp template picker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: LeadConversationGate + barrel export

**Files:**

- Create: `src/features/chat/components/LeadConversationGate.tsx`
- Modify: `src/features/chat/index.ts`

- [ ] **Step 1: Create `src/features/chat/components/LeadConversationGate.tsx`**

```tsx
/**
 * LeadConversationGate — resolves a lead's WhatsApp conversation and branches:
 * an existing conversation with messages renders the normal ConversationScreen;
 * otherwise the TemplatePicker bootstraps one. After a template send the
 * by-lead query is invalidated, this re-resolves, and ConversationScreen mounts.
 */

import { ActivityIndicator, Pressable, View } from 'react-native';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';

import { useLeadConversation } from '../hooks/use-lead-conversation';
import { ConversationScreen } from './ConversationScreen';
import { TemplatePicker } from './TemplatePicker';

interface LeadConversationGateProps {
  leadId: string;
  leadName: string;
  phone: string;
}

export function LeadConversationGate({
  leadId,
  leadName,
  phone,
}: Readonly<LeadConversationGateProps>) {
  const { data: conv, isLoading, isError, refetch } = useLeadConversation(leadId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <EmptyState icon="CircleAlert" title="Couldn't load conversation" />
        <Pressable
          onPress={() => {
            refetch().catch(() => {});
          }}
          accessibilityRole="button"
          className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (conv && conv.latestMessage) {
    return <ConversationScreen conversationId={conv.id} />;
  }

  return (
    <View className="flex-1 bg-background">
      <TemplatePicker leadId={leadId} leadName={leadName} phone={phone} />
    </View>
  );
}
```

- [ ] **Step 2: Export it from `src/features/chat/index.ts`**

Add this line after the existing `ConversationScreen` export:

```ts
export { LeadConversationGate } from './components/LeadConversationGate';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/components/LeadConversationGate.tsx src/features/chat/index.ts
git commit -m "feat(chat): lead conversation resolver gate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Resolver route

**Files:**

- Create: `app/(app)/chat/lead/[leadId].tsx`

- [ ] **Step 1: Create `app/(app)/chat/lead/[leadId].tsx`**

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

import { LeadConversationGate } from '@/features/chat';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function LeadConversationRoute() {
  const { leadId, phone, name } = useLocalSearchParams<{
    leadId: string;
    phone?: string;
    name?: string;
  }>();
  const state = useRequirePermission(PERMISSIONS.CHAT_READ);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return (
    <LeadConversationGate leadId={leadId} leadName={name ?? 'this lead'} phone={phone ?? ''} />
  );
}
```

- [ ] **Step 2: Typecheck (regenerates typed routes)**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. The new route makes `'/chat/lead/[leadId]'` a valid typed pathname (used in Tasks 6 and 7). If Expo's route types are stale, run `pnpm start --clear` once to regenerate `.expo/types`, then re-run tsc.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/chat/lead/[leadId].tsx"
git commit -m "feat(chat): /chat/lead/[leadId] resolver route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Rewire LeadCard chat button

**Files:**

- Modify: `src/features/leads/components/LeadCard.tsx`

- [ ] **Step 1: Remove the `whatsApp` helper**

Delete this function from `src/features/leads/components/LeadCard.tsx`:

```ts
function whatsApp(phone: string | null | undefined): void {
  if (!phone) return;
  const digits = phone.replace(/[^\d]/g, '');
  Linking.openURL(`whatsapp://send?phone=${digits}`).catch(() => {});
}
```

- [ ] **Step 2: Drop the now-unused `Linking` import**

Change:

```ts
import { Linking, Pressable, View } from 'react-native';
```

to:

```ts
import { Pressable, View } from 'react-native';
```

- [ ] **Step 3: Rewire the chat (MessageCircle) Pressable**

Replace:

```tsx
<Pressable
  onPress={() => whatsApp(lead.phone)}
  disabled={!lead.phone}
  accessibilityLabel="WhatsApp lead"
  className="h-9 w-9 items-center justify-center rounded-xl bg-success/15 active:opacity-70"
>
  <Icon name="MessageCircle" size={16} color={success} />
</Pressable>
```

with:

```tsx
<Pressable
  onPress={() =>
    router.push({
      pathname: '/chat/lead/[leadId]',
      params: { leadId: lead.id, phone: lead.phone ?? '', name },
    })
  }
  disabled={!lead.phone}
  accessibilityLabel="Open lead conversation"
  className="h-9 w-9 items-center justify-center rounded-xl bg-success/15 active:opacity-70"
>
  <Icon name="MessageCircle" size={16} color={success} />
</Pressable>
```

(`router` is already imported from `expo-router`; `name` is the existing
`const name = leadDisplayName(lead)` in the component.)

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: no errors (no unused `Linking`/`whatsApp`).

- [ ] **Step 6: Commit**

```bash
git add src/features/leads/components/LeadCard.tsx
git commit -m "feat(leads): lead card chat button opens in-app conversation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Rewire HeroHeaderCard chat button

**Files:**

- Modify: `src/features/leads/components/lead-detail/HeroHeaderCard.tsx`

- [ ] **Step 1: Remove the `openWhatsApp` helper**

Delete this function from `src/features/leads/components/lead-detail/HeroHeaderCard.tsx`:

```ts
function openWhatsApp(phone: string | null | undefined): void {
  if (!phone) return;
  const digits = phone.replace(/[^\d]/g, '');
  Linking.openURL(`whatsapp://send?phone=${digits}`).catch(() => {});
}
```

- [ ] **Step 2: Drop `Linking`, add the router import**

Change:

```ts
import { Linking, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
```

to:

```ts
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
```

- [ ] **Step 3: Rewire the WhatsApp ActionButton**

Replace:

```tsx
<ActionButton
  iconName="MessageCircle"
  iconColor={WHATSAPP_ICON_COLOR}
  label="WhatsApp lead"
  disabled={!hasPhone}
  onPress={() => openWhatsApp(lead.phone)}
/>
```

with:

```tsx
<ActionButton
  iconName="MessageCircle"
  iconColor={WHATSAPP_ICON_COLOR}
  label="Open lead conversation"
  disabled={!hasPhone}
  onPress={() =>
    router.push({
      pathname: '/chat/lead/[leadId]',
      params: { leadId: lead.id, phone: lead.phone ?? '', name: lead.name },
    })
  }
/>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: no errors (no unused `Linking`/`openWhatsApp`).

- [ ] **Step 6: Commit**

```bash
git add src/features/leads/components/lead-detail/HeroHeaderCard.tsx
git commit -m "feat(leads): hero header chat button opens in-app conversation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Integration QA (email verification + flows)

No code unless QA finds a defect. This task confirms the end-to-end behavior,
especially that email is enabled in the resolved conversation.

- [ ] **Step 1: Start the app**

Run: `pnpm start` (then open iOS simulator or device).

- [ ] **Step 2: QA — existing conversation**

On a lead that already has WhatsApp messages, tap the chat (MessageCircle)
button on both the lead list card and the lead detail hero header.
Expected: the existing conversation thread opens in-app (no WhatsApp app
deep-link).

- [ ] **Step 3: QA — email enabled in resolved conversation**

In that opened conversation, open the Composer channel toggle.
Expected: the **Email** option is enabled (because the by-lead conversation
carries `leadId`, so `useConversation` sets `emailEnabled = true`). Send a test
email; it appears in the thread.
If Email is disabled here, the by-lead conversation lacks `leadId` — record this
as a backend follow-up (out of scope for this frontend plan) and continue.

- [ ] **Step 4: QA — template bootstrap**

On a lead with no messages, tap the chat button.
Expected: `TemplatePicker` shows approved templates. Pick a 0- or 1-placeholder
template; after send, the screen transitions into the conversation thread with
the sent template message visible. Templates with >1 placeholder are visibly
disabled.

- [ ] **Step 5: QA — edge cases**

- Lead with no phone: chat button is disabled (cannot tap).
- User without `chat:write`: picker shows the "No send permission" state.
- Template send failure (e.g. airplane mode): an alert appears and the picker
  stays.

- [ ] **Step 6: Final typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: both clean.

- [ ] **Step 7: Commit (only if QA required code fixes)**

```bash
git add -A
git commit -m "fix(chat): address lead conversation QA findings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Chat button → in-app conversation: Tasks 6, 7 (entry points) + Task 5 (route) + Task 4 (gate). ✓
- Existing conversation opens: Task 4 (`conv.latestMessage` branch → `ConversationScreen`). ✓
- No messages → template picker → send to lead WhatsApp number: Tasks 2, 3 + gate branch. ✓
- Auto-fill lead name, 0/1 placeholder only, >1 disabled: Task 3 `onSelect` + disabled logic. ✓
- Email send on conversation screen: no UI work needed; `emailEnabled` from `conv.leadId` is verified in Task 8 Step 3. ✓
- Backend already implemented (no backend tasks): respected. ✓
- Edge cases (no phone, no permission, send fail, no templates, by-lead null): Task 3 guards + Task 8 Step 5. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code; commands have expected output. ✓

**Type consistency:** `ApiWhatsappTemplate`/`SendTemplateInput` defined in Task 1, consumed unchanged in Tasks 2–3. `getConversationByLead`/`getWhatsappTemplates`/`sendWhatsappTemplate` signatures match between Tasks 1 and 2. `chatKeys.conversationByLead`/`whatsappTemplates` defined in Task 1, used in Task 2. `LeadConversationGate` prop shape `{ leadId, leadName, phone }` consistent across Tasks 4, 5. Route pathname `'/chat/lead/[leadId]'` + params `{ leadId, phone, name }` consistent across Tasks 5, 6, 7. ✓

**Adaptation note:** Backend guards template send with `chat:create`, but `boh-mobile` `PERMISSIONS` exposes `chat:read`/`chat:write`/`chat:admin` only. The picker gates on `PERMISSIONS.CHAT_WRITE` as the client-side proxy; the backend remains the source of truth and will reject unauthorized sends regardless.

**No-test-runner adaptation:** Per project convention (no test runner in `boh-mobile`), TDD test steps are replaced with `tsc --noEmit` + `pnpm lint` + manual QA, per task. This follows the user-level instruction which takes precedence over the skill's default TDD steps.
