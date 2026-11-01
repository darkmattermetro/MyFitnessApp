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

Smartwatch connectivity is not supported: there is no watch sync, and no data is imported from wearables.

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

Both platforms are pre-configured in this repo: `vercel.json` and `netlify.toml` already set the build command, the `dist/` output and Node 20. Import the repository and deploy; add the Supabase variables only if you want cloud accounts instead of demo mode.

## Demo mode

With no database or Supabase setup, all data lives in the browser (localStorage) and sample data is created on first launch (meals, weights, preferences and workouts).

- Enabled with `EXPO_PUBLIC_DEMO_MODE=true`, or automatically when Supabase is not configured (handy for a test deploy without variables).
- No login: the app goes straight in with a demo user.
- Gemini AI still works: add your API key in the Profile tab.
- The Profile tab has a "Reset demo data" action to return to the sample data.
- A bar at the top shows whether the app is running in demo or production mode.

## Security

- Migrations enable Row Level Security: each user can only access their own data.
- The Supabase `service_role` key is never used or stored in the repo.
- Each user's Gemini API key is stored in their own `users` row.
