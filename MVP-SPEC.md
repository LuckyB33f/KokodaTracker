# Kokoda Tracker — MVP Specification

**Product:** Kokoda Tracker — a mobile-first PWA for a team training for the Kokoda Challenge Brisbane (June 2027, D'Aguilar National Park, Brookfield).
**Version:** 1.1 (adds F9 Adaptive Training, F10 Weather-Aware Weekend Suggestion) · **Status:** Approved for build · **Owner:** Team Captain (user)
**This document is the single source of truth. Every feature built must trace back to a requirement here.**

---

## 1. Product Overview

### 1.1 Problem
A team of 2–5 people training for the Kokoda Challenge (18/30/48km trail event) needs to: log training consistently, track hikes with GPS, follow a periodised plan (Base → Build → Peak → Taper, Aug 2026 → Jun 2027), see whether the team is on track, and keep everyone at a shared pace. Spreadsheets and group chats don't cut it.

### 1.2 Users
- **Team Captain** — creates the team, invites members, triggers AI plan generation.
- **Team Member** — logs sessions, records hikes, views plan and team progress.
- (Single role model with a `captain` flag; no admin console in MVP.)

### 1.3 Goals (MVP success criteria)
1. Any member can log a training session from their phone in under 30 seconds.
2. GPS-recorded hikes show route, distance, elevation gain, duration, and pace on a map.
3. Gemini generates a personalised weekly training plan aligned to the phased schedule and each member's recent load — and adapts it up or down based on actual performance (F9).
4. The dashboard answers "are we on track for race day?" at a glance, including event countdown, and suggests the best weekend hike window based on stored weather data (F10).
5. Installable as a PWA on iOS and Android home screens; core screens work offline.

### 1.4 Out of scope (MVP)
Payments, public profiles, social features beyond the team, wearable/Strava integrations, push-notification campaigns (a single weekly reminder is a stretch goal), multi-team support beyond one team per user, native apps.

---

## 2. Architecture (Solution Architect)

### 2.1 Stack
| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + `vite-plugin-pwa` | Team standard; Vite PWA plugin generates service worker + manifest |
| UI | Material UI (MUI v5), light/dark via theme tokens only | Team standard (react-product-ui skill) |
| State | Redux Toolkit + RTK Query (Firestore accessed via api layer), Formik + Yup forms | Team standard |
| Auth | Firebase Authentication (Email/Password + Google Sign-In) | User requirement: login |
| Database | Cloud Firestore | Realtime team sync, offline persistence built in |
| Serverless | Cloud Functions for Firebase (Node 20, callable + scheduled) | Gemini proxy, plan scheduling, metrics, weather fetch |
| AI | Gemini API (`gemini-2.5-flash` default) called **only** from Cloud Functions | Key never ships to client; prompt versioned server-side |
| Weather | Google Maps Platform Weather API, called **only** from a scheduled Cloud Function, results stored in Firestore | ~150 calls/month vs 10,000 free tier; client never calls it |
| Maps/Location | Browser Geolocation API (`watchPosition`) for recording + Google Maps JavaScript API for display; Wake Lock API during recording | User requirement: Google API location tracking |
| Hosting | Firebase Hosting (SPA rewrite to /index.html) | User requirement |
| Offline | Firestore offline persistence + Workbox precache (app shell) + IndexedDB queue for in-progress GPS recordings | PWA requirement |

### 2.2 Architecture rules
- Client never calls Gemini or the Weather API directly. All external API calls run server-side in Cloud Functions; results the client needs are written to Firestore and read from there.
- `generatePlan` is an HTTPS callable function requiring auth; enforce per-user daily quota (5 calls) in the function.
- Scheduled jobs run once daily (5:00am Brisbane) plus a Thu/Fri 6:00am suggestion run — cheap, predictable, sufficient for ≤5 users; keep Cloud Scheduler jobs ≤3 (free tier).
- Google Maps JS API key is client-side by necessity → restrict by HTTP referrer in Google Cloud Console. Geolocation data itself never leaves the device except to Firestore.
- Firestore Security Rules are the authorization layer (see §5). No data access without team membership.
- GPS points are batched: append to a local buffer, flush to Firestore as a compressed polyline + summary stats on session save (not one document per point).
- All dates stored UTC; displayed in `Australia/Brisbane`.

### 2.3 Firestore data model (Database Architect)
```
teams/{teamId}
  name, eventDistanceKm (18|30|48), eventDate, createdBy, inviteCode, memberIds[]
teams/{teamId}/members/{uid}
  displayName, photoURL, isCaptain, weeklyTargetHours, joinedAt
teams/{teamId}/sessions/{sessionId}
  uid, type (hike|run|walk|stairs|strength|other), source (gps|manual)
  startedAt, durationMin, distanceKm, elevationGainM, avgPaceMinPerKm
  route { encodedPolyline, bounds, pointCount }   // gps only
  perceivedEffort (1..10), notes, weekKey (e.g. 2026-W35)
teams/{teamId}/plans/{planId}                  // function-written only (F5)
  generatedAt, model, promptVersion, phase (base|build1|build2|peak|taper)
  weekKey, status (active|superseded), readinessInputs{}
  days[] { date, memberUid|null(=whole team), title, detail, targetType, targetValue }
teams/{teamId}/plans/{planId}/checkoffs/{uid}_{dayIndex}
  uid, dayIndex, done, updatedAt                // member-written done flags
teams/{teamId}/memberMetrics/{uid}_{weekKey}   // function-written only (F9)
  uid, weekKey, plannedLoad, actualLoad, completionPct, avgEffort, acwr
  verdict (scale_up|hold|scale_back), reason, computedAt
teams/{teamId}/suggestions/{weekKey}           // function-written only (F10)
  createdAt, updatedAt, pick{day, startTime, locationName, distanceKm}
  reasoning, weatherSnapshot, status
weather/{yyyy-mm-dd}                           // function-written, shared by all teams
  fetchedAt, locations[{name, lat, lng, days[{date, tMin, tMax, precipProb,
  stormProb, uvIndex, windKph, sunrise, sunset, summary}]}]
teams/{teamId}/foodLogs/{logId}
  uid, date (YYYY-MM-DD, Australia/Brisbane), mealType (breakfast|lunch|dinner|snack)
  description, calories (optional), notes (optional), createdAt
invites/{code}
  teamId, createdBy, createdAt          // code → team lookup for joining (§2.5)
users/{uid}
  activeTeamId, units, theme, createdAt
```
Indexes: `sessions` composite on (`weekKey`, `uid`) and (`startedAt` desc). Polyline encoding keeps route docs < 100KB (Firestore 1MB limit ≈ 40k+ points encoded; cap recording at 1 point / 5s).

### 2.4 Gemini plan-generation contract (Integration Engineer)
- **Input assembled server-side:** event date + distance, current phase (derived from date), per-member last-28-day aggregates (sessions count, hours, km, elevation, longest hike), team weekly target, **F9 readiness verdicts** (default `hold` when no metrics exist).
- **Load ceilings are computed in code, not by the model** — the prompt supplies per-member ceilings as hard constraints and generated plans are clamped/rejected against them after validation.
- **Prompt (versioned `promptVersion: 1`):** instructs Gemini to return **JSON only** matching the `plans.days[]` schema; periodisation rules embedded (10% weekly ramp cap, recovery week every 4th, Saturday team hike mandatory, taper rules).
- **Output:** validated with Zod in the function; invalid JSON → one retry with repair prompt → error surfaced to client. Plan written to Firestore by the function, never by the client.
- Non-negotiable guardrail in prompt: plans are general fitness guidance, no medical advice; include rest days.

### 2.5 Spark-plan adaptation (decision record, 2026-07-27)
**UPDATE (later 2026-07-27): the owner upgraded the project to Blaze.** Cloud Functions are now available — F5/F9/F10 build on them. The F2 invites design below remains as built (still valid and function-free). Historical record:

The Firebase project (`kokoda-tracker-2027`) was on the free **Spark** plan. Cloud Functions require Blaze (billing), which only the owner can enable. Until then:
- **F2 invites without Functions:** the captain's client generates the 6-char code and writes `invites/{code}` + the team doc in one batch. Joining resolves `invites/{code}` → `teamId`, then a transaction adds the joiner to `memberIds` and creates their member doc. Security rules — not a function — enforce that a joiner can only append **their own uid**, that teams cap at 5 members, and that only the captain edits team metadata. This keeps the §5 guarantee that clients can't tamper with membership.
- **F5 Gemini is BLOCKED** on the Blaze upgrade: the API key must never ship client-side (§2.2), so plan generation waits for Cloud Functions. No workaround will be built.
- Revisit this record if/when billing is enabled; the invites design remains valid either way.

---

## 3. Features (Product Owner — priority order, build vertically, one at a time)

### F1 — Authentication & Profile  `[STATUS: ACCEPTANCE PASSED (email/password) — Google OAuth click-through outstanding]`
- Email/password + Google sign-in; password reset; persistent session.
- On first login create `users/{uid}`; profile screen (display name, units, theme).
- Protected routes; unauthenticated users see Login/Register only.
- **Acceptance:** new user can register, log out, log back in on mobile; refresh keeps session.

### F2 — Team Creation & Join  `[STATUS: ACCEPTANCE PASSED 2026-07-27 — §2.5 Spark design]`
- Captain creates team (name, distance, event date) → 6-char invite code generated by Cloud Function.
- Join via code; membership doc created; `memberIds` updated transactionally in the function (client cannot write memberIds).
- Team screen lists members; captain can regenerate code.
- **Acceptance:** two devices, one creates + one joins, both see each other in <2s (realtime).

### F3 — Manual Session Logging  `[STATUS: ACCEPTANCE PASSED 2026-07-27]`
- Mobile-first Formik form: type, date/time, duration, distance, elevation (optional), effort slider, notes. Yup validation mirrors Firestore rules (duration 1–1440, distance 0–100, effort 1–10).
- Sessions list (newest first, infinite scroll) + edit/delete own sessions only.
- **Acceptance:** loggable in <30s on a phone; appears instantly in team feed; offline log syncs when back online.

### F3.5 — Food Logging  `[STATUS: ACCEPTANCE PASSED 2026-07-27]`
- Owner requirement (2026-07-27): track **food and exercise** together — nutrition fuels the training plan.
- Quick-log form (<15s on a phone): meal type (breakfast/lunch/dinner/snack), what you ate (free text), optional calories, optional notes. Day view groups entries by meal with a daily calorie total when calories are provided.
- Date navigation (default today, Australia/Brisbane); edit/delete own entries only; visible to the whole team like sessions (shared accountability).
- Validation: description 1–200 chars, calories 0–5000 integer when present.
- **Acceptance:** log a meal in <15s; entry appears in the day view instantly; another member's device sees it in realtime; edit and delete work; daily total is correct.

### F4 — GPS Hike Recording + Map  `[STATUS: CODE COMPLETE 2026-07-27 — map + real-walk test pending Maps API key]`
- Record screen: Start/Pause/Finish; live map (Google Maps JS), live distance (haversine), elapsed time, current pace; Wake Lock while recording; points buffered to IndexedDB every 5s so a crash loses nothing.
- Finish → summary screen → saves as a `source: gps` session with encoded polyline; session detail renders route polyline + stats.
- Graceful degradation: permission denied or unsupported → offer manual entry.
- **Acceptance:** a real 20-min walk records a plausible route, distance within ±5%, survives app backgrounding on Android Chrome; iOS foreground-only documented in-app.

### F5 — AI Training Plan (Gemini)  `[STATUS: NOT STARTED]`
- "Generate this week's plan" (captain) → callable function → Gemini → plan doc; plan view shows week grid per member + team Saturday hike; members tick items done (writes `done`).
- Regeneration supersedes prior plan (status flag), history retained.
- Per §2.4 contract; quota + error states in UI (LoadingState/ErrorState components).
- **Acceptance:** generated plan respects phase rules for the current date, renders per-member, check-offs persist, second generation supersedes first.

### F6 — Dashboard & Progress  `[STATUS: ACCEPTANCE PASSED 2026-07-27]`
- Event countdown (days to event), current phase banner.
- This-week vs plan: hours, km, elevation per member (MUI cards + simple charts).
- Team totals: cumulative km "virtual Kokoda" progress bar (target: 3× event distance trained by taper), longest hike per member.
- **Acceptance:** numbers reconcile exactly with the sessions collection for the week; loads <2s on 4G.

### F7 — PWA Shell & Offline  `[STATUS: CODE COMPLETE 2026-07-27 — airplane-mode device test outstanding]`
- `vite-plugin-pwa`: manifest (name, icons 192/512, standalone, theme colour), Workbox precache of app shell, runtime caching for map tiles (stale-while-revalidate, capped).
- Firestore offline persistence enabled; custom install prompt (A2HS) on second visit; offline banner.
- **Acceptance:** Lighthouse PWA installable pass; airplane-mode shows dashboard + cached sessions; manual log created offline syncs on reconnect.

### F8 — Stretch: Weekly Reminder Notifications  `[STATUS: NOT STARTED]`
- FCM web push (Android/desktop; iOS 16.4+ installed-PWA only): Friday “team hike tomorrow” from scheduled function reading the active plan + F10 suggestion. Skip silently on unsupported browsers.
- **Acceptance:** opted-in Android device receives the scheduled push.

### F9 — Adaptive Plan Adjustment  `[STATUS: NOT STARTED]`
- Scheduled function (daily, 5:00am Brisbane job) computes per-member weekly metrics into `teams/{teamId}/memberMetrics/{uid}_{weekKey}`: plan completion %, actual vs planned load (session-RPE: Σ durationMin × effort), average effort, acute:chronic workload ratio (ACWR = this week's load ÷ 4-week rolling average).
- Deterministic verdict in code (never by the model): `scale_up` if completion ≥90% AND avgEffort ≤4 AND ACWR ≤1.2; `scale_back` if completion <60% OR avgEffort ≥8 sustained OR ACWR >1.5 (forces recovery week); else `hold`. Hard rules: weekly load increase capped at 10%; Taper phase locked to `hold`/`scale_back`; no scaling verdicts until 4 weeks of history exist.
- Verdicts feed the F5 prompt as constraints; plan view shows a "why" chip (e.g. "Scaled up — you cruised last week").
- Guidance-only disclaimer displayed; not medical advice.
- **Acceptance:** synthetic session data for the three scenarios produces the correct verdict; generated plan load never exceeds the ceiling; taper is never scaled up.

### F10 — Weather-Aware Weekend Suggestion  `[STATUS: NOT STARTED]`
- `fetchWeather` in the daily 5:00am job: pulls 3-day daily forecast from the Google Weather API for the mapped training locations (Mt Coot-tha, Brookfield Reserve, Gap Creek, Walkabout Creek, D'Aguilar/Mt Glorious) and stores it in `weather/{date}`. Client never calls the Weather API; dashboard reads the stored doc (offline-persistent for free). ~150 calls/month, inside the 10k free tier.
- `weekendSuggestion` scheduled function, Thursday + Friday 6:00am Brisbane: reads latest `weather/` doc + active plan phase → deterministic safety gates first (reject windows with storm probability >30%; forecast max >30°C → start 5:30–6:00am and prefer cooler day; respect daylight) → Gemini writes the human suggestion ("Sunday 6am from Brookfield, 18km — storms likely Saturday arvo") → saved to `teams/{teamId}/suggestions/{weekKey}`; Friday run updates if the outlook changed. Card on dashboard shows the pick plus the storm/rain probabilities honestly; feeds F8 push.
- **Acceptance:** given a stored forecast with a stormy Saturday and clear Sunday, the suggestion picks Sunday; a >30°C day produces an early start; the card renders offline from the stored doc.

---

## 4. Non-Functional Requirements
- Mobile-first (design at 380px); all colours via MUI theme tokens; light + dark mode.
- SEO component on every route (title, description, OG); semantic HTML.
- TTI < 3s on mid-range Android over 4G; code-split routes.
- Accessibility: labels on all inputs, 44px touch targets, contrast AA.
- Cost ceiling: must run within Firebase Spark/low Blaze usage for ≤10 users (batched writes, no per-point documents, Gemini quota).

## 5. Security (must ship with F2, reviewed every feature)
Firestore rules enforce: authenticated only; team docs readable/writable only by `memberIds` (join = rules-validated self-append per §2.5); members write only their own sessions/foodLogs; `plans`, `memberMetrics`, `suggestions`, `weather` client-writable **never** (written only by Cloud Functions via Admin SDK, which bypasses rules); plan `checkoffs/{uid}_*` writable only by that uid; `users/{uid}` self-only. Callable functions verify auth + membership server-side. App Check (reCAPTCHA v3) on Functions + Firestore before public launch.

## 6. Risks & Technical Debt Register
| # | Item | Type | Mitigation / Status |
|---|---|---|---|
| R1 | iOS Safari suspends GPS on screen lock | Platform risk | Wake Lock + in-app notice + manual entry parity. OPEN |
| R2 | Gemini returns malformed JSON | Integration risk | Zod validation + retry-with-repair. Design in §2.4 |
| R3 | Maps JS API key exposed client-side | Security | Referrer restriction + billing cap alert. OPEN until configured |
| R4 | Firestore free-tier read amplification on dashboard | Cost | Weekly aggregate doc maintained by function trigger. DEFERRED (build if reads spike) |
| R5 | ACWR noisy with tiny team + sparse data | Data | No scaling verdicts until 4 weeks of history; Base phase provides ramp-in. DESIGNED (F9) |
| R6 | Brisbane storm forecasts unreliable >3 days out | Data | 3-day window only; Friday refresh; probabilities shown on card. DESIGNED (F10) |
| TD-1 | App icons are script-generated placeholders (`public/icons`, `public/favicon.svg`) | Design debt | Replace with designed brand icons before launch. OPEN |
| TD-2 | `react-helmet-async` silently failed to apply tags (unmaintained); replaced with custom `SEO` component (`src/components/common/SEO.tsx`, client-side only) | Decision record | No action — revisit only if SSR is ever added. CLOSED |
| TD-3 | No Java on dev machine → Firestore emulator unavailable; auth flows can only be verified against the real Firebase project | Tooling gap | Install a JDK to enable `npm run emulators`, or accept live-project testing. OPEN |
| TD-4 | Login form shipped with hardcoded default credentials (real email + plaintext password in `LoginForm.tsx` initialValues and displayed on `LoginPage.tsx`) | Security | Removed 2026-07-27 during F1 acceptance; replaced with empty initialValues + "Create an account" link. CLOSED |
| TD-5 | `/register` route was stubbed to redirect to `/login`; `RegisterPage` existed but was unreachable | Bug | Fixed 2026-07-27: `RegisterPage` lazy-loaded and wired at `/register`. CLOSED |
| TD-6 | Google sign-in provider is enabled but the OAuth popup flow is untested (cannot be automated); needs one manual click-through | Test gap | Verify once on desktop + once on a phone via hosting preview channel. OPEN |

## 7. Implementation Status
| Feature | Status | Completion |
|---|---|---|
| F1 Auth | Acceptance passed 2026-07-27 against live project `kokoda-tracker-2027` (register → users/{uid} doc → reload persists → sign out → sign in, desktop + 375px viewport, clean console, prod build green). Outstanding: Google OAuth click-through (TD-6), real-device test | 95% |
| F2 Teams | Acceptance passed 2026-07-27: create (Trail Blazers), invite-code regen (live via onSnapshot), join as 2nd account, member list realtime, captain-only controls. Two-physical-device check still worthwhile | 95% |
| F3 Manual logging | Acceptance passed 2026-07-27: log via dialog form, realtime feed, edit prefilled + saved, own-session-only menu. Offline-sync check rides on F7 | 90% |
| F3.5 Food logging | Acceptance passed 2026-07-27: quick-log, meal grouping, correct day total (420+250=670), day navigation, own-entry menus | 90% |
| F4 GPS recording | Recording engine verified with simulated GPS (watchPosition 5s throttle, live distance/pace, IndexedDB crash buffer, Wake Lock, pause/resume, polyline+bounds saved: 7-pt route in Firestore). Outstanding: Google Maps key (R3) for live map, session-detail route view, real 20-min walk test | 70% |
| F5 Gemini plans | Function + UI built and deployed; BLOCKED on invocation by org Domain-Restricted-Sharing policy — see TODO.md decision (trigger refactor vs policy override) | 70% |
| F6 Dashboard | Acceptance passed 2026-07-27: countdown (327d), phase banner (base), per-member week vs target, Virtual Kokoda bar + longest hikes — all reconcile exactly with sessions | 90% |
| F7 PWA/offline | Firestore IndexedDB persistence (multi-tab), offline banner (verified), install prompt (2nd visit), SW precache 31 entries. Outstanding: Lighthouse pass + airplane-mode device test | 80% |
| F8 Notifications (stretch) | Not started | 0% |
| F9 Adaptive adjustment | Deployed + verified live: metrics docs written with correct hold verdicts (history gate); 14/14 unit tests. Full loop needs F5 plans for completion % | 85% |
| F10 Weather suggestion | fetchWeather verified live (real forecast in weather/{date}); suggestion run + dashboard card pending one job re-run (see TODO.md #2) | 75% |
**Overall MVP completion: ~75% · Production readiness: 6/10**

## 8. Next Implementation Priority
v1.1 build order: **F5 → F9 → F10** (Functions now available; see the approved implementation plan). Then:
1. **Owner:** Google Maps JS key (R3) for the F4 live map; Gemini/Weather keys if not yet provisioned.
2. **F4 finish:** session-detail route map once the key exists; real 20-min walk acceptance on a phone.
3. **Device passes:** Google OAuth click-through (TD-6), airplane-mode offline test, Lighthouse PWA audit, real two-device team join.
4. **F8** stretch (feasible now Functions exist).
5. Deploy: `npm run deploy:hosting` → test on phones via the hosting URL.
