# Conversation Details Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Conversation Details screen (web `InboxContactSidebar` parity) reachable from an Info button in the conversation header, for both WhatsApp and Messenger.

**Architecture:** New route `app/(app)/chat/details.tsx` renders `ConversationDetailsScreen`, a scroll of section cards (Profile, Contact, Lead, Labels, Notes, Shared media). Data via new TanStack Query hooks over new axios services (chat labels, conversation-assign, lead-note update/delete). Sub-flows (`LeadPickerSheet`, `LabelAssignSheet`, `ManageLabelsSheet`, media viewer) use `@gorhom/bottom-sheet` / modals.

**Tech Stack:** Expo Router (typed routes), React 19 / RN 0.81, NativeWind v4, TanStack Query, axios (`src/lib/api.ts`), `@gorhom/bottom-sheet`, Lucide icons.

## Global Constraints

- Package manager **pnpm**. Commands: `pnpm lint`, `pnpm exec tsc --noEmit`.
- No test runner — verification is `pnpm exec tsc --noEmit` + `pnpm lint` + manual QA (repo convention).
- Strict TypeScript; prop types use `Readonly<{...}>`.
- Styling: NativeWind semantic tokens only (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-destructive`, `bg-primary`); merge with `cn()` from `@/lib/utils`. No `dark:`-only ad-hoc hex except fixed brand/priority literals noted below.
- Icons: Lucide via `<Icon name="..." />` atom only. No emoji. **The `Icon` atom has NO `className` prop** — it accepts `name`, `size`, `color` (a resolved theme string, e.g. `useThemeColor('--muted-foreground')`), `fill`, `strokeWidth`. Never pass `className` to `<Icon>`; for a tinted icon pass `color={useThemeColor('--muted-foreground')}` (or `'--destructive'`, `'--info'`). For icon margins, wrap the `<Icon>` in a `<View>`.
- Touch targets ≥ 44pt (use `hitSlop`); confirm destructive actions; light + dark parity.
- API base paths are prefixed `/api/v1` (axios `apiClient` has no baseURL prefix beyond host).
- Fixed literals: WhatsApp badge `#25D366`, Messenger badge `#0084FF`; priority hues hot `#dc2626`, warm `#d97706`, cold `#0284c7`. Label preset colors: `#3b82f6 #ef4444 #22c55e #f59e0b #06b6d4 #8b5cf6 #14b8a6 #f97316 #a855f7 #1e293b`.
- Commit after each task. Branch already created: `feat/conversation-details-screen`.

---

## File Structure

```
app/(app)/chat/details.tsx                                   (new route)
src/features/chat/api/labels.ts                              (new: label + assign services)
src/features/chat/models/label.ts                            (new: ChatLabel types)
src/features/chat/hooks/use-chat-labels.ts                   (new)
src/features/chat/hooks/use-assign-conversation.ts           (new)
src/features/chat/hooks/use-conversation-media.ts            (new)
src/features/chat/components/ConversationHeader.tsx          (modify: Info button + props)
src/features/chat/components/ConversationScreen.tsx          (modify: pass props)
src/features/chat/components/details/
  ConversationDetailsScreen.tsx                              (new)
  ProfileCard.tsx  ContactDetailsCard.tsx  LeadCard.tsx
  LabelsCard.tsx  LabelAssignSheet.tsx  ManageLabelsSheet.tsx  LabelColorPicker.tsx
  NotesCard.tsx  SharedMediaCard.tsx  SharedMediaViewer.tsx
  LeadPickerSheet.tsx  persona-labels.ts
src/features/leads/services.ts                               (modify: update/deleteLeadNote)
src/features/leads/hooks/use-lead-notes.ts                   (modify: update/delete hooks)
src/features/leads/components/CreateLeadScreen.tsx           (modify: optional prefill)
```

---

## Task 1: Lead-note update/delete services + hooks

**Files:**

- Modify: `src/features/leads/services.ts` (append after `createLeadNote`, ~line 183)
- Modify: `src/features/leads/hooks/use-lead-notes.ts`

**Interfaces:**

- Produces: `updateLeadNote(leadId, noteId, content): Promise<LeadNote>`, `deleteLeadNote(leadId, noteId): Promise<void>`; hooks `useUpdateLeadNote(leadId)`, `useDeleteLeadNote(leadId)` (mutation vars `{ noteId, content }` / `{ noteId }`).

- [ ] **Step 1: Add services**

In `src/features/leads/services.ts`, directly after the `createLeadNote` function add:

```ts
export async function updateLeadNote(
  leadId: string,
  noteId: string,
  content: string,
): Promise<LeadNote> {
  const { data } = await apiClient.patch<LeadNote>(`/api/v1/leads/${leadId}/notes/${noteId}`, {
    content,
  });
  return data;
}

export async function deleteLeadNote(leadId: string, noteId: string): Promise<void> {
  await apiClient.delete(`/api/v1/leads/${leadId}/notes/${noteId}`);
}
```

Ensure `LeadNote` is imported in `services.ts` (it already imports from `./types`; add `LeadNote` to that import if missing).

- [ ] **Step 2: Add hooks**

In `src/features/leads/hooks/use-lead-notes.ts`, extend the imports and append two hooks:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLeadNote, deleteLeadNote, getLeadNotes, updateLeadNote } from '../services';

// ... existing useLeadNotes and useCreateLeadNote unchanged ...

