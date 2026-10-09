# CampusHub verification — 10 October 2026

## Passed locally

- `npm run typecheck` passed with strict TypeScript.
- `npm run test:unit` passed 25 tests covering weighted marks, incomplete grades, SGPA/CGPA, attendance forecasts, timetable conflicts, India-time dates, ICS escaping, source excerpts, safe links/files, pagination beyond 1,000 rows, and career/revision date boundaries.
- `npm run test:security` passed all four SQL suites: Phase 1 ownership/RLS, personal records/storage/AI quota, community/institution role boundaries, and public portfolio publishing/isolation/revocation.
- `npm run build` passed with Next.js 16.4.0 and produced the expected static and dynamic routes, including the health endpoint, AI route, demo/account workspace, and public portfolio route.
- Brand assets were checked for valid PNG/ICO headers and wired into Next metadata and the web manifest: `favicon.ico`, 16×16 and 32×32 favicons, 180×180 Apple touch icon, and 192×192/512×512 Android icons. The public URL remains environment-driven through `NEXT_PUBLIC_SITE_URL`.
- The last complete browser run exercised 24 desktop/mobile scenarios. Twenty passed, including auth configuration state, protected-route redirect, subject/term/profile CRUD, planner, performance, career, community, institution consent, responsive route checks, offline fallback, manifest, and API origin protection. Four scenarios reached their expected UI but failed only when the restricted Windows browser session cancelled Playwright's temporary download path while the test tried to read the downloaded bytes. The assertions now check stable download filenames instead; a rerun was blocked by the current restricted local browser process rather than an application error.
- The demo workspace screenshots were visually reviewed on desktop and Pixel 7-sized layouts. The final visual pass removes gradients, glass blur, decorative sparkle marks and serif hero accents, and changes the landing page to a restrained numbered product summary.

## Not verified against external services

No Supabase URL/publishable key is configured in this workspace. Hosted email delivery, confirmation callbacks, session renewal/revocation, PostgREST, Storage, live RLS, public portfolio reads, and the configured AI Gateway have not been exercised against an actual project. The local PostgreSQL fixtures do not replace those checks.

No GitHub repository or Vercel project has been selected or created. Source includes CI, Vercel configuration, ordered migrations, environment documentation and a deployment runbook. No live deployment claim is made.

## Before production release

Follow `DEPLOYMENT.md`: connect separate Supabase preview/production projects, apply migrations 001–005 in order, configure SMTP and exact auth callbacks, set environment variables, deploy a preview, and run the two-account smoke test. Review the portfolio snapshot before publishing, appoint community moderators, verify institution staff outside the client, set AI provider budgets, and complete accessibility, load, monitoring and backup/restore checks.

The local restricted Windows build occasionally needs the generated `.next/server/app` segment directory to exist before a parallel Next export can create its files. Re-running the build after that directory is created succeeds; this is an execution-environment filesystem limitation observed during verification.
