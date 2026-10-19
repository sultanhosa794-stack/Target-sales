# Target & Sales 1.4.1 — release candidate (not deployed)

## Implemented in branch
- GPS: retry low-accuracy fixes before starting/ending a shift, keep server-side 50m radius.
- Session: retry GET requests once on transient 502/503/504 responses without clearing saved login.
- Sales: guard against duplicate submit while saving (server RPC remains authoritative).
- Push: log registration errors rather than silently swallowing them.
- Daily report: respond to CORS OPTIONS preflight and include CORS headers.
- Login: display version 1.4.1.

## Required verification before release
1. Validate GPS against real approved locations; confirm server returns correct location_name and assigned_location. Do not change attendance history.
2. Validate auth session refresh, device binding, password reset and role boundaries.
3. Test sales first submission, one final revision, duplicate concurrent requests, approval, totals and target (35=5, 58=10, 75=10, 104=12; monthly 3300).
4. Validate employee creation/region linking and disable operations with permission tests.
5. Test CORS on deployed Edge Function (source change does not deploy it).
6. Test notification permissions, push token registration, reminders and end-shift cancel behavior on real devices.
7. Test admin/employee pages, hotel activations, charts and daily/monthly reports on Android/iOS/web.
8. Run CI, Android build, branch sync and regression checks before release approval.

Do not merge, deploy, modify production database, or change permissions without explicit approval.
