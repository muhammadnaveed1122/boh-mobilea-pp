# Create-Listing Wizard — Media & Documents Step (Step 3)

**Date:** 2026-07-01
**Repo:** `boh-mobile`
**Depends on:** [`2026-07-01-create-listing-wizard-description-step-design.md`](./2026-07-01-create-listing-wizard-description-step-design.md)

## Goal

Add the wizard's third step — **Media & Documents** — at web parity, in mobile manner.
Captures the listing's hero media (images + videos), the two About images, video/360 links,
and (secondary only) supporting owner documents. Persists them to the listing content record.

**Scope (agreed):** Hero gallery (full: images+videos, alt text, hero-pick, remove, reorder),
About images (×2 + alt), Video & 360 links, Documents (secondary: multi-file + notes).
**Deferred to a later feature:** Identity Verification (EMIRATES_ID upload + link/manual-review).

## Web reference

- UI: `MediaDocumentsStep` — four sections: Images (hero media library), About Images (2
  single-image uploaders), Video & Virtual Tour (2 link inputs), Documents (secondary only:
  supporting multi-file + Identity Verification + Notes). We build all but Identity.
- Persistence: `saveMediaStep` → `saveAllSections` (re-upserts hero + about with files) +
  `uploadStepDocuments` (supporting files → `POST /opportunities/:id/documents`).

## Current mobile state (after step 2)

- Wizard is 2 steps (Information → Description). `CreateListingWizard` holds `stepIndex` (0|1)
  and `created: WizardCreated | null` (`{ branch, leadId?, opportunityId?, listingId? }`).
- Description step has an isolated form (title + description) and saves hero title+description
  via `use-save-content`. Media/document/about services do NOT exist yet.
- Mobile deps present: `expo-image-picker`, `expo-document-picker`, `expo-file-system`.
- Proven RN multipart pattern exists in `src/features/chat/api/services.ts` +
  `src/features/chat/media/pick-media.ts` (append `{ uri, name, type }` file objects to FormData).
- `WizardStepper` already lists 4 steps and takes `activeIndex`.

## Architecture

### Shared wizard content state (fixes hero-clobber)

The hero section upsert replaces the whole hero JSON. If the Media step upserts hero-with-media
without the Description step's title/description, it wipes them. Fix: lift a shared content
object into `CreateListingWizard`:

```ts
interface WizardContent {
  title: string;
  description: string;
  heroMedia: WizardMediaItem[];
  aboutImage1: WizardMediaItem | null;
  aboutImage2: WizardMediaItem | null;
  videoLink: string;
  view360Link: string;
}
```

- Description step's successful save also stashes `{ title, description }` into `WizardContent`
  (the Description form itself is unchanged; the wizard captures the submitted values — it
  already captures `listingId` the same way).
- Media step reads/writes `heroMedia`, `aboutImage1/2`, `videoLink`, `view360Link`.
- The state lives above the step components, so it survives Back/forward navigation.

### Data model

```ts
interface WizardMediaItem {
  /** Server id — present only for items re-seeded after a save (resync). */
  id?: string;
  /** Local file uri — present for newly-picked items. */
  uri?: string;
  /** Server url — present for re-seeded items (preview + retain list). */
  url?: string;
  name: string;
  mimeType: string;
  type: 'image' | 'video';
  altText: string;
  isHero: boolean;
  order: number;
}
```

- Newly-picked: has `uri`, no `id`. Re-seeded (after save): has `id` + `url`, no `uri`.
- Exactly one hero (the first item / `order === 0`). Reorder via move-up/move-down buttons.

### Documents state (secondary only)

```ts
interface WizardDocItem {
  uri: string;
  name: string;
  mimeType: string;
}
// wizard-level: { supporting: WizardDocItem[]; notes: string }
```

## Backend contract (`/api/v1`, `apiClient` unwraps `{ success, data }`)

FormData files are RN objects `{ uri, name, type }` appended to `FormData`; each request
overrides `Content-Type: multipart/form-data` (apiClient default is `application/json`).

### Secondary branch

