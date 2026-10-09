# CampusHub 2.0

A responsive student workspace for any college in India, built with Next.js App Router, TypeScript, Tailwind CSS and Supabase. College, programme, branch and academic system are editable; students can use Semester, Trimester or Annual terms.

This release adds working source across all eight roadmap areas. The personal tools and local demo are usable now. Hosted authentication, shared data, file storage, public portfolio publishing and AI need the corresponding services configured and verified before a production launch. See [deployment setup](DEPLOYMENT.md), [phase status](ROADMAP.md) and [verification evidence](VERIFICATION.md).

## Run locally

Use Node.js 22 or newer with npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/demo/dashboard`. The labelled demo saves sample and edited records in this browser's local storage. Clearing site data removes them; they do not sync between devices or migrate into an account. Demo community members and institution verification are samples. Demo uploads are limited to 1 MB. Public publishing and AI generation require a connected account.

For real accounts, follow [DEPLOYMENT.md](DEPLOYMENT.md), set `.env.local`, restart the app, then use `/auth` and `/app/dashboard`. Never place a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

## Included features

| Area | Working source in this release |
| --- | --- |
| Foundation | Email/password registration, confirmation, sign-in/out, academic onboarding, editable profile, terms and subjects CRUD, dashboard, settings and responsive navigation. |
| Planner | Assignments, exams and reminders; completion and due lists; weekly timetable, conflicting-slot checks, cancelled occurrences; attendance logs, targets and forecasts; one-time calendar export. |
| Study | Notes, subject organisation, tags and search; resource links and private PDF/text uploads; revision goals and completion. |
| Performance | Weighted assessments, user-defined grade thresholds, completed-credit SGPA/CGPA and academic goals. Incomplete results stay pending. |
| Community | Opt-in clubs/study groups, member posts, shared links, events, reporting, blocking, owner-assigned moderators, moderation queue and audit trail. |
| Career | Opportunity/application tracker with source and expiry, interview notes, preparation tasks, portfolio editor, browser print/PDF and opt-in public portfolio snapshots. |
| Study assistance | Selected-note source review, plus a configured server endpoint for cited explanations, quizzes and revision plans with a daily per-user allowance. |
| Institutions and portability | Operator-verified institution directory, consent-based membership and staff announcements; personal JSON export, ICS export, install manifest, public offline fallback and English/Hindi navigation. |

Reminders appear inside the planner; email/push delivery is not implemented. Opportunity records are student-entered, not an external jobs feed. AI uses selected text notes only, not uploaded PDFs or an external knowledge base. Hindi covers navigation labels, not every form or message. Offline mode shows a fallback screen; it does not provide offline editing or account data.

## Privacy and data behaviour

- Private academic records use owner-based RLS. Subject/term references must belong to the same user. Community and institution roles do not grant access to personal records.
- Deleting a subject also deletes its timetable, attendance and assessments. Notes, resources, tasks and goals remain with their subject cleared. Deleting a term deletes its subjects and applies the same cleanup.
- Live study files use a private `study-resources` bucket, a 5 MB file limit and paths scoped to the user. Downloads use short-lived signed URLs. The client checks permitted file types and cleans up a newly uploaded file if its record cannot be saved.
- A public portfolio is a separate, explicitly approved snapshot at `/portfolio/<slug>`. Only its seven previewed fields are exposed. Dedicated email/phone fields are excluded; users should check free-text fields before publishing. Updating a private portfolio does not update its published snapshot until published again. Unpublishing stops new views; it cannot recall copies already saved by visitors.
- Personal JSON export includes profile, terms, subjects and personal records. Shared community data and file binaries are excluded; download attachments separately. There is no import/restore UI.
- The service worker caches the public offline page and icon only. It does not cache signed-in pages or private files. Demo data still persists separately in browser local storage.

## Verify the source

```sh
npm run typecheck
npm run test:unit
npm run test:security
npm run build
npx playwright install chromium
npm test
```

Browser tests launch the production build on port 3100 and cover desktop/mobile demo flows. Unit tests cover academic calculations, calendar exports, safe resources and source citations. SQL tests execute migrations against PGlite with minimal Supabase-compatible auth/storage fixtures to exercise ownership, role boundaries and policies. They do not prove that a hosted Supabase project's configuration, Storage service or email delivery is correct. See [VERIFICATION.md](VERIFICATION.md) for the recorded results and live checks still required.

The project includes exact dependency versions and a lockfile, `.env.example`, `.gitignore`, GitHub Actions CI, `vercel.json` and five ordered SQL migrations. CI checks the source; it does not create a repository, configure accounts or publish to Vercel. No hosted target is selected in this source deliverable.

## Remaining release work

Connect and test the chosen services, establish moderation/support ownership and operational budgets, and complete the live checks in the deployment guide. Password reset and account deletion screens, full translation, background notifications, an external opportunity feed, deeper accessibility review, load testing, monitoring and backup/restore exercises remain future work. The implemented modules are a starting product release, not a claim that every roadmap release gate has passed.
