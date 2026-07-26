# Kokoda Tracker — MVP Specification

**Product:** Kokoda Tracker — a mobile-first PWA for a team training for the Kokoda Challenge Brisbane (June 2027, D'Aguilar National Park, Brookfield).
**Version:** 1.0 · **Status:** Approved for build · **Owner:** Team Captain (user)
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
3. Gemini generates a personalised weekly training plan aligned to the phased schedule and each member's recent load.
4. The dashboard answers "are we on track for race day?" at a glance, including event countdown.
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
| Serverless | Cloud Functions for Firebase (Node 20, callable functions) | Gemini proxy, invite handling, plan scheduling |
| AI | Gemini API (`gemini-2.5-flash` default) called **only** from Cloud Functions | Key never ships to client; prompt versioned server-side |
| Maps/Location | Browser Geolocation API (`watchPosition`) for recording + Google Maps JavaScript API for display; Wake Lock API during recording | User requirement: Google API location tracking |
| Hosting | Firebase Hosting (SPA rewrite to /index.html) | User requirement |
| Offline | Firestore offline persistence + Workbox precache (app shell) + IndexedDB queue for in-progress GPS recordings | PWA requirement |

### 2.2 Architecture rules
- Client never calls Gemini directly. `generatePlan` and `coachFeedback` are HTTPS callable functions requiring auth; enforce per-user daily quota (5 calls) in the function.
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
teams/{teamId}/plans/{planId}
  generatedAt, model, promptVersion, phase (base|build1|build2|peak|taper)
  weekKey, status (active|superseded)
  days[] { date, memberUid|null(=whole team), title, detail, targetType, targetValue, done }
users/{uid}
  activeTeamId, units, theme, createdAt
```
Indexes: `sessions` composite on (`weekKey`, `uid`) and (`startedAt` desc). Polyline encoding keeps route docs < 100KB (Firestore 1MB limit ≈ 40k+ points encoded; cap recording at 1 point / 5s).

### 2.4 Gemini plan-generation contract (Integration Engineer)
- **Input assembled server-side:** event date + distance, current phase (derived from date), per-member last-28-day aggregates (sessions count, hours, km, elevation, longest hike), team weekly target, injuries/notes flags.
- **Prompt (versioned `promptVersion: 1`):** instructs Gemini to return **JSON only** matching the `plans.days[]` schema; periodisation rules embedded (10% weekly ramp cap, recovery week every 4th, Saturday team hike mandatory, taper rules).
- **Output:** validated with Zod in the function; invalid JSON → one retry with repair prompt → error surfaced to client. Plan written to Firestore by the function, never by the client.
- Non-negotiable guardrail in prompt: plans are general fitness guidance, no medical advice; include rest days.

---

## 3. Features (Product Owner — priority order, build vertically, one at a time)

### F1 — Authentication & Profile  `[STATUS: CODE COMPLETE — PENDING ACCEPTANCE]`
- Email/password + Google sign-in; password reset; persistent session.
- On first login create `users/{uid}`; profile screen (display name, units, theme).
- Protected routes; unauthenticated users see Login/Register only.
- **Acceptance:** new user can register, log out, log back in on mobile; refresh keeps session.

### F2 — Team Creation & Join  `[STATUS: NOT STARTED]`
- Captain creates team (name, distance, event date) → 6-char invite code generated by Cloud Function.
- Join via code; membership doc created; `memberIds` updated transactionally in the function (client cannot write memberIds).
- Team screen lists members; captain can regenerate code.
- **Acceptance:** two devices, one creates + one joins, both see each other in <2s (realtime).

### F3 — Manual Session Logging  `[STATUS: NOT STARTED]`
- Mobile-first Formik form: type, date/time, duration, distance, elevation (optional), effort slider, notes. Yup validation mirrors Firestore rules (duration 1–1440, distance 0–100, effort 1–10).
- Sessions list (newest first, infinite scroll) + edit/delete own sessions only.
- **Acceptance:** loggable in <30s on a phone; appears instantly in team feed; offline log syncs when back online.

### F4 — GPS Hike Recording + Map  `[STATUS: NOT STARTED]`
- Record screen: Start/Pause/Finish; live map (Google Maps JS), live distance (haversine), elapsed time, current pace; Wake Lock while recording; points buffered to IndexedDB every 5s so a crash loses nothing.
- Finish → summary screen → saves as a `source: gps` session with encoded polyline; session detail renders route polyline + stats.
- Graceful degradation: permission denied or unsupported → offer manual entry.
- **Acceptance:** a real 20-min walk records a plausible route, distance within ±5%, survives app backgrounding on Android Chrome; iOS foreground-only documented in-app.

### F5 — AI Training Plan (Gemini)  `[STATUS: NOT STARTED]`
- "Generate this week's plan" (captain) → callable function → Gemini → plan doc; plan view shows week grid per member + team Saturday hike; members tick items done (writes `done`).
- Regeneration supersedes prior plan (status flag), history retained.
- Per §2.4 contract; quota + error states in UI (LoadingState/ErrorState components).
- **Acceptance:** generated plan respects phase rules for the current date, renders per-member, check-offs persist, second generation supersedes first.

### F6 — Dashboard & Progress  `[STATUS: NOT STARTED]`
- Event countdown (days to event), current phase banner.
- This-week vs plan: hours, km, elevation per member (MUI cards + simple charts).
- Team totals: cumulative km "virtual Kokoda" progress bar (target: 3× event distance trained by taper), longest hike per member.
- **Acceptance:** numbers reconcile exactly with the sessions collection for the week; loads <2s on 4G.

### F7 — PWA Shell & Offline  `[STATUS: NOT STARTED]`
- `vite-plugin-pwa`: manifest (name, icons 192/512, standalone, theme colour), Workbox precache of app shell, runtime caching for map tiles (stale-while-revalidate, capped).
- Firestore offline persistence enabled; custom install prompt (A2HS) on second visit; offline banner.
- **Acceptance:** Lighthouse PWA installable pass; airplane-mode shows dashboard + cached sessions; manual log created offline syncs on reconnect.

### F8 — Stretch: Weekly Reminder Notifications  `[STATUS: NOT STARTED]`
- FCM web push (Android/desktop; iOS 16.4+ installed-PWA only): Friday “team hike tomorrow” from scheduled function reading the active plan. Skip silently on unsupported browsers.
- **Acceptance:** opted-in Android device receives the scheduled push.

---

## 4. Non-Functional Requirements
- Mobile-first (design at 380px); all colours via MUI theme tokens; light + dark mode.
- SEO component on every route (title, description, OG); semantic HTML.
- TTI < 3s on mid-range Android over 4G; code-split routes.
- Accessibility: labels on all inputs, 44px touch targets, contrast AA.
- Cost ceiling: must run within Firebase Spark/low Blaze usage for ≤10 users (batched writes, no per-point documents, Gemini quota).

## 5. Security (must ship with F2, reviewed every feature)
Firestore rules enforce: authenticated only; team docs readable/writable only by `memberIds`; members write only their own sessions; `plans` and `teams.memberIds`/`inviteCode` writable only by Cloud Functions (custom claim check); `users/{uid}` self-only. Callable functions verify auth + membership server-side. App Check (reCAPTCHA v3) on Functions + Firestore before public launch.

## 6. Risks & Technical Debt Register
| # | Item | Type | Mitigation / Status |
|---|---|---|---|
| R1 | iOS Safari suspends GPS on screen lock | Platform risk | Wake Lock + in-app notice + manual entry parity. OPEN |
| R2 | Gemini returns malformed JSON | Integration risk | Zod validation + retry-with-repair. Design in §2.4 |
| R3 | Maps JS API key exposed client-side | Security | Referrer restriction + billing cap alert. OPEN until configured |
| R4 | Firestore free-tier read amplification on dashboard | Cost | Weekly aggregate doc maintained by function trigger. DEFERRED (build if reads spike) |
| TD-1 | App icons are script-generated placeholders (`public/icons`, `public/favicon.svg`) | Design debt | Replace with designed brand icons before launch. OPEN |
| TD-2 | `react-helmet-async` silently failed to apply tags (unmaintained); replaced with custom `SEO` component (`src/components/common/SEO.tsx`, client-side only) | Decision record | No action — revisit only if SSR is ever added. CLOSED |
| TD-3 | No Java on dev machine → Firestore emulator unavailable; auth flows can only be verified against the real Firebase project | Tooling gap | Install a JDK to enable `npm run emulators`, or accept live-project testing. OPEN |

## 7. Implementation Status
| Feature | Status | Completion |
|---|---|---|
| F1 Auth | Code complete — pending Firebase project + mobile acceptance test | 80% |
| F2 Teams | Not started | 0% |
| F3 Manual logging | Not started | 0% |
| F4 GPS recording | Not started | 0% |
| F5 Gemini plans | Not started | 0% |
| F6 Dashboard | Not started | 0% |
| F7 PWA/offline | Not started | 0% |
| F8 Notifications (stretch) | Not started | 0% |
**Overall MVP completion: ~10% · Production readiness: 1/10**

## 8. Next Implementation Priority
**Complete F1 acceptance:** create the Firebase project (see README "Firebase setup"), fill `.env.local` with real config, deploy rules, then run the Part D verification checklist in the build plan (desktop + mobile via hosting preview channel). Then **F2 — Team Creation & Join** with full §5 security rules. Command to resume: *"build the next feature"*.