1. **Hero** — `POST /api/v1/opportunity-listing/:listingId/hero`:
   - `title`, `subtitle=''`, `description` (from `WizardContent`), `videoLink`, `view360Link`.
   - `existingMedia` = JSON `[{ id, altText, sortOrder }]` for items that have an `id` (re-seeded, kept).
   - For each NEW item (has `uri`, no `id`), in display order: append `files` = `{ uri, name, type }`
     and push its `altText` into a parallel `newMediaAltTexts` JSON array.
   - Item order = display order; hero item is placed at `order 0` (first). Backend reads hero as
     `sortOrder === 0`.
2. **About** — `POST /api/v1/opportunity-listing/:listingId/about`:
   - Text fields sent empty (`title=''`, `subtitle=''`, `textSection1=''`, `textSection2=''`,
     `additionalDescription=''`) — About text belongs to the not-yet-built Portals step.
   - Image 1: if present with `uri` → append `image1` file + `image1AltText`; if the slot was
     cleared (had an id, now null) → `removeImage1='true'`. Same for `image2`.
3. **Documents** — for each supporting file:
   `POST /api/v1/opportunities/:opportunityId/documents` (multipart): `file`,
   `documentType='GENERAL_DOCUMENT'`, `notes?` (shared notes, omit when empty). Only files with
   a local `uri` (newly-picked) are uploaded; re-seeded/uploaded ones are skipped.

### Primary branch

1. **Hero** — `POST /api/v1/listing-cms/:listingId?section=hero` (header `X-Use-FormData: true`):
   `mainTitle`, `subTitle=''`, `description`, `videoLink`, `view360Link`, `existingMedia` (JSON
   for kept items), `media_<i>` per new file, `heroMediaAltText_<i>`, `heroIndex` (index of hero).
2. **About** — `POST /api/v1/listing-cms/:listingId?section=about` (header `X-Use-FormData: true`):
   About text empty; `media_<i>` per new About image, `aboutMediaAltText_<i>`,
   `removeAboutSlot_<i>='true'` when a saved slot is cleared.
3. No documents (primary has no owner).

### Resync after save (idempotency)

After a successful media save, GET the listing content and re-seed the gallery with server media
so a re-save sends kept items via `existingMedia` and only genuinely-new files (no duplicates).

- **Secondary** — `GET /api/v1/opportunity-listing/:listingId` → `data.media.hero[]`,
  `data.media['about-image-1'][]`, `data.media['about-image-2'][]`. Each media item:
  `{ id, mediaType, mediaUrl, altText, sortOrder, fileSize }` → map to `WizardMediaItem`
  (`id`, `url=mediaUrl`, `type = mediaType==='video'?'video':'image'`, `altText`, `isHero =
sortOrder===0`, `order=sortOrder`).
- **Primary** — `GET /api/v1/listing-cms/:listingId` → `data.sections.hero.media[]`,
  `data.sections.about.media[]` (slice 0..1 → image1, 1..2 → image2). Item shape
  `{ id, mediaType, mediaUrl, altText, isHero?, sortOrder? }`.

Also mark uploaded supporting documents as sent (drop their local `uri`) so a re-save skips them.

## Components (new files under `src/features/listing-wizard/`)

- `components/MediaGallery.tsx` — hero gallery editor.
  - Thumbnail grid; an "Add" tile → `expo-image-picker` `launchImageLibraryAsync({ mediaTypes:
['images','videos'], allowsMultipleSelection: true, quality: 0.85 })` (request permission first).
  - Per item: thumbnail (video items show a play badge), a "Hero" toggle/badge (sets that item
    `order 0`, clears others), an alt-text `Input`, move-up / move-down buttons (reorder; disabled
    at ends), and a remove (X) button. All controls ≥44pt with `accessibilityLabel`.
  - Props: `Readonly<{ items: WizardMediaItem[]; onChange: (items: WizardMediaItem[]) => void }>`.
- `components/SingleImageField.tsx` — one image + alt (About 1 & 2).
  - Empty state: a tap-to-add tile (`expo-image-picker`, single, images only). Filled: thumbnail - alt `Input` + remove. Props: `Readonly<{ label: string; value: WizardMediaItem | null;
onChange: (v: WizardMediaItem | null) => void }>`.
- `components/DocumentPickerField.tsx` — supporting documents.
  - `expo-document-picker` `getDocumentAsync({ multiple: true, type: ['image/*','application/pdf',
'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
})`. Renders a list of file names with a remove (X) each, and an "Add documents" button.
    Props: `Readonly<{ items: WizardDocItem[]; onChange: (items: WizardDocItem[]) => void }>`.
