

## Real root causes (this time, for sure)

I went through every file again and I think I finally see what's happening. There are **three separate bugs** still alive — none of our previous fixes attacked them directly:

### Bug 1: VitePWA service worker is hijacking the proxied video stream on mobile

`vite.config.ts` registers `VitePWA({ registerType: "autoUpdate" })`. On the published `.lovable.app` site (not the preview iframe), this **installs a service worker that uses Workbox's default network-first navigation handler**. As soon as you save a video offline:
- the player calls `getProxiedVideoUrl(...)` → returns a Supabase edge function URL
- the `<video>` requests bytes from that URL
- on mobile Chrome/Brave/Safari, the service worker intercepts the request, the response stream gets aborted partway, the `<video>` element fires `error`, **and `registerType: "autoUpdate"` then triggers a `skipWaiting`+`clients.claim` cycle that *reloads the page*** — which is exactly the "constant refresh" you keep seeing.
- This only happens after a video is downloaded because that's when the `<video>` element first encounters a long-lived range request through the SW.

`main.tsx` only unregisters the SW inside the preview iframe — on your real phone (the published URL) the SW is fully active.

**Fix:** Stop registering a service worker entirely. We don't need it: offline videos live in IndexedDB, the dashboard cache lives in localStorage. The SW only adds risk. We'll remove `VitePWA` from `vite.config.ts` and have `main.tsx` always unregister any leftover SW + clear caches on first load.

### Bug 2: Loading the video through the edge-function proxy on mobile keeps timing out / 401-ing

`getProxiedVideoUrl` returns a URL like `https://<project>.supabase.co/functions/v1/video-proxy?url=...`. The `<video>` element fetches it **without** an `Authorization` header (you can't add headers to a `<video src>` request). The edge function checks `req.headers.get("authorization")` → returns `401 Unauthorized` → `onError` fires.
- For initial play this still "kind of works" because some browsers retry, but on mobile it just dies.
- We're paying the cost of the proxy (which only exists for CORS) for direct-MP4 URLs that don't actually need it.

**Fix:** For playback (not download), point `<video src>` straight at `video.video_url`. The proxy stays only for the download path, where we *can* attach the bearer token via `fetch`. If a particular host has CORS issues for streaming, we'll fall back to the proxy with the access token in the query string and have the edge function accept either header *or* `?token=` param.

### Bug 3: The downloaded file is being saved before we know it's a real video

The current downloader rejects HTML/JSON content types and tiny blobs, but if the upstream sends `application/octet-stream` for an HLS playlist or a partial response, we still save it. Then `<video>` can't decode it → error → reload (Bug 1) again. Plus, on mobile, the m3u8→MP4 path in `video-proxy` sometimes returns the playlist itself, not the MP4.

**Fix:** Before writing anything, do a `video.canPlayType()` check on the blob via a hidden `<video>` element. If the browser can't even read metadata, throw and clean up.

### Bug 4 (smaller): Player effects re-run and re-create the blob URL

`PlayerControls` recreates the `objectURL` whenever `loadSource` runs (mount, after download, after remove). Combined with Bug 1 this contributes to the reload loop. We'll only call `loadSource` exactly once per `video.id`, and after a download we'll just set the existing blob URL without going through the whole flow again.

---

## The plan

### A. Kill the service worker
- Remove `VitePWA` from `vite.config.ts` entirely.
- In `main.tsx`, always unregister all service workers and `caches.keys().then(k => k.forEach(c => caches.delete(c)))` on every load. This cleans up the SW that's already installed on users' phones from previous visits.

### B. Stop proxying playback
- `PlayerControls.loadSource`: if a verified offline blob exists → blob URL; else → `video.video_url` directly. No proxy call for playback.
- Keep the proxy only for `downloadVideo` (where we send the auth header via `fetch`).

### C. Bulletproof the downloader
- Keep current content-type and size checks.
- Add a final "can the browser actually decode the first frame" check: create a hidden `<video>`, set `src = URL.createObjectURL(blob)`, wait for `loadedmetadata` or fail within 5s. If fail → throw, clean up, surface error to the user.
- Only after this check, write blob + meta to IndexedDB.

### D. Lock the player to one source per mount
- `useEffect([video.id])` runs `loadSource` exactly once.
- After a successful download, instead of re-running `loadSource`, directly `URL.createObjectURL(savedBlob)` and `setVideoSrc(...)` once. Track the previous object URL in `objectUrlRef` and revoke it.
- Remove the `onError → setLoadError` retry since with the SW gone and direct URLs, errors should be real and surfaced (not retried into a loop).

### E. Auth/access — one tiny additional safety
- `useAccessControl` is already correct (cached role wins, never demote on network error). Leaving it. Only addition: when `authLoading` is `false` and `user` is `null` *but* a cached user exists (edge case if Supabase auth lib clears the cached session offline), keep showing the loader for one more tick instead of bouncing to Login. This stops the "Access Pending"/"Login" flash on airplane-mode reloads.

### F. Verification you can do on your phone
1. Hard-reload the site once with internet to flush the old SW.
2. Open DevTools (or just trust it) — confirm there's no SW registered.
3. Save a video offline → click play with internet → no reloads, video plays from blob.
4. Airplane mode → reload → dashboard shows, no Access Pending screen.
5. Click the offline video → plays from blob.
6. Remove offline → still in airplane mode → click → see clean "offline copy unavailable" message, not a reload loop.

### Files I'll touch
- `vite.config.ts` — drop VitePWA
- `src/main.tsx` — unconditionally unregister SW + clear caches
- `src/components/PlayerControls.tsx` — direct URL playback, single load, no error retry
- `src/lib/opfs.ts` — unchanged structure, add blob playability check helper
- `src/hooks/useOfflineVideo.ts` — call the playability check before saving
- `src/App.tsx` / `src/hooks/useAccessControl.ts` — small "don't bounce on offline auth flicker" guard

### What I'm explicitly NOT doing
- Not reintroducing encryption.
- Not adding a fancy fullscreen library.
- Not touching the library page caching (it's working).
- Not touching the edge function for now (it stays usable for downloads).

If anything in this plan is unclear, say so before I start; otherwise approve and I'll implement exactly this.