export function useUpdateLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string; content: string }) =>
      updateLeadNote(leadId, vars.noteId, vars.content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useDeleteLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string }) => deleteLeadNote(leadId, vars.noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/leads/services.ts src/features/leads/hooks/use-lead-notes.ts
git commit -m "feat(leads): add update/delete lead-note services and hooks"
```

---

## Task 2: Chat-label + assign services, types, hooks

**Files:**

- Create: `src/features/chat/models/label.ts`
- Create: `src/features/chat/api/labels.ts`
- Create: `src/features/chat/hooks/use-chat-labels.ts`
- Create: `src/features/chat/hooks/use-assign-conversation.ts`
- Modify: `src/features/chat/hooks/keys.ts` (add label keys)

**Interfaces:**

- Produces:
  - `ChatLabel { id, name, color, sortOrder }`, `SaveLabelItem { id?, name, color }`
  - services `getChatLabels()`, `saveChatLabels(labels: SaveLabelItem[])`, `getConversationLabels(id)`, `setConversationLabels(id, labelIds)`, `assignConversationToLead(channel, conversationId, leadId)`
  - hooks `useChatLabels()`, `useSaveChatLabels()`, `useConversationLabels(id)`, `useSetConversationLabels(id)`, `useAssignConversationToLead(conversationId)`

- [ ] **Step 1: Types**

Create `src/features/chat/models/label.ts`:

```ts
export interface ChatLabel {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

/** One row in the bulk-save payload. New labels omit `id`. */
export interface SaveLabelItem {
  id?: string;
  name: string;
  color: string;
}
```

- [ ] **Step 2: Services**

Create `src/features/chat/api/labels.ts`:

```ts
import { apiClient } from '@/lib/api';

import type { ChatLabel, SaveLabelItem } from '../models/label';

interface Wrapped<T> {
  data?: T;
}

/** Backend wraps most responses as `{ data }`; unwrap defensively. */
function unwrap<T>(payload: Wrapped<T> | T): T {
  return payload && typeof payload === 'object' && 'data' in (payload as Wrapped<T>)
    ? ((payload as Wrapped<T>).data as T)
    : (payload as T);
}

export async function getChatLabels(): Promise<ChatLabel[]> {
  const { data } = await apiClient.get<Wrapped<ChatLabel[]> | ChatLabel[]>('/api/v1/chat-labels');
  return unwrap(data) ?? [];
}

export async function saveChatLabels(labels: SaveLabelItem[]): Promise<ChatLabel[]> {
  const { data } = await apiClient.put<Wrapped<ChatLabel[]> | ChatLabel[]>('/api/v1/chat-labels', {
    labels,
  });
  return unwrap(data) ?? [];
}

export async function getConversationLabels(conversationId: string): Promise<ChatLabel[]> {
  const { data } = await apiClient.get<Wrapped<ChatLabel[]> | ChatLabel[]>(
    `/api/v1/chat-labels/conversations/${conversationId}`,
  );
  return unwrap(data) ?? [];
}

export async function setConversationLabels(
  conversationId: string,
  labelIds: string[],
): Promise<ChatLabel[]> {
  const { data } = await apiClient.put<Wrapped<ChatLabel[]> | ChatLabel[]>(
    `/api/v1/chat-labels/conversations/${conversationId}`,
    { labelIds },
  );
  return unwrap(data) ?? [];
}

/** Assign a Messenger/WhatsApp conversation to a lead (channel-specific route). */
export async function assignConversationToLead(
  channel: string,
  conversationId: string,
  leadId: string,
): Promise<void> {
  const seg = channel === 'messenger' ? 'messenger' : 'whatsapp';
  await apiClient.patch(`/api/v1/chat/${seg}/conversations/${conversationId}/assign-lead`, {
    leadId,
  });
}
```

- [ ] **Step 3: Query keys**

In `src/features/chat/hooks/keys.ts`, add inside the `chatKeys` object (before the closing brace):

```ts
  chatLabels: () => [...chatKeys.all, 'labels'] as const,
  conversationLabels: (conversationId: string) =>
    [...chatKeys.all, 'conversation-labels', conversationId] as const,
```

- [ ] **Step 4: Label hooks**

Create `src/features/chat/hooks/use-chat-labels.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getChatLabels,
  getConversationLabels,
  saveChatLabels,
  setConversationLabels,
} from '../api/labels';
import type { SaveLabelItem } from '../models/label';
import { chatKeys } from './keys';

export function useChatLabels() {
  return useQuery({
    queryKey: chatKeys.chatLabels(),
    queryFn: getChatLabels,
    staleTime: 60_000,
  });
}

export function useSaveChatLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labels: SaveLabelItem[]) => saveChatLabels(labels),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.chatLabels() });
      // A rename/recolor/delete changes chips on any conversation.
      qc.invalidateQueries({ queryKey: [...chatKeys.all, 'conversation-labels'] });
    },
  });
}

export function useConversationLabels(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.conversationLabels(conversationId),
    queryFn: () => getConversationLabels(conversationId),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

export function useSetConversationLabels(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelIds: string[]) => setConversationLabels(conversationId, labelIds),
    onSuccess: (labels) => {
      qc.setQueryData(chatKeys.conversationLabels(conversationId), labels);
    },
  });
}
```

- [ ] **Step 5: Assign hook**

Create `src/features/chat/hooks/use-assign-conversation.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { assignConversationToLead } from '../api/labels';
import { chatKeys } from './keys';

