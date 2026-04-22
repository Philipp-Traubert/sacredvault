

## Goal
Stop the mobile crashes by moving offline video out of the browser entirely. Wrap the existing React app in **Capacitor**, store videos on the **native filesystem**, and play them with the **native video player**. Same codebase ships as a web app, an Android app (Play Store), and an iOS app (TestFlight / App Store).

## Why this works when PWA does not
| | PWA / Browser | Capacitor native app |
|---|---|---|
| Where video is stored | Cache API in browser sandbox (capped, evictable) | Real device filesystem (gigabytes, permanent) |
| Who downloads the file | JS `fetch` → memory pressure → tab crash | Native HTTP, streamed to disk, zero JS memory |
| Who plays the file | HTML `<video>` reading a blob: URL | Native `AVPlayer` (iOS) / `ExoPlayer` (Android) |
| Distribution | URL only | Play Store + TestFlight + URL |
| Crashes you're hitting | Yes | No — this is the standard architecture for offline video apps |

## What gets built

### 1. Capacitor shell around the existing app
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- `capacitor.config.ts` with appId `app.lovable.45df0f364b514a9886894e8bb9892c9d`, appName `sacredvault`, hot-reload pointed at the Lovable preview so you can keep iterating in Lovable and see changes on-device instantly
- The web app keeps working at `sacredvault.lovable.app` exactly as it does now

### 2. Native filesystem download & storage
- Add `@capacitor/filesystem` and `@capacitor/http` (or `CapacitorHttp` from core)
- New module `src/lib/nativeVideoStorage.ts` with the same surface area as the current `opfs.ts`:
  - `saveOfflineVideo(id, meta, url, authToken)` — uses `CapacitorHttp.downloadFile` to stream directly to `Directory.Data/videos/{id}.mp4`. Never touches JS memory.
  - `getOfflineVideoUri(id)` — returns a native `file://` or `Capacitor.convertFileSrc(...)` URL the `<video>` element can play directly
  - `deleteOfflineVideo(id)`, `isVideoOffline(id)`, `getAllOfflineVideoMetas()` — same as today
- Metadata stays in IndexedDB (small, fine on mobile)

### 3. Smart runtime switch — one codebase, two storage paths
- New `src/lib/platform.ts` exporting `isNative = Capacitor.isNativePlatform()`
- `useOfflineVideo` hook becomes a thin router:
  - On native → `nativeVideoStorage`
  - On web → existing `opfs.ts` (kept as-is for desktop browser users)
- `PlayerControls.tsx` gets a small change: when `isNative && offlineUri` → set `<video src={offlineUri}>` directly. No service worker, no blob URLs, no Range request games.

### 4. Remove the broken offline plumbing on native
- Service worker (`/offline-video-sw.js`) is **only** registered on web (already gated by `isNative` check)
- The synthetic `/offline-video/:id` URLs are not used on native at all
- No Cache API, no `tee()` streams, no Range slicing on native — those were the mobile crash sources

### 5. Distribution
You'll be able to:
- Keep using the web app at `sacredvault.lovable.app` (unchanged)
- Build Android APK / AAB locally → upload to Play Store internal testing
- Build iOS IPA in Xcode → upload to TestFlight
- The brothers install from TestFlight (iOS) or Play Store internal track (Android) — both support invite-only test groups

## Files I'll touch
- `package.json` — add Capacitor + filesystem deps
- `capacitor.config.ts` — new
- `src/lib/platform.ts` — new (1-line `isNative` helper)
- `src/lib/nativeVideoStorage.ts` — new (native download/play/delete)
- `src/hooks/useOfflineVideo.ts` — route to native or web storage
- `src/components/PlayerControls.tsx` — use native URI directly when on device
- `src/main.tsx` — only register the SW on web, not on native
- `src/lib/opfs.ts` — left as-is for the web build

## What you'll do once, after I'm done
Lovable can't run Xcode or Android Studio for you, so after I push the code you'll need to run these locally **once** to produce installable builds:

1. Export the project to your GitHub (one click in Lovable) and `git pull`
2. `npm install`
3. `npx cap add ios` and/or `npx cap add android`
4. `npm run build && npx cap sync`
5. `npx cap open ios` (Xcode) or `npx cap open android` (Android Studio) → Build → upload to TestFlight / Play Console

After that first setup, every future change you make in Lovable just needs `git pull && npx cap sync` to flow into the native apps. Hot-reload is configured so day-to-day UI changes show up on-device without rebuilding.

## What I'm explicitly NOT doing
- Not removing the web app — `sacredvault.lovable.app` keeps working for desktop
- Not changing any UI, colors, or auth flow
- Not touching the edge function or Supabase schema
- Not adding PWA / service worker behavior on mobile (it's the cause of the crashes)

## Reference
After this is in, you'll want to skim Lovable's Capacitor guide for the Xcode/Android Studio steps: https://lovable.dev/blog/2025-03-25-the-complete-guide-to-building-mobile-apps-with-lovable

