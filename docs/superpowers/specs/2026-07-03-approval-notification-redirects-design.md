# Approval Notification Redirects (Mobile) — Design

Date: 2026-07-03
Repo: `boh-mobile` (+ one backend change in `boh-lead-magnet-backend`)

## Goal

Approval-workflow notifications (agent / manager / super-admin) must deep-link to the
correct in-app screen when tapped. The backend emits **web** `redirectUrl`s; mobile
translates them in `src/features/notifications/utils/resolve-redirect.ts`. Several
approval-flow URLs were either mis-routed or dead-ended.

## Background

OS push carries only `redirectUrl` / `category` / `conversationId`
(`notification.processor.ts` `deliverPush` whitelist) — so routing must derive from
`redirectUrl`, except where the backend adds extra data fields explicitly (see the approver
case). Mobile reviewers act via the **banner inside the listing wizard**
(`/listings/edit/[id]?kind=`); there is no approvals inbox on mobile (deferred — see
`2026-07-02-listing-review-workflow-design.md`). `isReviewer` is server-computed, so the
same wizard route serves agent, manager, and super-admin with the right banner.

## Audit — approval/listing/project notification redirects

| Notification | redirectUrl (web) | Roles | Correct mobile target |
| --- | --- | --- | --- |
| Primary listing events | `/my-account/all-listings/:id` | all | `/listings/:id` |
| Submit-for-review → approver | `/my-account/approvals/:cat/:req` (+`resourceId`,`resourceKind` in data) | mgr / SA | `/listings/edit/:resourceId?kind=` |
| Review outcome → submitter | `/my-account/listings/create?listingId=X&type=Y` | agent | `/listings/edit/X?kind=Y` |
| Project events | `/my-account/project-management/:id` | all | `/projects/:id` |
| Project mgmt list | `/my-account/project-management` | — | `/projects` |
| Lead detail | `/my-account/manage-leads/:id` | — | `/leads/:id` |
| Opportunity / secondary-listing events | `/my-account/manage-leads/:leadId/property/:oppId` | agent / mgr | `/listings/edit/:oppId?kind=secondary` |

## Changes

### Mobile — `resolve-redirect.ts`

Rule table (order matters; more-specific first):

1. `…/listings/create?listingId=X&type=(primary\|secondary)` → `/listings/edit/X?kind=Y`
   (review outcome — resume/revise in wizard).
2. `…/manage-leads/:leadId/property/:oppId` → `/listings/edit/:oppId?kind=secondary`
   (opportunity/secondary events). **Precedes** the generic `/manage-leads/:id` rule.
3. `…/manage-leads/:id` → `/leads/:id` (bare lead detail).
4. `…/all-listings/:id` → `/listings/:id` (primary listing detail). **Precedes** the
   `/all-listings` list rule so the id is not dropped.
5. `…/all-listings` → `/listings` (list).
6. Existing project / list / legacy rules unchanged.

`resolveRedirectFromData` gains `resourceId` + `resourceKind` params: when present (approver
submit-for-review notice, whose redirectUrl carries no resourceId) → `/listings/edit/:resourceId?kind=`.
`resolveRedirect` and the `NotificationsProvider` tap handler + socket re-present path pass
these through.

### Backend — approver notice enrichment

`approval-notifications.helper.ts` `notifyCurrentLevelApprovers`: add `resourceId` +
`resourceKind` (`primary` when `resourceType === listing`, else `secondary`) to the
notification `data`. `notification.processor.ts` `deliverPush`: forward `resourceId` +
`resourceKind` in the push data whitelist. Web ignores the extra fields.

## Non-goals

- Mobile approvals inbox (phase 2).
- New backend notification triggers — recipients/events are unchanged; only routing data.
- Read-only secondary-listing detail view — opportunity taps use the wizard.

## Verification

- `npx tsc --noEmit` clean (mobile).
- `npx eslint` clean on the changed files (mobile + backend).
- Manual: tap each notification type per role; confirm destination matches the audit table.
