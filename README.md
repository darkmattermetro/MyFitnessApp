# OpenFit

OpenFit is an Expo React Native fitness tracker for Android, iOS, and web. It combines meal and workout logs, weight tracking, Health Connect activity, and optional AI assistance.

## Current features

- **Dashboard:** dark interface, animated step/calorie/hydration rings, loading skeletons, weekly activity charts, and source-aware step totals.
- **Meals:** text logging or photo capture/gallery selection; AI nutrition estimates are reviewed and editable before saving. Values are validated and AI estimate warnings are shown.
- **Workouts:** workout templates and exercise logging, plus an AI home-workout coach.
- **Health Connect:** Android reads granted steps, active calories, and sleep. Web cannot access Health Connect. Google Fit web integration remains legacy and depends on OAuth configuration; it is not the source used by the Android Health Connect bridge.
- **Privacy:** in-app policy, AI consent before the first AI request, device-secure BYOK storage on native, export, and account deletion flow.
- **Calorie suggestion:** authenticated server-side Gemini review can propose a small next-day adjustment for a weight-loss goal. It is stored for review; the user must confirm before their calorie goal changes.
- **Gamification:** achievement badges and daily activity tracking.

AI nutrition and coaching are estimates. Basic meal, activity, and workout logging works without AI.

## Stack and requirements

- Expo SDK 58, React Native 0.88, React Navigation 7, Supabase, Reanimated, and `react-native-gifted-charts`.
- Node.js **22.13.0 or newer** (the installed Expo SDK 58/RN toolchain requires Node 22).
- npm, Android Studio/Android SDK for local native builds, and an Expo account for EAS cloud builds.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for account/cloud mode. Without these, the app uses local demo data.
3. Start the app with `npm start`, or use `npm run web` for the browser. Health Connect requires a custom Android build; Expo Go and the web build cannot read it.
4. Add an optional Gemini key in Profile for device-side AI features. The app requests consent before sending relevant food text/images or coaching context to Google Gemini. On native, BYOK is stored using SecureStore; on web it uses browser storage. The AI provider's own quotas and billing apply. Rotate or remove the key from Profile. Existing keys in the legacy Supabase profile column are copied to the device on profile load and cleared from that column after migration 0009 is installed.

## Database and backend setup

Migrations `0008`–`0012` add atomic activity updates, stricter ownership policies and key migration, step provenance, calorie suggestion storage, and idempotent food/workout submissions. For an existing database, apply only migrations not already applied, in numeric order. This repository's `npm run db:migrate` script can apply pending files if its configured Supabase access token/project details are present; otherwise use the Supabase SQL Editor. **Review the SQL against your project before applying it.** No production database changes are applied by this repository automatically during builds.

Deploy the following functions yourself after applying the migrations:

- `delete-account`: authenticates the caller, removes only that user's records, removes files in that user's storage folder, then deletes the Auth account. Set the function's `SUPABASE_SERVICE_ROLE_KEY` server secret. Never add it to an `EXPO_PUBLIC_` variable or client build.
- `suggest-next-day-calories`: reads only the authenticated user's profile and activity, and calls Gemini using the server secret `GEMINI_API_KEY`. Configure the Supabase function secrets `GEMINI_API_KEY` and normal Supabase function environment. The Edge Function uses the service-role key only server-side for its private suggestion cache. The function proposes a bounded change; the user confirms it in Profile.

Example after reviewing and configuring the Supabase CLI project:

```bash
supabase functions deploy delete-account
supabase functions deploy suggest-next-day-calories
supabase secrets set GEMINI_API_KEY=your_server_key
```

Do not deploy the functions or migrations until they are reviewed for your production project. The in-app BYOK key is separate from the server-side key needed by the calorie suggestion function.

## Web hosting

Build with `npm run export:web`; the static output is `dist/`. On Vercel, set the build command to `npm run export:web`, output directory to `dist`, and add `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_ANON_KEY` to each desired environment. `EXPO_PUBLIC_` variables are bundled at build time. Netlify is also configured to publish `dist/`. Add the deployed URLs to Supabase Auth redirect allow-lists when using email authentication.

The Google Fit OAuth settings in `src/config.js` are legacy web-only support. No cloud “Google Health API v4” OAuth endpoint is configured. Android activity data comes from Health Connect on-device and syncs to Supabase when configured.

## Android build and updates

The app is at version **1.1.0** with Android `versionCode` **4**. Preview builds are internal APKs on the `preview` EAS channel and use the `preview` environment. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS `preview` so an installed APK can sign in and sync to the same cloud account as the website. Vercel variables are separate from EAS variables.

```bash
npx eas-cli login
npm run build:apk
```

EAS produces a build URL; download the APK from that build page. The native camera, Health Connect and rationale configuration requires a new native build. Later JavaScript/style changes compatible with the installed native runtime can use `npm run update:preview`; production OTA uses `npm run update:production`. Expo Updates only applies a bundle with the matching runtime version and update channel. Native modules, permissions, or native config changes need another APK.

## Checks

- `npm test` runs regression tests for nutrition validation, step-source reconciliation, export redaction, serialized activity patches, and migration/backend safeguards.
- `npm run export:web` verifies a static web bundle can be generated.

## Project layout

- `src/screens/`, `src/components/`: app screens and UI.
- `src/services/`: Supabase/demo APIs, authentication, Health Connect, Gemini and consent.
- `src/utils/`: nutrition validation, export, and step reconciliation.
- `supabase/migrations/`: reviewed database changes.
- `supabase/functions/`: deployable server functions.
- `plugins/`: generated Android Health Connect rationale screen.

## References

- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Expo EAS Update runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Android Health Connect permissions rationale](https://developer.android.com/health-and-fitness/health-connect/get-started)
