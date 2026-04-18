
Root cause looks like a combination of two problems in the current code:

1. Offline access is not truly centralized:
- `App.tsx` calls `useAuth()` and `useAccessControl()`
- `useAccessControl()` calls `useAuth()` again internally
- `VideoLibrary` also calls both hooks again
This creates multiple independent auth/access states. On mobile reload in airplane mode, one instance can resolve to “no access” before another restores the cached session, which matches the jump to the Access Pending screen.

2. The offline download can still be “marked offline” without guaranteeing a playable video blob:
- `useOfflineVideo.ts` accepts almost any non-tiny blob
- the download path can still save a bad response/body and metadata
- then `VideoPlayer.tsx` finds metadata, but `PlayerControls.tsx` may not get a valid playable blob, causing the loading spinner / failure path

Plan to fix it in the simplest possible way:

1. Unify auth/access state
- Create a single shared auth/access provider or app-level context.
- `useAccessControl` should consume the existing authenticated user/session instead of calling `useAuth()` internally.
- `AppRoutes` should wait for one authoritative auth+access result before routing.
- If offline and a cached approved role exists, keep access granted and never downgrade to Access Pending unless the server later explicitly confirms no role.

2. Make offline playback depend on actual blob existence, not just metadata
- Tighten the offline storage API so the app only treats a video as offline if the actual blob exists and is readable.
- In `VideoPlayer`, prefer local metadata only when a real offline blob is present.
- If offline and metadata exists but blob is missing/corrupt, show a clear “offline copy unavailable” state instead of “Video not found”.

3. Harden the downloader
- In `useOfflineVideo.ts`, validate the response before saving:
  - reject HTML/text/error payloads
  - verify blob type and minimum viability more strictly
  - only save metadata after the blob is successfully stored
- If a download fails, remove any partial/corrupt offline entry completely.

4. Simplify the player further
- Keep the “single source per mount” rule in `PlayerControls.tsx`.
- On mount:
  - if a verified offline blob exists, use blob URL
  - otherwise use network URL
- Add a small load/error state so failed blob playback does not silently spin forever.

5. Make library-to-player offline navigation deterministic
- In `VideoLibrary`, when a card is marked offline, route to the player with enough local data to open immediately.
- In `VideoPlayer`, if offline, skip the backend fetch entirely once a verified offline entry is found.
- This removes the current mixed path where the page partly depends on backend availability during offline playback.

6. Files to update
- `src/App.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useAccessControl.ts`
- `src/hooks/useOfflineVideo.ts`
- `src/lib/opfs.ts`
- `src/pages/VideoLibrary.tsx`
- `src/pages/VideoPlayer.tsx`
- `src/components/PlayerControls.tsx`

7. Verification after implementation
- Download a video on mobile
- Wait for completion
- Enable airplane mode
- Open the video from the overview without reloading
- Reload the app still in airplane mode
- Confirm:
  - dashboard still opens
  - no Access Pending redirect
  - offline video opens and plays
  - no reload loop
  - removing offline copy restores normal online-only behavior

Technical note:
The biggest architectural fix is removing duplicated hook instances and replacing “offline by metadata” with “offline only if verified blob exists”. That should address both symptoms you reported from the same root cause.