export function useAssignConversationToLead(conversationId: string, channel: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => assignConversationToLead(channel, conversationId, leadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
```

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/models/label.ts src/features/chat/api/labels.ts src/features/chat/hooks/use-chat-labels.ts src/features/chat/hooks/use-assign-conversation.ts src/features/chat/hooks/keys.ts
git commit -m "feat(chat): add chat-label and conversation-assign services and hooks"
```

---

## Task 3: Header Info button + route + screen shell (Profile + Contact)

Delivers a navigable details screen showing profile + contact details. Later tasks add sections into the same screen.

**Files:**

- Modify: `src/features/chat/components/ConversationHeader.tsx`
- Modify: `src/features/chat/components/ConversationScreen.tsx`
- Create: `app/(app)/chat/details.tsx`
- Create: `src/features/chat/components/details/ConversationDetailsScreen.tsx`
- Create: `src/features/chat/components/details/ProfileCard.tsx`
- Create: `src/features/chat/components/details/ContactDetailsCard.tsx`

**Interfaces:**

- Consumes: `useConversation` (Task uses raw `getConversation` instead), `ApiConversation` (`customerPhone`, `customerEmail`, `customerName`, `leadId`, `channel`), `getConversation` from `../api/services`, `chatKeys.conversation`.
- Produces: route `/chat/details` with params `{ conversationId, channel, leadId? }`; `ConversationDetailsScreen` component; `ProfileCard`, `ContactDetailsCard`.

- [ ] **Step 1: Header — add Info button + props**

In `src/features/chat/components/ConversationHeader.tsx`:

1. Extend `HeaderIconButton`'s `icon` union to include `'Info'`:

```ts
icon: 'ArrowLeft' | 'Phone' | 'Info';
```

2. Extend `Props`:

```ts
interface Props {
  name: string;
  subtitle: string;
  leadId?: string;
  phone?: string;
  /** Conversation id — opens the details screen. */
  conversationId: string;
  /** Channel string ('whatsapp' | 'messenger' | ...). */
  channel: string;
}
```

3. Update the function signature and add an `openDetails` handler + render the Info button before the Phone button:

```tsx
export function ConversationHeader({
  name,
  subtitle,
  leadId,
  phone,
  conversationId,
  channel,
}: Readonly<Props>) {
  // ...existing hooks/handlers unchanged...
  const openDetails = (): void => {
    router.push({
      pathname: '/chat/details',
      params: { conversationId, channel, leadId: leadId ?? '' },
    });
  };
```

Then in the JSX, replace the trailing Phone-button block with an Info button followed by the Phone button:

```tsx
<View className="flex-row items-center">
  <HeaderIconButton icon="Info" label="Conversation details" onPress={openDetails} />
  {hasPhone ? <HeaderIconButton icon="Phone" label={`Call ${name}`} onPress={placeCall} /> : null}
</View>
```

Add `View` to the existing `react-native` import (already imported). Keep the name/subtitle `Pressable` (→ `openLead`) exactly as is.

- [ ] **Step 2: ConversationScreen — pass new props**

In `src/features/chat/components/ConversationScreen.tsx`, the header render (line ~135) becomes:

```tsx
<ConversationHeader
  name={contact.name}
  subtitle={subtitle}
  leadId={leadId}
  phone={phone}
  conversationId={conversationId}
  channel={isMessenger ? 'messenger' : 'whatsapp'}
/>
```

(`conversationId` is a prop of `ConversationScreen`; `isMessenger` is already destructured from `useConversation`.)

- [ ] **Step 3: Route file**

Create `app/(app)/chat/details.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';

import { ConversationDetailsScreen } from '@/features/chat/components/details/ConversationDetailsScreen';

export default function ConversationDetailsRoute() {
  const { conversationId, channel, leadId } = useLocalSearchParams<{
    conversationId: string;
    channel: string;
    leadId?: string;
  }>();
  return (
    <ConversationDetailsScreen
      conversationId={conversationId}
      channel={channel}
      leadId={leadId && leadId !== '' ? leadId : undefined}
    />
  );
}
```

- [ ] **Step 4: ProfileCard**

Create `src/features/chat/components/details/ProfileCard.tsx`:

```tsx
import { View } from 'react-native';

import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  messenger: { label: 'Messenger', color: '#0084FF' },
};

export function ProfileCard({ name, channel }: Readonly<{ name: string; channel: string }>) {
  const meta = CHANNEL_META[channel];
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View className="relative">
        <Avatar alt={name} className="h-14 w-14">
          <AvatarFallback>
            <Text className="text-lg font-semibold">{initials(name)}</Text>
          </AvatarFallback>
        </Avatar>
        {meta ? (
          <View
            className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-background"
            style={{ backgroundColor: meta.color }}
          />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-bold" numberOfLines={1}>
          {name || 'Unknown contact'}
        </Text>
        {meta ? <Text className="text-sm text-muted-foreground">{meta.label}</Text> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: ContactDetailsCard**

Create `src/features/chat/components/details/ContactDetailsCard.tsx`:

```tsx
import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

function DetailRow({
  icon,
  label,
  value,
}: Readonly<{ icon: 'Phone' | 'Mail'; label: string; value: string }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">
        <Icon name={icon} size={16} color={mutedFg} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Text>
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function ContactDetailsCard({
  phone,
  email,
}: Readonly<{ phone?: string | null; email?: string | null }>) {
  const hasPhone = !!phone;
  const hasEmail = !!email;
  return (
    <View className="gap-3 px-4 py-3">
      <Text className="text-base font-semibold">Contact details</Text>
      {hasPhone ? <DetailRow icon="Phone" label="Phone" value={phone as string} /> : null}
      {hasEmail ? <DetailRow icon="Mail" label="Email" value={email as string} /> : null}
      {!hasPhone && !hasEmail ? (
        <Text className="text-sm text-muted-foreground">No contact details available</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 6: ConversationDetailsScreen shell**

Create `src/features/chat/components/details/ConversationDetailsScreen.tsx`:

```tsx
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/molecules/Card';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { getConversation } from '../../api/services';
import { chatKeys } from '../../hooks/keys';
import { ContactDetailsCard } from './ContactDetailsCard';
import { ProfileCard } from './ProfileCard';

const NAVY_GRADIENT = ['#0B1220', '#101827', '#1F2A44'] as const;

interface Props {
  conversationId: string;
  channel: string;
  leadId?: string;
}

export function ConversationDetailsScreen({ conversationId, channel, leadId }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');

  const convQuery = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });
  const conv = convQuery.data;
  const name = conv?.customerName ?? 'Unknown contact';

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={NAVY_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center px-3 pb-4 pt-1">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
          >
            <Icon name="ArrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="ml-1 text-base font-bold text-white">Details</Text>
        </View>
      </LinearGradient>

      {convQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
        >
          <Card>
            <ProfileCard name={name} channel={channel} />
          </Card>
          <Card>
            <ContactDetailsCard phone={conv?.customerPhone} email={conv?.customerEmail} />
          </Card>
          {/* Lead, Labels, Notes, Shared media cards added in later tasks */}
        </ScrollView>
      )}
    </View>
  );
}
```

- [ ] **Step 7: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` supports `name="Info"` and `name="Mail"` (Lucide keys `Info`, `Mail` exist). If the Icon atom type rejects them, no change needed — the atom passes the key through to `lucide-react-native/icons`.

- [ ] **Step 8: Manual QA**

Open a WhatsApp and a Messenger conversation → tap the Info button → details screen shows profile + contact + back works. Tapping the name still opens the lead. Test light + dark.

- [ ] **Step 9: Commit**

```bash
git add src/features/chat/components/ConversationHeader.tsx src/features/chat/components/ConversationScreen.tsx "app/(app)/chat/details.tsx" src/features/chat/components/details/
git commit -m "feat(chat): add conversation details screen shell with header Info button"
```

---

## Task 4: LeadCard + persona labels + LeadPickerSheet + create-lead prefill

**Files:**

- Create: `src/features/chat/components/details/persona-labels.ts`
- Create: `src/features/chat/components/details/LeadCard.tsx`
- Create: `src/features/chat/components/details/LeadPickerSheet.tsx`
- Modify: `src/features/chat/components/details/ConversationDetailsScreen.tsx` (mount LeadCard)
- Modify: `src/features/leads/components/CreateLeadScreen.tsx` (optional prefill)

**Interfaces:**

- Consumes: `useLeadDetail(leadId)` → `LeadDetail` (`name`, `email`, `interest`, `status`, `priority`, `assignee?{firstName,lastName}`, `isAssigned`); `useAssignConversationToLead(conversationId, channel)`; `getLeads`; `useDebouncedValue`.
- Produces: `LeadCard` component; `LeadPickerSheet` (imperative `open()`); `PERSONA_LABELS`.

- [ ] **Step 1: Persona labels**

Create `src/features/chat/components/details/persona-labels.ts`:

```ts
import { Persona } from '@/features/leads/constants/lead-enums';

export const PERSONA_LABELS: Record<string, string> = {
  [Persona.LANDLORD]: 'Landlord',
  [Persona.BUYER]: 'Buyer',
  [Persona.SELLER]: 'Seller',
  [Persona.TENANT]: 'Tenant',
  [Persona.PODCAST_GUEST]: 'Podcast Guest',
};

export function priorityHex(priority?: string | null): string | null {
  switch ((priority ?? '').toLowerCase()) {
    case 'hot':
      return '#dc2626';
    case 'warm':
      return '#d97706';
    case 'cold':
      return '#0284c7';
    default:
      return null;
  }
}
```

- [ ] **Step 2: LeadPickerSheet**

Create `src/features/chat/components/details/LeadPickerSheet.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';

import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { getLeads } from '@/features/leads/services';
import type { LeadListItem } from '@/features/leads/types';
import { useThemeColor } from '@theme';

export interface LeadPickerSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  onPick: (leadId: string) => void;
}

export const LeadPickerSheet = forwardRef<LeadPickerSheetHandle, Props>(function LeadPickerSheet(
  { onPick }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const background = useThemeColor('--background');
  const handle = useThemeColor('--muted-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const snapPoints = useMemo(() => ['80%'], []);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  const { data, isFetching } = useQuery({
    queryKey: ['lead-picker', debounced],
    queryFn: () =>
      getLeads({
        search: debounced.trim() === '' ? undefined : debounced.trim(),
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
  });
  const leads: LeadListItem[] = data?.items ?? [];

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: handle }}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text className="mb-2 text-base font-semibold">Assign to a lead</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email or phone"
          placeholderTextColor={mutedFg}
          style={{
            height: 44,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 10,
            paddingHorizontal: 12,
            color: foreground,
          }}
        />
      </BottomSheetView>
      <BottomSheetFlatList
        data={leads}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 8 }}
        ListEmptyComponent={
          isFetching ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={foreground} />
          ) : (
            <Text className="mt-6 text-center text-sm text-muted-foreground">No leads found</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onPick(item.id);
              sheetRef.current?.close();
            }}
            className="rounded-lg px-3 py-3 active:bg-muted-foreground/10"
          >
            <Text className="text-sm font-medium" numberOfLines={1}>
              {item.name ?? item.email ?? 'Unnamed lead'}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {item.phone && item.phone !== '' ? item.phone : (item.email ?? '')}
            </Text>
          </Pressable>
        )}
      />
    </BottomSheet>
  );
});
```

- [ ] **Step 3: LeadCard**

Create `src/features/chat/components/details/LeadCard.tsx`:

```tsx
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useLeadDetail } from '@/features/leads/hooks/use-lead-detail';
import { useThemeColor } from '@theme';

