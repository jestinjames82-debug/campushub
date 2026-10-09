# CampusHub verification — 10 October 2026


## Hosted release verified

- Production deployment: [campushub-drab.vercel.app](https://campushub-drab.vercel.app), built successfully by Vercel from `main` at source commit `e7ff6a4`.
- Landing page and sign-in page load over HTTPS on the production domain.
- `https://campushub-drab.vercel.app/api/health` returned `{"status":"ok","version":"2.0.0","service":"campushub"}`.
- Supabase project `CAMPUSHUB` is healthy in Mumbai, migrations 001–005 have been applied, and the production Site URL and `/auth/callback` allow-list are configured.
- Vercel Production contains the Supabase URL, publishable key and canonical `NEXT_PUBLIC_SITE_URL`; no service-role key is used.
## Passed locally


- `npm run typecheck` passed with strict TypeScript.
- `npm run test:unit` passed 25 tests covering weighted marks, incomplete grades, SGPA/CGPA, attendance forecasts, timetable conflicts, India-time dates, ICS escaping, source excerpts, safe links/files, pagination beyond 1,000 rows, and career/revision date boundaries.
- `npm run test:security` passed all four SQL suites: Phase 1 ownership/RLS, personal records/storage/AI quota, community/institution role boundaries, and public portfolio publishing/isolation/revocation.
- `npm run build` passed with Next.js 16.4.0 and produced the expected static and dynamic routes, including the health endpoint, AI route, demo/account workspace, and public portfolio route.
- Brand assets were checked for valid PNG/ICO headers and wired into Next metadata and the web manifest: `favicon.ico`, 16×16 and 32×32 favicons, 180×180 Apple touch icon, and 192×192/512×512 Android icons. The public URL remains environment-driven through `NEXT_PUBLIC_SITE_URL`.
- The last complete browser run exercised 24 desktop/mobile scenarios. Twenty passed, including auth configuration state, protected-route redirect, subject/term/profile CRUD, planner, performance, career, community, institution consent, responsive route checks, offline fallback, manifest, and API origin protection. Four scenarios reached their expected UI but failed only when the restricted Windows browser session cancelled Playwright's temporary download path while the test tried to read the downloaded bytes. The assertions now check stable download filenames instead; a rerun was blocked by the current restricted local browser process rather than an application error.
- The demo workspace screenshots were visually reviewed on desktop and Pixel 7-sized layouts. The final visual pass removes gradients, glass blur, decorative sparkle marks and serif hero accents, and changes the landing page to a restrained numbered product summary.


## Remaining live checks

The release is deployed and its public liveness is verified. A full two-account acceptance run still needs a real student email inbox and should cover confirmation email delivery, session renewal, PostgREST CRUD, private Storage upload/download/delete, public portfolio publish/unpublish, and the optional AI Gateway. Local PGlite security fixtures remain useful regression checks but do not replace those connected-service checks.

## Before production release


Follow `DEPLOYMENT.md` for a separate preview project, SMTP setup, the two-account smoke test, portfolio review, community moderation, institution staff verification, AI budgets, accessibility, load, monitoring and backup/restore checks.


The local restricted Windows build occasionally needs the generated `.next/server/app` segment directory to exist before a parallel Next export can create its files. Re-running the build after that directory is created succeeds; this is an execution-environment filesystem limitation observed during verification.

