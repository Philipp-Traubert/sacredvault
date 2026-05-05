# Tomorrow Todo — Sacred Video Vault (No Phone Needed)

Goal: finish everything possible before real Android phone testing.

## 1. Repo sanity + handoff
- [ ] Pull latest repo: `git pull`
- [ ] Read `docs/open-questions-blockers.md`
- [ ] Read `docs/architecture.md`
- [ ] Confirm pushed commit exists on GitHub: `e6f3bec feat: prepare Android offline vault build`

## 2. Play Store listing assets
- [ ] Draft final short description: `Offline Video Vault for Ian Wilkes Online Courses TEK & TATI.`
- [ ] Draft better full description (current same as short; too thin for store)
- [ ] Choose support email
- [ ] Choose support website URL
- [ ] Choose privacy policy URL location
- [ ] Prepare 18+ / adults-only wording
- [ ] Decide app icon direction
- [ ] Create temporary Play Store screenshots/mockups from web/emulator if no phone available

## 3. Privacy + Data Safety
- [ ] Review `docs/privacy-data-safety.md`
- [ ] Confirm collected data: email, name, crash logs only
- [ ] Confirm no analytics
- [ ] Confirm no journal/health/practice data
- [ ] Decide whether Firebase Crashlytics is approved
- [ ] Create/publish privacy policy page

## 4. Firebase / backend setup
- [ ] Create Firebase project or choose existing one
- [ ] Disable Google Analytics during setup unless explicitly wanted
- [ ] Enable Email/Password auth
- [ ] Decide later: magic link login or keep email/password for v1
- [ ] Create Firestore entitlement shape:
  - `users/{uid}.tek = true/false`
  - `users/{uid}.tati = true/false`
- [ ] Add first admin/manual process for granting TEK/TATI access
- [ ] If using Crashlytics: add Android app `com.sacredvault.app` in Firebase
- [ ] Download `google-services.json` locally only; do **not** commit it

## 5. Wix video source test prep
- [ ] Pick 1 short TEK video URL from Wix
- [ ] Pick 1 short TATI video URL from Wix
- [ ] Check if direct download URL is stable
- [ ] Check if URL returns real video content, not HTML page
- [ ] Check if auth/cookie needed
- [ ] Check if URL expires
- [ ] Write results into `docs/wix-video-source-testing-plan.md`

## 6. Android build prep
- [ ] Confirm local debug APK builds:
  - `npm test`
  - `npm run build`
  - `npx cap sync android`
  - `cd android && ./gradlew assembleDebug`
- [ ] Decide release signing strategy
- [ ] Create release keystore locally and store password safely — not in repo
- [ ] Add release signing docs, not secrets
- [ ] Build unsigned or signed AAB for Play internal testing when ready

## 7. App polish without phone
- [ ] Replace generic app icon
- [ ] Replace generic splash screen
- [ ] Confirm app display name: `Sacred Video Vault`
- [ ] Confirm package: `com.sacredvault.app`
- [ ] Check desktop/browser flow still works
- [ ] Check offline/download UI copy says “Save for offline viewing in app,” not “browser offline”

## 8. Known not-doable without phone
- [ ] Real install from Play/internal track
- [ ] Real video download on Android storage
- [ ] Real offline playback after airplane mode
- [ ] Real background/resume behavior
- [ ] Real storage pressure behavior
- [ ] Real file-manager leakage check

## Highest-leverage order
1. Play Store privacy/support URLs
2. Firebase/Auth decision + setup
3. Wix direct-download test
4. Icon/splash/screenshots
5. Release signing/AAB prep

## Notes
- Current build already passes web tests/build and Android debug build locally.
- Current protection is app-private + hidden + validated downloads, not hard DRM.
- True encrypted streaming playback needs native Android work later if required.