import { useAssignConversationToLead } from '../../hooks/use-assign-conversation';
import { LeadPickerSheet, type LeadPickerSheetHandle } from './LeadPickerSheet';
import { PERSONA_LABELS, priorityHex } from './persona-labels';

interface Props {
  conversationId: string;
  channel: string;
  leadId?: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
}

function Chip({ label, tint }: Readonly<{ label: string; tint?: string | null }>) {
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: tint ? `${tint}1A` : 'rgba(120,120,120,0.15)' }}
    >
      <Text className="text-xs font-medium capitalize" style={tint ? { color: tint } : undefined}>
        {label}
      </Text>
    </View>
  );
}

export function LeadCard({
  conversationId,
  channel,
  leadId,
  contactName,
  phone,
  email,
}: Readonly<Props>) {
  const pickerRef = useRef<LeadPickerSheetHandle>(null);
  const mutedFg = useThemeColor('--muted-foreground');
  const hasLead = !!leadId;
  const { data: lead, isFetching } = useLeadDetail(hasLead ? leadId : undefined);
  const assign = useAssignConversationToLead(conversationId, channel);

  const openCreate = (): void => {
    router.push({
      pathname: '/leads/create',
      params: { name: contactName, phone: phone ?? '', email: email ?? '' },
    });
  };

  return (
    <View className="gap-3 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">Lead</Text>
        <View className="flex-row items-center gap-2">
          {hasLead ? (
            <Pressable
              onPress={() => pickerRef.current?.open()}
              hitSlop={8}
              className="flex-row items-center gap-1 rounded-full border border-border px-2.5 py-1 active:opacity-70"
            >
              <Icon name="RefreshCw" size={12} color={mutedFg} />
              <Text className="text-xs font-medium text-muted-foreground">Reassign</Text>
            </Pressable>
          ) : null}
          <Badge variant={hasLead ? 'successSoft' : 'mutedSoft'}>
            <Text>{hasLead ? 'Assigned' : 'Unassigned'}</Text>
          </Badge>
        </View>
      </View>

      {hasLead ? (
        isFetching && !lead ? (
          <Text className="text-sm text-muted-foreground">Loading lead…</Text>
        ) : !lead ? (
          <Text className="text-sm text-muted-foreground">Lead details unavailable</Text>
        ) : (
          <View className="gap-2.5">
            <View>
              <Text className="text-xs uppercase tracking-wide text-muted-foreground">Name</Text>
              <Text className="text-sm font-medium">{lead.name || lead.email}</Text>
            </View>
            {lead.interest ? (
              <View>
                <Text className="text-xs uppercase tracking-wide text-muted-foreground">
                  Persona
                </Text>
                <Text className="text-sm font-medium">
                  {PERSONA_LABELS[String(lead.interest)] ?? String(lead.interest)}
                </Text>
              </View>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              <Chip label={String(lead.status).replace(/_/g, ' ').toLowerCase()} />
              {lead.priority ? (
                <Chip label={String(lead.priority)} tint={priorityHex(lead.priority)} />
              ) : null}
            </View>
            {lead.assignee ? (
              <View className="flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/15">
                  <Text className="text-xs font-semibold">
                    {`${lead.assignee.firstName.charAt(0)}${lead.assignee.lastName.charAt(0)}`.toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs uppercase tracking-wide text-muted-foreground">
                    Assigned agent
                  </Text>
                  <Text className="text-sm font-medium">
                    {lead.assignee.firstName} {lead.assignee.lastName}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      ) : (
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">
            This conversation isn&apos;t linked to a Lead/Owner yet.
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => pickerRef.current?.open()}
              className="flex-1 items-center rounded-lg border border-border py-2.5 active:opacity-70"
            >
              <Text className="text-sm font-medium">Assign to Lead</Text>
            </Pressable>
            <Pressable
              onPress={openCreate}
              className="flex-1 items-center rounded-lg bg-primary py-2.5 active:opacity-80"
            >
              <Text className="text-sm font-medium text-primary-foreground">Create Lead</Text>
            </Pressable>
          </View>
        </View>
      )}

      <LeadPickerSheet ref={pickerRef} onPick={(id) => assign.mutate(id)} />
    </View>
  );
}
```

- [ ] **Step 4: Mount LeadCard**

In `ConversationDetailsScreen.tsx`, import `LeadCard` and add, after the Contact `Card`, inside the `ScrollView`:

```tsx
<Card>
  <LeadCard
    conversationId={conversationId}
    channel={channel}
    leadId={leadId}
    contactName={name}
    phone={conv?.customerPhone}
    email={conv?.customerEmail}
  />
</Card>
```

- [ ] **Step 5: Create-lead prefill (optional, additive)**

In `src/features/leads/components/CreateLeadScreen.tsx`, read optional params and seed the form defaults. At the top of the component:

```tsx
import { useLocalSearchParams } from 'expo-router';
// ...
const { name, phone, email } = useLocalSearchParams<{
  name?: string;
  phone?: string;
  email?: string;
}>();
```

Then pass these into the existing `useAppForm`/`create-lead.form` default values (merge over `CREATE_LEAD_DEFAULTS`), e.g. where the form is created:

```tsx
const form = useCreateLeadForm({
  ...CREATE_LEAD_DEFAULTS,
  ...(name ? { name } : {}),
  ...(phone ? { phone } : {}),
  ...(email ? { email } : {}),
});
```

Adapt to the actual factory signature in the file. If `CreateLeadScreen` does not accept override defaults, add an optional `defaults?: Partial<CreateLeadValues>` param to the form factory in `src/features/leads/forms/create-lead.form.ts` and spread it over `CREATE_LEAD_DEFAULTS`. Keep behavior identical when no params are passed.

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` accepts `name="RefreshCw"`.

- [ ] **Step 7: Manual QA**

Linked conversation: lead block shows name/persona/status/priority/assignee; Reassign opens picker, search + tap reassigns and the block refreshes. Unlinked: Assign opens picker; Create Lead opens the create form prefilled with name/phone/email.

- [ ] **Step 8: Commit**

```bash
git add src/features/chat/components/details/ src/features/leads/components/CreateLeadScreen.tsx src/features/leads/forms/create-lead.form.ts
git commit -m "feat(chat): lead block with reassign/create in conversation details"
```

---

## Task 5: LabelsCard + LabelAssignSheet

**Files:**

- Create: `src/features/chat/components/details/LabelsCard.tsx`
- Create: `src/features/chat/components/details/LabelAssignSheet.tsx`
- Modify: `ConversationDetailsScreen.tsx` (mount LabelsCard)

**Interfaces:**

- Consumes: `useChatLabels`, `useConversationLabels`, `useSetConversationLabels`, `PERMISSIONS.CHAT_WRITE`, `useRequirePermission`.
- Produces: `LabelsCard`; `LabelAssignSheet` (imperative `open()`, prop `onManage`).

- [ ] **Step 1: LabelAssignSheet**

Create `src/features/chat/components/details/LabelAssignSheet.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  useChatLabels,
  useConversationLabels,
  useSetConversationLabels,
} from '../../hooks/use-chat-labels';

export interface LabelAssignSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  conversationId: string;
  onManage: () => void;
}

export const LabelAssignSheet = forwardRef<LabelAssignSheetHandle, Props>(function LabelAssignSheet(
  { conversationId, onManage }: Readonly<Props>,
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const background = useThemeColor('--background');
  const handle = useThemeColor('--muted-foreground');
  const info = useThemeColor('--info');
  const snapPoints = useMemo(() => ['60%'], []);

  const { data: all = [] } = useChatLabels();
  const { data: assigned = [] } = useConversationLabels(conversationId);
  const setLabels = useSetConversationLabels(conversationId);
  const assignedIds = new Set(assigned.map((l) => l.id));

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  const toggle = (id: string): void => {
    const next = assignedIds.has(id)
      ? assigned.filter((l) => l.id !== id).map((l) => l.id)
      : [...assigned.map((l) => l.id), id];
    setLabels.mutate(next);
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: handle }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-semibold">Labels</Text>
          <Pressable onPress={onManage} hitSlop={8} className="active:opacity-70">
            <Text className="text-sm font-medium" style={{ color: info }}>
              Manage
            </Text>
          </Pressable>
        </View>
        {all.length === 0 ? (
          <Text className="py-4 text-center text-sm text-muted-foreground">
            No labels yet. Tap Manage to create some.
          </Text>
        ) : (
          all.map((label) => {
            const on = assignedIds.has(label.id);
            return (
              <Pressable
                key={label.id}
                onPress={() => toggle(label.id)}
                className="flex-row items-center gap-2 rounded-lg px-2 py-3 active:bg-muted-foreground/10"
              >
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                <Text className="flex-1 text-sm">{label.name}</Text>
                {on ? <Icon name="Check" size={18} color={info} /> : null}
              </Pressable>
            );
          })
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
```

- [ ] **Step 2: LabelsCard**

Create `src/features/chat/components/details/LabelsCard.tsx`:

```tsx
import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';
import { useThemeColor } from '@theme';

import { useConversationLabels } from '../../hooks/use-chat-labels';
import { LabelAssignSheet, type LabelAssignSheetHandle } from './LabelAssignSheet';
import { ManageLabelsSheet, type ManageLabelsSheetHandle } from './ManageLabelsSheet';

export function LabelsCard({ conversationId }: Readonly<{ conversationId: string }>) {
  const assignRef = useRef<LabelAssignSheetHandle>(null);
  const manageRef = useRef<ManageLabelsSheetHandle>(null);
  const mutedFg = useThemeColor('--muted-foreground');
  const canEdit = useRequirePermission(PERMISSIONS.CHAT_WRITE) === 'allowed';
  const { data: assigned = [] } = useConversationLabels(conversationId);

  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">Labels</Text>
        {canEdit ? (
          <Pressable
            onPress={() => manageRef.current?.open()}
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-full border border-border px-2.5 py-1 active:opacity-70"
          >
            <Icon name="Settings2" size={12} color={mutedFg} />
            <Text className="text-xs font-medium text-muted-foreground">Manage</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {assigned.map((label) => (
          <View
            key={label.id}
            className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/15 px-2.5 py-1"
          >
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
            <Text className="text-xs font-medium">{label.name}</Text>
          </View>
        ))}
        {assigned.length === 0 && !canEdit ? (
          <Text className="text-sm text-muted-foreground">No labels</Text>
        ) : null}
        {canEdit ? (
          <Pressable
            onPress={() => assignRef.current?.open()}
            className="flex-row items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 active:opacity-70"
          >
            <Icon name="Plus" size={12} color={mutedFg} />
            <Text className="text-xs font-medium text-muted-foreground">Add label</Text>
          </Pressable>
        ) : null}
      </View>

      {canEdit ? (
        <>
          <LabelAssignSheet
            ref={assignRef}
            conversationId={conversationId}
            onManage={() => {
              assignRef.current?.close();
              manageRef.current?.open();
            }}
          />
          <ManageLabelsSheet ref={manageRef} />
        </>
      ) : null}
    </View>
  );
}
```

> Note: `ManageLabelsSheet` is created in Task 6. Until then, comment out the `ManageLabelsSheet` import + usage and the `manageRef` wiring, OR implement Task 6 immediately after. To keep each task independently green, add a temporary stub file (Step 3) now.

- [ ] **Step 3: Temporary ManageLabelsSheet stub**

Create `src/features/chat/components/details/ManageLabelsSheet.tsx` with a minimal stub (replaced in Task 6):

```tsx
import { forwardRef, useImperativeHandle } from 'react';

export interface ManageLabelsSheetHandle {
  open: () => void;
  close: () => void;
}

export const ManageLabelsSheet = forwardRef<ManageLabelsSheetHandle, Record<string, never>>(
  function ManageLabelsSheet(_props, ref) {
    useImperativeHandle(ref, () => ({ open: () => {}, close: () => {} }), []);
    return null;
  },
);
```

- [ ] **Step 4: Mount LabelsCard**

In `ConversationDetailsScreen.tsx`, after the Lead `Card`:

```tsx
<Card>
  <LabelsCard conversationId={conversationId} />
</Card>
```

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` accepts `Settings2`, `Plus`, `Check`.

- [ ] **Step 6: Manual QA**

Labels card shows assigned chips + Add + Manage (Manage is a no-op stub for now). Add opens the assign sheet; toggling a label updates chips immediately. Read-only user (no `chat:read_write_conversations`) sees chips only.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/components/details/
git commit -m "feat(chat): labels card with assign sheet in conversation details"
```

---

## Task 6: ManageLabelsSheet + LabelColorPicker (full parity)

Replaces the Task 5 stub with create/rename/recolor/reorder/delete.

**Files:**

- Replace: `src/features/chat/components/details/ManageLabelsSheet.tsx`
- Create: `src/features/chat/components/details/LabelColorPicker.tsx`

**Interfaces:**

- Consumes: `useChatLabels`, `useSaveChatLabels`, `SaveLabelItem`, label preset colors.
- Produces: `ManageLabelsSheet` (imperative `open()`); `LabelColorPicker` (props `color`, `onChange`, `usedColors`).

- [ ] **Step 1: Preset colors constant**

Add to `src/features/chat/models/label.ts`:

```ts
export const LABEL_PRESET_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#a855f7',
  '#1e293b',
] as const;
```

- [ ] **Step 2: LabelColorPicker**

Create `src/features/chat/components/details/LabelColorPicker.tsx`. Preset swatch grid + free hex input in a small modal; taken colors disabled.

```tsx
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { LABEL_PRESET_COLORS } from '../../models/label';
import { useThemeColor } from '@theme';

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string {
  const v = value.trim();
  return (v.startsWith('#') ? v : `#${v}`).toUpperCase();
}

export function LabelColorPicker({
  color,
  onChange,
  usedColors = [],
}: Readonly<{ color: string; onChange: (c: string) => void; usedColors?: string[] }>) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color);
  const background = useThemeColor('--background');
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));

  const commit = (next: string): void => {
    if (!usedSet.has(next.toLowerCase())) onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setHex(color);
          setOpen(true);
        }}
        accessibilityLabel="Pick colour"
        style={{
          height: 28,
          width: 28,
          borderRadius: 6,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: border,
        }}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: background, borderRadius: 16, padding: 16, gap: 12 }}
          >
            <Text className="text-base font-semibold">Label colour</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {LABEL_PRESET_COLORS.map((preset) => {
                const selected = preset.toLowerCase() === color.toLowerCase();
                const taken = usedSet.has(preset.toLowerCase()) && !selected;
                return (
                  <Pressable
                    key={preset}
                    disabled={taken}
                    onPress={() => commit(preset)}
                    accessibilityLabel={taken ? `${preset} (used)` : preset}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 16,
                      backgroundColor: preset,
                      borderWidth: selected ? 3 : 0,
                      borderColor: foreground,
                      opacity: taken ? 0.3 : 1,
                    }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={hex}
                onChangeText={setHex}
                autoCapitalize="characters"
                placeholder="#ED5F11"
                placeholderTextColor={border}
                style={{
                  flex: 1,
                  height: 40,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  color: foreground,
                }}
              />
              <Pressable
                onPress={() => {
                  const norm = normalizeHex(hex);
                  commit(HEX_RE.test(norm) ? norm : color);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text className="text-sm font-medium">OK</Text>
              </Pressable>
            </View>
            {usedColors.length > 0 ? (
              <Text className="text-xs text-muted-foreground">
                Greyed-out colours are used by other labels.
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: ManageLabelsSheet (reorder via up/down controls)**

Reorder is implemented with explicit up/down buttons per row (no drag lib, no new dependency — keeps parity on the operation while staying reliable on touch). Replace `src/features/chat/components/details/ManageLabelsSheet.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { LABEL_PRESET_COLORS } from '../../models/label';
import { useChatLabels, useSaveChatLabels } from '../../hooks/use-chat-labels';
import { LabelColorPicker } from './LabelColorPicker';

export interface ManageLabelsSheetHandle {
  open: () => void;
  close: () => void;
}

interface DraftLabel {
  localId: string;
  serverId?: string;
  name: string;
  color: string;
}

let tempCounter = 0;
function nextTempId(): string {
  tempCounter += 1;
  return `new-${tempCounter}`;
}

export const ManageLabelsSheet = forwardRef<ManageLabelsSheetHandle, Record<string, never>>(
  function ManageLabelsSheet(_props, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const background = useThemeColor('--background');
    const handle = useThemeColor('--muted-foreground');
    const mutedFg = useThemeColor('--muted-foreground');
    const foreground = useThemeColor('--foreground');
    const border = useThemeColor('--border');
    const snapPoints = useMemo(() => ['85%'], []);

    const { data: labels = [] } = useChatLabels();
    const save = useSaveChatLabels();
    const [rows, setRows] = useState<DraftLabel[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          // Seed from the latest server labels each open.
          setRows(
            labels.map((l) => ({ localId: l.id, serverId: l.id, name: l.name, color: l.color })),
          );
          sheetRef.current?.expand();
        },
        close: () => sheetRef.current?.close(),
      }),
      [labels],
    );

    const update = (localId: string, patch: Partial<DraftLabel>): void =>
      setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));

    const move = (index: number, dir: -1 | 1): void =>
      setRows((prev) => {
        const next = [...prev];
        const target = index + dir;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });

    const addRow = (): void =>
      setRows((prev) => {
        const used = new Set(prev.map((r) => r.color.toLowerCase()));
        const free = LABEL_PRESET_COLORS.find((c) => !used.has(c.toLowerCase()));
        return [
          ...prev,
          { localId: nextTempId(), name: '', color: free ?? LABEL_PRESET_COLORS[0] },
        ];
      });

    const removeRow = (localId: string): void =>
      setRows((prev) => prev.filter((r) => r.localId !== localId));

    const onSave = (): void => {
      const named = rows.filter((r) => r.name.trim() !== '');
      const colors = named.map((r) => r.color.toLowerCase());
      if (new Set(colors).size !== colors.length) {
        Alert.alert('Duplicate colour', 'Each label must have a unique colour.');
        return;
      }
      save.mutate(
        named.map((r) => ({
          ...(r.serverId ? { id: r.serverId } : {}),
          name: r.name.trim(),
          color: r.color,
        })),
        { onSuccess: () => sheetRef.current?.close() },
      );
    };

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: background }}
        handleIndicatorStyle={{ backgroundColor: handle }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          <Text className="mb-1 text-base font-semibold">Manage labels</Text>
          {rows.map((row, index) => (
            <View
              key={row.localId}
              className="flex-row items-center gap-2 rounded-lg border border-border p-2"
            >
              <View>
                <Pressable onPress={() => move(index, -1)} hitSlop={6} accessibilityLabel="Move up">
                  <Icon name="ChevronUp" size={16} color={mutedFg} />
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  hitSlop={6}
                  accessibilityLabel="Move down"
                >
                  <Icon name="ChevronDown" size={16} color={mutedFg} />
                </Pressable>
              </View>
              <LabelColorPicker
                color={row.color}
                onChange={(c) => update(row.localId, { color: c })}
                usedColors={rows.filter((r) => r.localId !== row.localId).map((r) => r.color)}
              />
              <TextInput
                value={row.name}
                onChangeText={(v) => update(row.localId, { name: v })}
                placeholder="Label name"
                placeholderTextColor={border}
                style={{ flex: 1, height: 40, paddingHorizontal: 8, color: foreground }}
              />
              <Pressable
                onPress={() => removeRow(row.localId)}
                hitSlop={8}
                accessibilityLabel="Remove label"
              >
                <Icon name="X" size={16} color={mutedFg} />
              </Pressable>
            </View>
          ))}
          {rows.length === 0 ? (
            <Text className="py-2 text-center text-sm text-muted-foreground">
              No labels yet. Add your first below.
            </Text>
          ) : null}
          <Pressable
            onPress={addRow}
            className="flex-row items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 active:opacity-70"
          >
            <Icon name="Plus" size={16} color={mutedFg} />
            <Text className="text-sm text-muted-foreground">Add</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={save.isPending}
            className="mt-2 items-center rounded-lg bg-primary py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              {save.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);
```

> Design note: the spec called for drag-to-reorder. This plan uses up/down controls to avoid a new dependency and gesture conflicts inside a bottom sheet, while preserving the reorder capability and its persisted `sortOrder` (server derives order from array position on `PUT /chat-labels`). If true drag is required, swap this row list for `react-native-draggable-flatlist` in a follow-up.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` accepts `ChevronUp`, `ChevronDown`, `X`.

- [ ] **Step 5: Manual QA**

Manage sheet: add/rename/recolor (preset + hex)/reorder (up/down)/delete; duplicate-colour save is blocked with an alert; Save persists and the assign sheet + chips reflect changes. Test light + dark.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/components/details/ManageLabelsSheet.tsx src/features/chat/components/details/LabelColorPicker.tsx src/features/chat/models/label.ts
git commit -m "feat(chat): full manage-labels sheet with color picker and reorder"
```

---

## Task 7: NotesCard

**Files:**

- Create: `src/features/chat/components/details/NotesCard.tsx`
- Modify: `ConversationDetailsScreen.tsx` (mount NotesCard when `leadId` present)

**Interfaces:**

- Consumes: `useLeadNotes`, `useCreateLeadNote`, `useUpdateLeadNote`, `useDeleteLeadNote`, `LeadNote`, `PERMISSIONS.LEADS_UPDATE`.
- Produces: `NotesCard`.

- [ ] **Step 1: NotesCard**

Create `src/features/chat/components/details/NotesCard.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import {
  useCreateLeadNote,
  useDeleteLeadNote,
  useLeadNotes,
  useUpdateLeadNote,
} from '@/features/leads/hooks/use-lead-notes';
import type { LeadNote } from '@/features/leads/types';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';
import { useThemeColor } from '@theme';

function NoteRow({
  leadId,
  note,
  canEdit,
}: Readonly<{ leadId: string; note: LeadNote; canEdit: boolean }>) {
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const mutedFg = useThemeColor('--muted-foreground');
  const destructive = useThemeColor('--destructive');
  const update = useUpdateLeadNote(leadId);
  const del = useDeleteLeadNote(leadId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);

  const onDelete = (): void =>
    Alert.alert('Delete note', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate({ noteId: note.id }) },
    ]);

  return (
    <View className="rounded-lg border border-border bg-background p-2.5">
      {editing ? (
        <View className="gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            style={{
              minHeight: 60,
              color: foreground,
              borderWidth: 1,
              borderColor: border,
              borderRadius: 8,
              padding: 8,
            }}
          />
          <View className="flex-row justify-end gap-2">
            <Pressable
              onPress={() => {
                setDraft(note.content);
                setEditing(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-sm">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const content = draft.trim();
                if (content === '' || content === note.content.trim()) return;
                update.mutate({ noteId: note.id, content }, { onSuccess: () => setEditing(false) });
              }}
              className="rounded-lg bg-primary px-3 py-1.5 active:opacity-80"
            >
              <Text className="text-sm text-primary-foreground">Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text className="text-sm">{note.content}</Text>
          <View className="mt-1.5 flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">{note.author?.name ?? ''}</Text>
            {canEdit && note.canModify !== false ? (
              <View className="flex-row gap-1">
                <Pressable
                  onPress={() => {
                    setDraft(note.content);
                    setEditing(true);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Edit note"
                  className="h-8 w-8 items-center justify-center rounded-md active:bg-muted-foreground/10"
                >
                  <Icon name="Pencil" size={14} color={mutedFg} />
                </Pressable>
                <Pressable
                  onPress={onDelete}
                  hitSlop={8}
                  accessibilityLabel="Delete note"
                  className="h-8 w-8 items-center justify-center rounded-md active:bg-muted-foreground/10"
                >
                  <Icon name="Trash2" size={14} color={destructive} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

export function NotesCard({ leadId }: Readonly<{ leadId: string }>) {
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const canEdit = useRequirePermission(PERMISSIONS.LEADS_UPDATE) === 'allowed';
  const { data: notes = [], isLoading } = useLeadNotes(leadId);
  const create = useCreateLeadNote(leadId);
  const [draft, setDraft] = useState('');

  return (
    <View className="gap-2.5 px-4 py-3">
      <Text className="text-base font-semibold">Notes</Text>
      {canEdit ? (
        <View className="gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Write a note about this contact…"
            placeholderTextColor={border}
            style={{
              minHeight: 60,
              color: foreground,
              borderWidth: 1,
              borderColor: border,
              borderRadius: 8,
              padding: 8,
            }}
          />
          <Pressable
            onPress={() => {
              const content = draft.trim();
              if (content === '') return;
              create.mutate(content, { onSuccess: () => setDraft('') });
            }}
            disabled={draft.trim() === '' || create.isPending}
            className="self-end rounded-lg bg-primary px-4 py-2 active:opacity-80"
            style={{ opacity: draft.trim() === '' ? 0.5 : 1 }}
          >
            <Text className="text-sm font-medium text-primary-foreground">Add Note</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <Text className="text-sm text-muted-foreground">Loading notes…</Text>
      ) : notes.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No notes yet.</Text>
      ) : (
        <View className="gap-1.5">
          {notes.map((note) => (
            <NoteRow key={note.id} leadId={leadId} note={note} canEdit={canEdit} />
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Mount NotesCard**

In `ConversationDetailsScreen.tsx`, after the Labels `Card`:

```tsx
{
  leadId ? (
    <Card>
      <NotesCard leadId={leadId} />
    </Card>
  ) : (
    <Card>
      <View className="gap-2 px-4 py-3">
        <Text className="text-base font-semibold">Notes</Text>
        <Text className="text-sm text-muted-foreground">
          Link this conversation to a Lead to add notes.
        </Text>
      </View>
    </Card>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` accepts `Pencil`, `Trash2`.

- [ ] **Step 4: Manual QA**

Linked conversation: add a note, edit it, delete it (with confirm); unlinked conversation shows the link-to-lead hint. Read-only user sees list only, no composer/edit/delete.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/components/details/NotesCard.tsx src/features/chat/components/details/ConversationDetailsScreen.tsx
git commit -m "feat(chat): notes card with CRUD in conversation details"
```

---

## Task 8: SharedMediaCard + SharedMediaViewer

**Files:**

- Create: `src/features/chat/hooks/use-conversation-media.ts`
- Create: `src/features/chat/components/details/SharedMediaCard.tsx`
- Create: `src/features/chat/components/details/SharedMediaViewer.tsx`
- Modify: `ConversationDetailsScreen.tsx` (mount SharedMediaCard)

**Interfaces:**

- Consumes: `getMessages`, `toMessages`, `chatKeys.messages`, `Message` (`media?: { kind, url }`, `text`), `useMediaUrl`.
- Produces: `useConversationMedia(conversationId)` → `Message[]`; `SharedMediaCard`; `SharedMediaViewer`.

- [ ] **Step 1: Media hook**

Create `src/features/chat/hooks/use-conversation-media.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getMessages } from '../api/services';
import { toMessages } from '../api/transforms';
import type { Message } from '../models/message';
import { chatKeys } from './keys';

/** All messages (unfiltered) for the shared-media grid. Shares the chat cache. */
export function useConversationMedia(conversationId: string) {
  return useQuery<Message[]>({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async () => toMessages(await getMessages(conversationId)),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: SharedMediaViewer**

Create `src/features/chat/components/details/SharedMediaViewer.tsx`:

```tsx
import { Image, Modal, Pressable, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { Icon } from '@/components/atoms/Icon';

export function SharedMediaViewer({
  url,
  isVideo,
  onClose,
}: Readonly<{ url: string | null; isVideo: boolean; onClose: () => void }>) {
  const player = useVideoPlayer(isVideo && url ? url : '', (p) => {
    if (isVideo && url) p.play();
  });
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          isVideo ? (
            <VideoView
              player={player}
              style={{ width: '90%', height: '70%' }}
              contentFit="contain"
              nativeControls
            />
          ) : (
            <Image
              source={{ uri: url }}
              style={{ width: '90%', height: '70%' }}
              resizeMode="contain"
            />
          )
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: 48,
            right: 20,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 20,
            padding: 8,
          }}
        >
          <Icon name="X" size={22} color="#FFFFFF" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

> Confirm `expo-video` is installed (used elsewhere in chat media). If the project uses `expo-av` instead, swap `VideoView`/`useVideoPlayer` for `<Video>` from `expo-av`. Check `MediaMessage.tsx`/`AudioMessage.tsx` for the pattern already in use and match it.

- [ ] **Step 3: SharedMediaCard**

Create `src/features/chat/components/details/SharedMediaCard.tsx`:

```tsx
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useConversationMedia } from '../../hooks/use-conversation-media';
import { useMediaUrl } from '../../hooks/use-media-url';
import type { Message } from '../../models/message';
import { SharedMediaViewer } from './SharedMediaViewer';

const INITIAL_LIMIT = 12;

function Thumb({
  message,
  onOpen,
}: Readonly<{ message: Message; onOpen: (url: string, isVideo: boolean) => void }>) {
  const isVideo = message.media?.kind === 'video';
  const known = message.media?.url;
  const { data } = useMediaUrl(message.id, !known);
  const url = known ?? data;
  if (!url) {
    return <View className="aspect-square flex-1 rounded-lg bg-muted-foreground/15" />;
  }
  return (
    <Pressable
      onPress={() => onOpen(url, isVideo)}
      className="aspect-square flex-1 overflow-hidden rounded-lg bg-muted-foreground/15"
      accessibilityLabel={isVideo ? 'Play video' : 'View image'}
    >
      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {isVideo ? (
        <View className="absolute inset-0 items-center justify-center">
          <Icon name="PlayCircle" size={32} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

function DocRow({ message }: Readonly<{ message: Message }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-muted-foreground/15 px-2.5 py-2">
      <Icon name="FileText" size={16} color={mutedFg} />
      <Text className="flex-1 text-sm" numberOfLines={1}>
        {message.media?.name ?? message.text ?? 'Document'}
      </Text>
    </View>
  );
}

export function SharedMediaCard({ conversationId }: Readonly<{ conversationId: string }>) {
  const { data: messages = [] } = useConversationMedia(conversationId);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; isVideo: boolean } | null>(null);

  const grid = messages.filter((m) => m.media?.kind === 'image' || m.media?.kind === 'video');
  const docs = messages.filter((m) => m.media?.kind === 'document');
  const total = grid.length + docs.length;
  const visibleGrid = showAll ? grid : grid.slice(0, INITIAL_LIMIT);
  const docsBudget = Math.max(0, INITIAL_LIMIT - visibleGrid.length);
  const visibleDocs = showAll ? docs : docs.slice(0, docsBudget);
  const hasMore = total > visibleGrid.length + visibleDocs.length;

  // Chunk the grid into rows of 3 for a simple 3-col layout.
  const rows: Message[][] = [];
  for (let i = 0; i < visibleGrid.length; i += 3) rows.push(visibleGrid.slice(i, i + 3));

  return (
    <View className="gap-3 px-4 py-3">
      <Text className="text-base font-semibold">Shared media</Text>
      {total === 0 ? (
        <Text className="text-sm text-muted-foreground">No shared media yet.</Text>
      ) : (
        <View className="gap-3">
          {rows.map((row, i) => (
            <View key={i} className="flex-row gap-1.5">
              {row.map((m) => (
                <Thumb
                  key={m.id}
                  message={m}
                  onOpen={(url, isVideo) => setViewer({ url, isVideo })}
                />
              ))}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }).map((_, k) => (
                    <View key={`sp-${k}`} className="flex-1" />
                  ))
                : null}
            </View>
          ))}
          {visibleDocs.map((m) => (
            <DocRow key={m.id} message={m} />
          ))}
          {hasMore ? (
            <Pressable onPress={() => setShowAll(true)} className="self-start active:opacity-70">
              <Text className="text-sm font-medium text-info">Show all ({total})</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <SharedMediaViewer
        url={viewer?.url ?? null}
        isVideo={viewer?.isVideo ?? false}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}
```

- [ ] **Step 4: Mount SharedMediaCard**

In `ConversationDetailsScreen.tsx`, after the Notes `Card`:

```tsx
<Card>
  <SharedMediaCard conversationId={conversationId} />
</Card>
```

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit` then `pnpm lint`
Expected: no new errors. Confirm `Icon` accepts `PlayCircle`, `FileText`, `X`, and the video component import matches the installed lib.

- [ ] **Step 6: Manual QA**

Open a conversation with images/videos/docs: grid renders 3-col, tapping an image/video opens the fullscreen viewer (video plays, close works), docs list under the grid, "Show all" reveals the rest. Messenger media (no up-front URL) resolves lazily. Empty conversation shows the empty state.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/hooks/use-conversation-media.ts src/features/chat/components/details/SharedMediaCard.tsx src/features/chat/components/details/SharedMediaViewer.tsx src/features/chat/components/details/ConversationDetailsScreen.tsx
git commit -m "feat(chat): shared media grid and viewer in conversation details"
```

---

## Task 9: Final polish + full QA pass

**Files:** none new — verification + small fixes only.

- [ ] **Step 1: Full typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 2: End-to-end manual QA matrix**

Test each on a **WhatsApp** and a **Messenger** conversation, **linked** and **unlinked** lead, in **light** and **dark**:

- Header Info button opens details; name/avatar still opens lead detail; back returns.
- Profile badge color matches channel; contact rows / empty fallback correct.
- Lead block: chips, assignee, Reassign (search + assign refreshes), Assign + Create (prefill) when unlinked.
- Labels: add/remove toggles chips; Manage create/rename/recolor(preset+hex)/reorder/delete; duplicate-colour blocked.
- Notes: add/edit/delete with confirm; unlinked hint; read-only hides composer.
- Shared media: grid, viewer (image + video), docs, Show all, lazy Messenger URLs, empty state.
- Safe areas honored; no content under the notch/home indicator; touch targets comfortable.

- [ ] **Step 3: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix(chat): conversation details QA polish"
```

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to open a PR or merge.

---

## Self-Review Notes

- **Spec coverage:** entry/nav (T3), shell (T3), Profile/Contact (T3), Lead + reassign/create (T4), Labels assign (T5), Labels manage full (T6), Notes (T7), Shared media + viewer (T8), data layer (T1/T2), permissions (T5 CHAT_WRITE, T7 LEADS_UPDATE), UX constraints (Global Constraints + per-task QA). All covered.
- **Deviation from spec:** label reorder uses up/down controls instead of drag (no new dep, reliable in a sheet) — flagged in T6 note; server order still derived from array position. Color picker is preset grid + hex input (no HSV wheel) per spec.
- **Type consistency:** `ChatLabel`/`SaveLabelItem` (T2) used in T5/T6; `useAssignConversationToLead(conversationId, channel)` signature consistent T2→T4; `LeadNote` fields (`author.name`, `canModify`) match mobile `types.ts`; `Message.media.{kind,url}` used consistently in T8.
- **Open verifications folded into steps:** Icon key availability (each task's verify step), `expo-video` vs `expo-av` (T8 Step 2 note), create-lead form factory shape (T4 Step 5).

```

```
