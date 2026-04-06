

# Encrypted Offline Video PWA — Updated Plan

## Design System: Elegant Neumorphism

White background (#f0f0f3) with soft inset/outset shadows creating depth. No harsh borders — depth comes from light/shadow pairs only.

**Shadow tokens:**
- Raised: `shadow-[6px_6px_12px_#d1d1d4,-6px_-6px_12px_#ffffff]`
- Inset/pressed: `shadow-[inset_4px_4px_8px_#d1d1d4,inset_-4px_-4px_8px_#ffffff]`
- Hover: scale(1.02) + slightly deeper shadow, 200ms ease

**Colors:** Near-white bg `#f0f0f3`, foreground `#2d3436`, muted text `#636e72`, accent `#6c5ce7` (soft purple). All controls use neumorphic raised/pressed states.

**Typography:** Inter font, clean weights (400/500/600).

**Animations:**
- Page transitions: fade-in with subtle translateY (10px → 0, 300ms)
- Buttons: pressed state = inset shadow on click, 150ms
- Cards: hover lifts with deeper shadow + scale(1.02), 200ms
- Video controls: smooth opacity transitions on hover
- Download progress: animated gradient shimmer on progress bar
- Toast notifications: slide-in from top with fade

---

## Pages

### 1. Login / Request Access
- Centered neumorphic card on clean white canvas
- Soft tab toggle between "Login" and "Request Access"
- Inputs with inset neumorphic styling
- Submit button with raised → pressed state on click
- Pending access state: subtle pulsing icon + message

### 2. Video Library
- Grid of neumorphic video cards with thumbnail, title, duration
- Offline status badge (soft pill shape)
- Download button with circular progress indicator
- Hover: card lifts with deeper shadow

### 3. Video Player
- Full-width player area with neumorphic container
- Custom controls bar: play/pause, seek, volume slider, audio output dropdown
- All controls use neumorphic raised/pressed styling
- "Save Offline" toggle button with smooth state transition
- Download progress shown as neumorphic progress bar with shimmer

### 4. Admin Panel
- Tab navigation: Requests | Users | Videos
- Neumorphic list items for each entry
- Accept/Reject and Revoke buttons with color-coded soft shadows
- Add video form with neumorphic inputs

---

## Technical Architecture (unchanged from prior plan)

### Auth & Access Control
- Supabase Auth (email/password)
- `access_requests` table, `user_roles` table with RLS
- `has_role()` security definer function

### Encrypted Offline Storage
- OPFS for large file storage (up to 3GB per video)
- AES-256-GCM via Web Crypto API, chunk-based encrypt/decrypt
- Keys in IndexedDB, tied to session; deleted on access revocation

### PWA
- `vite-plugin-pwa` for installability and app shell caching
- Service worker handles offline detection and playback switching

### Video Player
- HTML5 video with custom neumorphic controls
- `setSinkId()` for audio output selection
- Stream from URL or decrypt from OPFS based on connectivity

---

## File Structure (new files)

```
src/
  pages/
    Login.tsx
    VideoLibrary.tsx
    VideoPlayer.tsx
    Admin.tsx
  components/
    NeuCard.tsx          (reusable neumorphic card)
    NeuButton.tsx        (raised/pressed button)
    NeuInput.tsx         (inset input)
    VideoCard.tsx
    PlayerControls.tsx
    AudioOutputSelector.tsx
    DownloadButton.tsx
    AccessRequestList.tsx
    UserList.tsx
    VideoManager.tsx
  hooks/
    useOfflineVideo.ts   (OPFS + encryption logic)
    useAuth.ts
    useAccessControl.ts
  lib/
    crypto.ts            (AES-GCM encrypt/decrypt)
    opfs.ts              (OPFS read/write helpers)
  service-worker.ts
```

### Supabase Tables
- `access_requests` (id, email, status, created_at)
- `user_roles` (id, user_id, role)
- `videos` (id, title, thumbnail_url, video_url, duration, created_at)

