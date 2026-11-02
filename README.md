# OpenFit

A personal fitness app for tracking meals, weight and gym workouts. One codebase for Android, iOS and web (React Native + Expo).

## Features

- **AI meal logging**: describe what you ate in everyday language ("two scrambled eggs and a coffee with milk") or upload a photo, and the AI turns it into nutritional data (kcal, protein, fat, carbs) before you save it.
- **Today dashboard**: calories and macros for the day vs. your goals, this week's training summary, and your latest weight.
- **Meal history**: meals grouped by day, with editing and deletion.
- **Workout logging**: start an empty session or a template (push, pull, legs, upper, full body, home). Log weight and reps per set, use the rest timer, add custom exercises, finish or discard a session, and review past workouts.
- **Personal records**: your heaviest set for each exercise, plus volume, sets and minutes per week.
- **Weight**: entries with date and time plus a trend chart.
- **Profile**: calorie goal, weight goal, personal data, BMI/calorie calculator and your own Gemini API key (BYOK).
- **Fitness imports**: Android reads daily steps from Health Connect; Google Fit can sync steps, distance, total calories burned, Move Minutes and Heart Points where its OAuth setup is available.

AI nutrition values are estimates. When a user invokes Gemini, the app sends the relevant meal text or photo, saved food preferences, or coach context and recent messages to Google. In account mode, the Gemini key is stored in the user's Supabase profile; in demo mode, it is stored in that browser.

## Stack

- **Frontend**: React Native with Expo SDK 54, react-native-web (web), React Navigation.
- **Backend**: Supabase (Auth + PostgreSQL with Row Level Security).
- **AI**: Gemini API, called directly from the app with the user's own API key.

## Requirements

