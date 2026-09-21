# Notifications Build — Progress Tracker

Status legend: ☐ todo · ◐ in-progress · ☑ done · ⚠ blocked

**Rules:** Read `notifications-build-knowledge.md` first. Update this table on **start AND finish** of every task. Do **not** start a task whose deps are not ☑. Append a session handoff note when you stop.

| Task  | Description                                                                 | Deps                  | Status | Owner  | Notes / Blockers                                                                                                  |
| ----- | --------------------------------------------------------------------------- | --------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| 0     | Scaffold knowledge + progress docs                                          | —                     | ☑      | Claude | created in boh-mobile/docs/                                                                                       |
| BE-1  | Prisma DeviceToken model + migration + generate                             | —                     | ☑      | Claude | migration `20260515103554_add_device_tokens` applied                                                              |
| BE-2  | ExpoPushConfiguration + DTOs + expo-server-sdk dep                          | BE-1                  | ☑      | Claude | expo-server-sdk 6.1.0                                                                                             |
| BE-3  | Device-token service methods + controller routes (**integration contract**) | BE-2                  | ☑      | Claude | POST/DELETE /api/v1/notifications/device-tokens                                                                   |
| BE-4  | ExpoPushService (expo-server-sdk)                                           | BE-2                  | ☑      | Claude | chunked send + DeviceNotRegistered prune; never throws                                                            |
| BE-5  | Processor integration + module wiring                                       | BE-3, BE-4            | ☑      | Claude | no circular dep (QueueModule→NotificationModule one-way)                                                          |
| MF-1  | Prereqs: eas init, app.json plugin, deps, prebuild, Apple/FCM creds         | —                     | ◐      | Claude | code/config + deps done; **eas init + Apple/FCM creds + prebuild = manual (see knowledge doc)**                   |
| MF-2  | Types + constants (verbatim port)                                           | 0                     | ☑      | Claude |                                                                                                                   |
| MF-3  | Services (apiClient)                                                        | MF-2                  | ☑      | Claude |                                                                                                                   |
| MF-4  | Socket client lib                                                           | 0                     | ☑      | Claude |                                                                                                                   |
| MF-5  | Push-notifications lib                                                      | MF-1                  | ☑      | Claude | expo-notifications wrapper                                                                                        |
| MF-6  | Zustand notifications store                                                 | MF-2                  | ☑      | Claude |                                                                                                                   |
| MF-7  | Missing RNR primitives (Switch/Skeleton/EmptyState)                         | 0                     | ☑      | Claude |                                                                                                                   |
| MF-8  | Hooks (list/unread/mark/filter/permissions/register)                        | MF-3, MF-6            | ☑      | Claude |                                                                                                                   |
| MF-9  | Components (Avatar/Row/Banner/Center/Settings)                              | MF-7, MF-8            | ☑      | Claude |                                                                                                                   |
| MF-10 | Redirect resolver                                                           | MF-2                  | ☑      | Claude | + resolveRedirectFromData for OS-push taps                                                                        |
| INT-1 | Provider + routing + wiring                                                 | MF-4,5,6,8,9,10, BE-3 | ☑      | Claude | provider+routes+\_layout+ProfileScreen+signout cleanup                                                            |
| INT-2 | Static verify (tsc + eslint) ✓ · runtime matrix pending MF-1 creds          | INT-1, MF-1, BE-5     | ◐      | Claude | mobile tsc 0 err, eslint 0; backend type-check + strict lint pass. Runtime push test blocked on MF-1 manual creds |

## Parallel start set (no unmet deps once Task 0 done)

**BE-1 · MF-2 · MF-4 · MF-7** — independent, can run concurrently. **MF-1** (native prereqs) is the long-pole, start in parallel; it gates push _testing_ (MF-5, INT-2) not coding.

## Critical path

`0 → BE-1 → BE-2 → BE-3 → INT-1 → INT-2` (backend side) and `0 → MF-2 → MF-3/MF-6 → MF-8 → MF-9 → INT-1`. MF-1 must finish before MF-5/INT-2.

## Session handoff notes

- 2026-05-15 — Task 0 done (knowledge + progress docs created). Next: parallel start set BE-1, MF-2, MF-4, MF-7. Plan at `~/.claude/plans/https-localhost-3000-my-account-notifica-frolicking-donut.md`.
- 2026-05-15 — **All code complete (BE-1..5, MF-1..10, INT-1).** Backend: `npm run type-check` + `npm run lint:strict` both pass. Mobile: `pnpm exec tsc --noEmit` 0 errors, `pnpm lint` 0 errors in notification code (3 pre-existing warnings in eslint.config.js / theme/tokens.ts, unrelated). DB migration `20260515103554_add_device_tokens` applied.
  **Remaining = INT-2 runtime verification only**, blocked on the MF-1 manual steps (see `notifications-build-knowledge.md` → "MF-1 remaining MANUAL steps"): `npx eas init` (projectId), Apple APNs `.p8` + Android `google-services.json`/FCM uploaded to the Expo project, then `expo prebuild` + `expo run:ios --device`/`run:android`. After that, run the E2E matrix in the plan (Appendix C). No code changes should be needed to pass it.
