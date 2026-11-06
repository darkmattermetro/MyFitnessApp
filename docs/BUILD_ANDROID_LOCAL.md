# Local Android (Android Studio) build + EAS side-by-side

This project is an Expo SDK 58 app (`expo` + `react-native 0.88`). It can be built in two ways that coexist:

1. **Local** with Android Studio / Gradle on your laptop (uses the generated `android/` folder).
2. **Cloud** with EAS (`eas build`), which runs `expo prebuild` on Expo's servers.

Because `/android` and `/ios` are gitignored, EAS never sees your local native folder and always regenerates it from `app.json` + config plugins. That is what keeps the two paths from fighting each other.

## Prerequisites (already installed)

- Node.js >= 22.13.0 (installed: v26)
- JDK 17 (installed: Microsoft JDK 17 at `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`)
- Android SDK at `C:\Users\91801\AppData\Local\Android\Sdk` (platforms android-37, build-tools 36/37, NDK 27)
- Android Studio at `C:\Program Files\Android\Android Studio`

Environment variables (set at user level, persistent):
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` = `C:\Users\91801\AppData\Local\Android\Sdk`
- `JAVA_HOME` = `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`

Open a new terminal after setting them.

## Local build with Android Studio

1. Make sure native project exists and is in sync with `app.json`:
   ```
   npm run prebuild:android
   ```
   (runs `expo prebuild --platform android --clean`). Re-run this whenever you change `app.json`, plugins, or SDK version.

2. Open the `android/` folder in Android Studio:
   - File -> Open -> `E:\opencodetest\Fitness app\android`
   - Wait for Gradle sync to finish.

3. Build APK:
   - Debug: Build -> Build Bundle(s) / APK(s) -> Build APK(s)
     - Output: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Or from terminal:
     ```
     npm run build:android:local:debug
     ```

4. Install on a connected device/emulator:
   ```
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

## Release APK locally (signed)

By default `android/app/build.gradle` signs release with the debug keystore. For a real release APK signed like EAS:

Option A (recommended, keeps EAS as source of truth for signing):
1. Download the EAS keystore:
   ```
   eas credentials
   ```
   choose Android -> production -> Download keystore, save as `android/app/openfit-release.keystore`.
2. Add to `android/gradle.properties` (do NOT commit these):
   ```
   OPENFIT_STORE_FILE=openfit-release.keystore
   OPENFIT_STORE_PASSWORD=...
   OPENFIT_KEY_ALIAS=...
   OPENFIT_KEY_PASSWORD=...
   ```
3. Update `signingConfigs.release` in `android/app/build.gradle` to use those properties.
4. Build:
   ```
   npm run build:android:local:release
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`

Option B: keep debug signing for local testing only; use EAS for store releases.

Never commit keystores or passwords. `*.keystore`/`*.jks` are already gitignored.

## EAS side-by-side (unchanged)

- Preview APK: `npm run build:apk` -> `eas build -p android --profile preview` (produces APK)
- Production AAB/APK: `npm run build:android` -> `eas build -p android --profile production`
- OTA updates: `npm run update:preview` / `npm run update:production`

EAS regenerates native code from `app.json` on its servers, so it does not depend on your local `android/` folder.

## Keeping the two in sync

- Source of truth for native config: `app.json` + `plugins/*` (e.g. `plugins/withHealthConnectRationale.js`).
- After changing native config, run `npm run prebuild:android` locally, test in Android Studio, then push. EAS will regenerate the same on next build.
- Prefer config plugins over hand-editing files under `android/`. Hand edits are lost on `--clean` prebuild and are not reflected in EAS builds.
- If you must hand-edit native code and want it in EAS builds, remove `/android` from `.gitignore`, commit the folder, and EAS will use the committed native project instead of prebuilding. (Then you own keeping it in sync.)
- Bump `versionCode` in `app.json` (android.versionCode) for every release; EAS and local both read it on prebuild.

## Current status

- `android/` generated and Gradle sync works offline for cached deps.
- First debug build triggered; needs network to fetch a few missing deps (kotlin-parcelize-runtime 2.0.0, firebase-annotations 16.0.0). Run with network access.
- Health Connect minSdk = 26 (set via expo-build-properties), so the app requires Android 8.0+.

## Quick reference

| Goal | Command |
|---|---|
| Regenerate native project | `npm run prebuild:android` |
| Open in Android Studio | open `android/` folder |
| Debug APK (local) | `npm run build:android:local:debug` |
| Release APK (local) | `npm run build:android:local:release` |
| Preview APK (EAS) | `npm run build:apk` |
| Production build (EAS) | `npm run build:android` |
| OTA update (preview) | `npm run update:preview` |