- Node.js 18+
- A [Supabase](https://supabase.com) account (for cloud mode)
- Expo Go on your phone (optional, for development on a device)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` file from the template:

   ```bash
   copy .env.example .env
   ```

   Fill in the values from your Supabase project (Project Settings > API):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Without these values the app automatically runs in demo mode with local data.

3. Apply the database migrations (requires a Supabase access token):

   ```bash
   setx SUPABASE_ACCESS_TOKEN "sbp_your_token"
   node scripts/run-migration.js
   ```

   Or paste the SQL files from `supabase/migrations/` into the Supabase SQL Editor, in order. `0005_workouts.sql` creates the `workout_sessions` table and is required for workout logging in cloud mode.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run web` | Open the app in the browser |
| `npm run android` | Run on Android (Expo Go / emulator) |
| `npm run ios` | Run on iOS (Expo Go / simulator) |
| `npm run export:web` | Build the static web app (`dist/`) |
| `npm run logo` | Regenerate app icons from `assets/logo2.svg` |
| `npm run build:apk` | EAS preview APK build |
| `npm run build:android` | EAS production Android build |
| `npm run build:ios` | EAS production iOS build |

## Structure

```
src/
  screens/       Dashboard, Food, History, Workout, Weight, Profile, Auth
  components/    Shared UI, chart, dialogs, exercise picker, etc.
  services/      Supabase client, auth, API and local storage
  data/          Exercise catalog and workout templates
  theme/         Colors and global styles
  navigation/    Bottom-tab navigation
  utils/         Nutrition and workout helpers
supabase/
  migrations/    SQL for schema, auth (RLS) and workouts
scripts/         Utilities (migrations, icon generation)
```

## Web deployment

The web build is a static app generated with `expo export --platform web`, ready for static hosting (Vercel, Netlify, etc.).

On Vercel:

1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
2. Use `npm run export:web` as the build command and `dist/` as the output directory.
3. Add your domain URL to the Auth redirect allow-list in Supabase.
4. To show Google Fit step data, add `EXPO_PUBLIC_GOOGLE_FIT_WEB_CLIENT_ID` in **Vercel → Project Settings → Environment Variables**, then redeploy. `EXPO_PUBLIC_` values are compiled into the site at build time.
5. In Google Cloud Console, enable the Fitness API for an eligible project and create a Web OAuth client. Add your production and preview site origins under **Authorized JavaScript origins**, and add the exact site origin as an authorized redirect URI. The origin must match the deployed site, including `https` and any custom domain.
6. Add the same value to `.env` for local web development. The Android and iOS client IDs are separate and are only used by native builds.

If the page reports that the Google web client ID is missing, the client ID is not present in the Vercel build. Add it to the correct Vercel project/environment and redeploy. If Google returns no activity data, confirm the signed-in Google account is the one receiving Fit data, that the Fitness API is enabled, and that the account has granted the activity read scope. The Profile card syncs the last 7 days at most once per day when opened and can also sync on demand. It displays steps, distance, calories burned, Move Minutes and Heart Points. These use the activity read permission already requested by the app; additional categories such as sleep, heart rate, nutrition and body measurements need separate user consent and should only be added with matching app features.

**Google Fit platform status:** Google has announced that the Google Fit APIs, including its REST API, will be deprecated in 2026, and new projects have been unable to sign up since May 1, 2024. Google recommends the Google Health API for cloud integrations or Health Connect for Android-first step tracking. This legacy integration may stop returning data as Google retires the API; see the [official Google Fit overview](https://developers.google.com/fit/overview) before relying on it for a new production integration.

Both platforms are pre-configured in this repo: `vercel.json` and `netlify.toml` already set the build command, the `dist/` output and Node 20. Import the repository and deploy; add the Supabase variables only if you want cloud accounts instead of demo mode.

## Updating installed apps

Web changes deploy through Vercel as usual. For compatible JavaScript and styling updates to an already-installed Expo app, publish an EAS Update with `npm run update:preview` or `npm run update:production` after reviewing the release. Updates must match the installed native runtime and channel. Changes to native packages, permissions, app configuration, or native code still require a new APK/AAB build. See [Expo EAS Update runtime versions](https://docs.expo.dev/eas-update/runtime-versions/) and [deployment](https://docs.expo.dev/eas-update/deployment/).

## Android Health Connect

Health Connect is available only in the Android app on supported devices (Android 9 or later with Google Play services). Open **Profile → Health Connect** and allow OpenFit to read steps, active calories, and sleep. The dashboard summarizes those values by day for the last week. Make sure your tracker is writing data into Health Connect.

Health Connect uses native Android code, so Expo Go and the Vercel web app cannot access it. After adding or changing this integration, create and install a new Android development or production build (for example, `npm run build:apk`). The app config includes the Health Connect plugin, step read permission, and the Android minimum SDK requirement. Users can manage or revoke access from the Health Connect permissions screen.

For Android builds to show account login and sync to the same Supabase database as the website, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the matching EAS environment (`preview` for `npm run build:apk`, `production` for `npm run build:android`). These build-time variables are embedded into the app. Vercel environment variables are separate and are not automatically copied to EAS. Without the Supabase values, the Android app intentionally opens in demo mode and keeps data on the device.

The dashboard uses `react-native-gifted-charts` for weekly Health Connect charts and Reanimated for rings and loading skeletons. Run `npm run db:migrate` (or apply `supabase/migrations/0007_gamification.sql` in the Supabase SQL editor) to enable cloud achievement badges.

## Demo mode

With no database or Supabase setup, all data lives in the browser (localStorage) and sample data is created on first launch (meals, weights, preferences and workouts).

- Enabled with `EXPO_PUBLIC_DEMO_MODE=true`, or automatically when Supabase is not configured (handy for a test deploy without variables).
- No login: the app goes straight in with a demo user.
- Gemini AI still works: add your API key in the Profile tab.
- The Profile tab has a "Reset demo data" action to return to the sample data.
- A bar at the top identifies demo mode. Demo logs stay on the device, while Gemini and Google Fit still require internet access.

## Security

- Migrations enable Row Level Security: each user can only access their own data.
- The Supabase `service_role` key is never used or stored in the repo.
- Each user's Gemini API key is stored in their own `users` row.
- Gemini requests send the API key in an HTTP header. Meal photos/text, saved preferences, and coach context are sent to Gemini only when the corresponding AI action is used.
- For password recovery, add the production and preview site origins to Supabase Auth's allowed redirect URLs.