- `components/steps/MediaStep.tsx` — orchestrator. `ScrollView` (padding 16, paddingBottom 32,
  `keyboardShouldPersistTaps="handled"`) with four `WizardCard`s:
  - `Images` (icon `Images`, desc "Hero images and videos shown at the top of the listing.") → `MediaGallery`.
  - `About Images` (icon `Image`, desc "The two images shown in the About this Property section.")
    → two `SingleImageField` ("Image 1", "Image 2").
  - `Video & Virtual Tour` (icon `Video`, desc "Optional links to a walkthrough video and a 360°
    tour.") → two `field`-style inputs (`Video Link`, `View 360`) bound to `WizardContent`.
  - `Documents` (icon `FileText`, desc "Upload any supporting documents — all optional.") —
    rendered ONLY when `created.branch === 'secondary'` → `DocumentPickerField` + a Notes
    `Textarea`.
- `hooks/use-save-media.ts` — TanStack mutation `useSaveMedia()`:
  `mutateAsync({ created, content, documents })`. Branches primary/secondary, runs the hero +
  about upserts and (secondary) document uploads, then performs the resync GET and returns the
  re-seeded `{ heroMedia, aboutImage1, aboutImage2, supporting }` so the wizard can update state.

### Services (`services.ts`, appended)

- `upsertOpportunityListingHeroMedia(listingId, { title, description, videoLink, view360Link, media }): Promise<void>`
- `upsertOpportunityListingAbout(listingId, { image1, image2 }): Promise<void>`
- `upsertPrimaryListingHeroMedia(listingId, {...}): Promise<void>`
- `upsertPrimaryListingAbout(listingId, { image1, image2 }): Promise<void>`
- `uploadOpportunityDocument(opportunityId, { file, documentType, notes? }): Promise<void>`
- `getOpportunityListingMedia(listingId): Promise<{ hero: WizardMediaItem[]; about1: WizardMediaItem | null; about2: WizardMediaItem | null }>`
- `getPrimaryListingMedia(listingId): Promise<{ hero; about1; about2 }>`

(The existing text-only `upsertOpportunityListingHero` / `upsertPrimaryListingHero` from step 2
are superseded on this step by the media-aware variants; the Description step keeps using the
text-only ones. Optionally consolidate later — not required here.)

## Navigation

- Add step index 2 (Media). `WizardStepper activeIndex={stepIndex}` already supports it.
- Description "Save Content" now **advances to Media** (`setStepIndex(2)` on success) — previously
  save+stay, because Media did not exist.
- Media footer (extended `WizardFooter`): Back (→ Description) + "Save Media" (primary). Per the
  no-Portals-yet state, Save Media **saves + stays** on the step (success toast "Media saved" /
  "Media & documents saved"); on success the gallery is re-seeded from the resync.

## UI/UX (ui-ux-pro-max)

- Reuses the wizard design system: `WizardCard` sections, semantic Tailwind tokens (no hex),
  Lucide icons, `keyboardShouldPersistTaps="handled"`.
- Touch: thumbnails and every control ≥44pt; controls carry `accessibilityLabel`
  (hero/remove/move-up/move-down/add).
- Feedback: per-item alt inputs are labelled; a busy state while the picker opens; loading spinner
  on Save Media; error toast on failure (stay on step, nothing consumed).
- Media is not conveyed by color alone (video badge icon, hero badge text).

## Out of scope

- Identity Verification (EMIRATES_ID upload + link/manual review) — separate feature.
- Portals step (index 3), About text fields, FAQ/SEO/amenities/location/highlights.
- Resume/edit hydration of an existing listing, review/publish lifecycle.
- Title Deed / Rejection Evidence / Contract A document slots (not in web's Media step UI).
- Drag-to-reorder (using move up/down instead).

## Open items (resolved)

- **Scope:** Media + Documents; Identity deferred.
- **Gallery:** full — multi image+video, alt, hero-pick, remove, reorder.
- **Idempotency:** resync (GET content, re-seed as existing) after each save.
- **Reorder UI:** move up/down buttons.
- **Hero clobber:** shared `WizardContent` carries title/description into the hero upsert.
- **FormData multipart:** RN file objects + per-request `multipart/form-data` (verified pattern in chat).
