# Kokoda Tracker

Mobile-first PWA for a team training for the Kokoda Challenge Brisbane (June 2027).
The single source of truth is [MVP-SPEC.md](MVP-SPEC.md) — every feature traces back to it.

**Stack:** React 18 · TypeScript · Vite · MUI v5 · Redux Toolkit + RTK Query · Formik + Yup · Firebase (Auth, Firestore, Hosting) · vite-plugin-pwa

## Getting started

```bash
npm install
npm run dev
```

The app boots with the placeholder values in `.env.local`, but auth will not work
until a real Firebase project is wired up (below).

## Firebase setup (one-time)

Manual steps in [console.firebase.google.com](https://console.firebase.google.com):

1. **Add project** → name `kokoda-tracker` (Analytics optional).
2. **Build → Firestore Database → Create** → production mode → location
   `australia-southeast1` (Sydney — permanent choice, closest to Brisbane).
3. **Build → Authentication → Sign-in method** → enable **Email/Password** and
   **Google** (set public-facing name + support email).
4. Authentication → Settings → **Authorized domains**: confirm `localhost`,
   `<project>.firebaseapp.com`, `<project>.web.app` are present (defaults).

Then from the repo root:

```bash
npx firebase login
```

```bash
npx firebase apps:create web "Kokoda Tracker Web"
```

```bash
npx firebase apps:sdkconfig web
```

Copy the printed config values into `.env.local` (see `.env.example` for the
key names), and put the real project id in `.firebaserc`. Then deploy the
security rules **before the first sign-in**:

```bash
npm run deploy:rules
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build (PWA manifest + service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run emulators` | Firebase Auth + Firestore emulators (requires Java; set `VITE_USE_EMULATORS=true`) |
| `npm run deploy:rules` | Deploy `firestore.rules` |
| `npm run deploy:hosting` | Build + deploy to Firebase Hosting |

For mobile testing of Google sign-in use a hosting preview channel (LAN IPs
cannot be added to Firebase authorized domains):

```bash
npx firebase hosting:channel:deploy f1-test
```

## Project conventions

- Build vertically, one feature at a time, in spec priority order (F1 → F8).
- All colours via MUI theme tokens (`src/theme/theme.ts`) — never hardcoded.
- All Firestore access through RTK Query endpoints injected into
  `src/services/baseApi.ts` — components never call Firestore directly.
- Forms are Formik + Yup; Yup schemas mirror Firestore rules.
- Every page renders the shared `SEO` component and uses the common
  components in `src/components/common/`.
- After a feature passes acceptance, update MVP-SPEC §6 (risks/debt) and §7 (status).
