# Kokoda Tracker — TODO (paused 2026-07-27)

Session paused mid-v1.1 build at the owner's request. This file is the resume point.
Spec: [MVP-SPEC.md](MVP-SPEC.md) (v1.1). Firebase project: `kokoda-tracker-2027` (Blaze, australia-southeast1).

## Where things stand

**Working and verified live:**
- F1 auth, F2 teams, F3 sessions, F3.5 food, F6 dashboard, F7 PWA/offline, F4 GPS engine (map pending API key) — all browser-tested earlier today.
- Cloud Functions deployed and ACTIVE: `generatePlan`, `dailyJob` (5:00am daily), `suggestionJob` (Thu+Fri 6:00am), region australia-southeast1.
- Secrets set: `GEMINI_API_KEY`, `WEATHER_API_KEY` (both are project API keys restricted to their APIs).
- **F10 weather fetch verified**: real Google Weather API forecast stored in `weather/{today}` (5 Brisbane locations × 3 days).
- **F9 metrics verified**: `memberMetrics` docs written with correct `hold` verdicts ("0/4 weeks history" rule working as specced). Unit tests: 14/14 green (`cd functions && npm test`).
- Firestore rules for plans/checkoffs/memberMetrics/suggestions/weather deployed.
- Client UI built: `/plan` page (grid, check-offs, readiness chip, captain Generate button), dashboard `WeekendSuggestionCard`.

## ✅ generatePlan blocker — Option A implemented (2026-07-27 evening), deploy pending

Owner chose **Option A (no org-policy changes)**. Implemented and verified locally (functions tsc + 14/14 tests, web build):
- `functions/src/triggers/onPlanRequest.ts` — `onDocumentCreated('teams/{teamId}/planRequests/{requestId}')`; transaction-claims the request (at-least-once-delivery safe), re-verifies team match, reuses `generatePlanHandler` unchanged, writes `status: done|error` (+`planId`/`errorCode`/`errorMessage`) back onto the request doc, prunes requests >7 days old.
- `functions/src/index.ts` — callable `generatePlan` export removed; `onPlanRequest` exported with the Gemini secret.
- `firestore.rules` — new `planRequests` block: captain-only create with exact shape `{requestedBy: uid, status: 'pending', createdAt: request.time}`; clients can never update/delete.
- Client: `planApi.generatePlan` now writes the request doc and streams it until done/error (120s timeout); `firebase/functions` SDK removed from `src/lib/firebase.ts`; PlanPage passes `teamId`.

**To ship it (after `firebase login` is fixed — see item 6):**
`npx firebase deploy --only firestore:rules,functions` — the deploy will also delete the old `generatePlan` callable since it's gone from source (confirm the prompt, or add `--force`). Then browser-test on `/plan`.

## Remaining checklist

1. [ ] Deploy Option A (`npx firebase deploy --only firestore:rules,functions`, needs login fix from item 6) → then browser-test: captain generates plan on `/plan`, grid renders, check-offs persist, regenerate supersedes, readiness "why" chip shows.
2. [ ] `suggestionJob` produced no suggestion doc yet — it ran before the weather doc existed and exits quietly. Re-run it once (or wait for Thursday 6am):
   force-run job `firebase-schedule-suggestionJob-australia-southeast1` in Cloud Scheduler console, then check `teams/{id}/suggestions/{week}` and the dashboard card. First run also exercises the Gemini prose call.
3. [ ] Update MVP-SPEC §7 statuses when F5/F10 pass acceptance.
4. [ ] F4: create + referrer-restrict a Google Maps JS key → `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`; then live map + session-detail route view + real 20-min walk test.
5. [ ] Device passes: Google OAuth click-through (TD-6), airplane-mode offline, Lighthouse PWA, two-device team join.
6. [ ] Deploy the web app: `npm run deploy:hosting` → test install on phones.
   ⚠ 2026-07-27 (evening): deploy attempted — build passes, but this machine's Firebase CLI is logged in as `jsonbydesign@gmail.com`, which cannot see `kokoda-tracker-2027`. Run `npx firebase login:add` with the account that owns the project, then `npx firebase login:use <that-account>`, then retry.
7. [ ] F8 stretch (FCM Friday reminder) — now feasible since Functions exist; reads active plan + F10 suggestion.
8. [ ] Housekeeping: `firebase-functions` major upgrade warning at deploy (breaking changes — do deliberately); Node 20 runtime decommissions 2026-10-31 (upgrade `functions/package.json` engines + runtime before then); replace placeholder icons (TD-1); App Check before public launch; delete leftover gcf build images warning if it recurs.

## Gotchas learned today (don't rediscover these)

- Org secure-by-default policies bit twice: compute SA needed `roles/cloudbuild.builds.builder` (build) and `roles/datastore.user` (Firestore at runtime) — both granted. IAM grants take ~2–5 min to propagate; don't panic-redeploy.
- `firebase deploy` only sets the callable invoker on **create**, not update — delete + redeploy to retry it.
- Test accounts: `f1test@example.com` (captain, team "Trail Blazers"), `f2mate@example.com` (member). Throwaways.
- Dev server: port 5174 (`.claude/launch.json`); 5173 belongs to FundIQ. Vite dep-optimize churn after adding new imports can produce "Invalid hook call" — restart the dev server, don't debug React.
- Resume command for the build loop: *"continue the build from TODO.md"*.
