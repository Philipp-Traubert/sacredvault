# Wix Video Source Testing Plan

Prototype assumption: videos are currently hosted on Wix and accessed through direct download URLs before migration.

## Source URL requirements

- Use HTTPS direct media URLs only in production.
- Avoid HTML landing pages, embedded player pages, or URLs that return JSON redirects/errors.
- Confirm whether each URL is stable, signed, expiring, or user/session-bound.
- Do not put Wix admin credentials or API secrets in the mobile app.

## Manual test matrix

For each TEK and TATI sample video:

1. Open URL in a fresh/private browser and verify it returns video bytes, not a Wix page.
2. Check response headers:
   - `content-type` should be `video/*` or `application/octet-stream`.
   - `content-length` should be realistic for the file.
   - Range requests should work if the player relies on seeking.
3. Add the video through the admin path / database.
4. Log in as a TEK-only user and verify only TEK videos appear.
5. Log in as a TATI-only user and verify only TATI videos appear.
6. Download on Android over Wi-Fi.
7. Turn on airplane mode.
8. Relaunch app and verify downloaded video appears/plays.
9. Verify the file does not appear in Gallery/Photos/Downloads.
10. Delete in app and verify offline playback no longer works.

## Automated checks to add later

- Supabase RLS tests for TEK/TATI separation.
- Edge-function/proxy tests if Wix URLs are hidden behind Supabase.
- Android instrumentation test for download/play/delete once native toolchain and a device/emulator are available.
