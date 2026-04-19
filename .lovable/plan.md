

## Real cause of the reload loop (now confirmed)

The trigger you described — "as soon as I make the video available offline, click play, the website reloads" — happens **only after** a download succeeds. Walking through the code with that in mind, the reload comes from one place: `saveOfflineVideo` in `src/lib/opfs.ts` calls `isBlobPlayableVideo(blob)` BEFORE saving. That helper:

1. Creates a hidden `<video>` element
2. Sets `src = URL.createObjectURL(blob)` for the **full downloaded video** (often hundreds of MB on mobile)
3. Calls `video.load()` implicitly to read metadata

On mobile (iOS Safari, Android Chrome/Brave), creating a second `<video>` element pointing at a huge in-memory Blob, in the same tab where another `<video>` is about to mount, causes the browser to either:
- Crash the tab → mobile browser auto-reloads the page (looks like a refresh loop), or
- Keep the renderer alive but corrupt the MediaSource state of the next `<video>`, which then errors → our `onError` sets `loadError` → on next interaction the user reloads → infinite loop.

This is the "I save a video, click play, page reloads" you're seeing. It is not the service worker, not auth, not the proxy. It is our own playability check thrashing mobile memory.

On top of that, there are two smaller bugs that make the whole thing fragile:

- `PlayerControls.loadSource` runs on `[video.id]` but the `useCallback` deps include `getOfflineVideoBlob` and `video.video_url`. Because `getOfflineVideoBlob` is recreated on every `useOfflineVideo()` call (it's a new `useState`-bearing hook every render), the function identity is stable per render *of that PlayerControls*, but the surrounding `<video>` element re-creates a `URL.createObjectURL` on every mount, and after a download we re-render → re-create → revoke a URL the player is currently reading from. That contributes to the "video stops mid-load" behavior even when the page doesn't fully reload.
- You answered "Always use offline" — currently after download we *do* swap to the blob URL, but on a fresh navigation we go through `loadSource` again, and `isVideoOffline` is checked via `getOfflineVideoBlob(id)`. That works. We just need to make sure once a video is offline, the player **only** uses the blob URL and never falls back to the network URL while still online — your stated preference.

## The fix — minimal and dumb

### 1. Remove the playability pre-check entirely
- In `src/lib/opfs.ts`, delete `isBlobPlayableVideo` and stop calling it from `saveOfflineVideo`.
- Keep the existing checks: content-type rejection in the downloader, size > 100KB, blob round-trips through IndexedDB.
- Trust the browser: if the saved blob can't actually play later, the `<video>` will fire `error`, we show the existing "offline copy unavailable" message, and the user can re-download. We do not crash the tab trying to validate hundreds of MB up front.

### 2. Lock playback to "offline-first when downloaded"
You chose **Always use offline**. So in `PlayerControls.loadSource`:
- If a verified offline blob exists → use blob URL. (Already done.)
- If not and online → use `video.video_url` directly. (Already done.)
- If not and offline → show the error state. (Already done.)

I'll just tighten the rule and add one small thing: after `<video>` fires `loadeddata` once, we **stop** treating subsequent `error` events as fatal — they're typically transient seek/network blips on mobile and were causing the false reload-trigger when combined with bug #1.

### 3. Stabilize the player so one mount = one source = no re-creation of the blob URL
- Change `loadSource` to take `videoId` as an argument and depend only on it.
- Move `getOfflineVideoBlob` out of dependencies (read it directly from the imported `getOfflineVideo`).
- Run `loadSource` exactly once per `video.id` in `useEffect([video.id])`.
- After a successful download, the existing in-place swap stays. No second `loadSource`.

### 4. Tiny safety net for the error UI
- When `<video>` errors AND `videoSrc` is a blob URL AND we have not yet seen `loadeddata` → show the "offline copy unavailable, re-download" message (so a corrupted offline file is recoverable, not a perma-loop).
- When `<video>` errors after `loadeddata` → just log, don't toggle UI. This kills the visible "reload feeling".

### 5. No changes needed to
- `vite.config.ts` (already PWA-free)
- `main.tsx` (SW cleanup is fine)
- `useAuth.ts` / `useAccessControl.ts` / `App.tsx` (offline gating is correct)
- `videoProxy.ts` and the edge function (only used for downloads now)
- `VideoLibrary.tsx` / `VideoCard.tsx` (working)

### Files I will touch
- `src/lib/opfs.ts` — remove `isBlobPlayableVideo`, simplify `saveOfflineVideo`
- `src/components/PlayerControls.tsx` — single-mount load, soft error handling after `loadeddata`

### Why this should finally hold
Every previous attempt added more "verification" / "cleverness" on the offline path. That cleverness is what's killing mobile. The dumbest possible thing — just save the blob and let the `<video>` element do its job — is what we haven't tried yet on mobile because the playability check looked harmless on desktop. It is not harmless on a phone with limited memory.

### How to verify on your phone
1. Hard reload the site once with internet.
2. Click "Save Offline" on a video — wait for it to finish.
3. Click play. **Expected:** video plays from the blob, no reload, no flicker.
4. Airplane mode → reload → dashboard loads → click the video → it plays.
5. If a saved file is genuinely corrupt, you'll see "offline copy unavailable" with a way back to the library — no reload loop.

### What I am explicitly not doing
- No new dependencies.
- No re-introducing encryption or service workers.
- No fullscreen library.
- No changes to your design / UI.

