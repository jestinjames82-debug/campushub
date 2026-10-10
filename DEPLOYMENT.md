# CampusHub deployment runbook

## Current hosted release

The production release is live at [campushub-drab.vercel.app](https://campushub-drab.vercel.app). The public source repository is [jestinjames82-debug/campushub](https://github.com/jestinjames82-debug/campushub), deployed from `main` in the `pennypath/campushub` Vercel project.

The connected Supabase production project is `CAMPUSHUB` in Mumbai (`ap-south-1`). Its project URL is `https://oqdiqmdsnrubhjkgxxtq.supabase.co`. Migrations `202610080001_phase1.sql` through `202610080005_portfolios.sql` are applied in order. Supabase Auth uses `https://campushub-drab.vercel.app` as its Site URL and allows `https://campushub-drab.vercel.app/auth/callback` (the previous deployment callback remains allowed for continuity).

The linked Vercel project has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` configured for Production. Confirm the deployment commit and Ready status in Vercel after each push. The optional Study Assistant remains disabled until an AI Gateway key and model are deliberately configured.

Keep a record of the chosen Git commit, Supabase project and Vercel team/project for each environment when creating a separate preview or staging release.

## 1. Establish the database

Create/select a Supabase project. Use a separate development/preview project from production where possible. Apply these files exactly once in order through the SQL editor, or track them with the [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations):

| Order | File                                                  | Purpose                                                                     |
| ----- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 1     | `supabase/migrations/202610080001_phase1.sql`         | Profiles, terms, subjects and ownership policies.                           |
| 2     | `supabase/migrations/202610080002_personal_tools.sql` | Personal records, linked-record cleanup and AI usage reservation.           |
| 3     | `supabase/migrations/202610080003_community.sql`      | Groups, moderation, institutions, role boundaries and membership functions. |
| 4     | `supabase/migrations/202610080004_storage.sql`        | Private study file bucket and user-folder policies.                         |
| 5     | `supabase/migrations/202610080005_portfolios.sql`     | Opt-in public snapshots with exact-slug lookup.                             |

These scripts target a Supabase database with its managed `auth` and `storage` schemas, not a bare PostgreSQL server. They are not general repeatable seed scripts. If Phase 1 was already applied, apply only the unapplied files. For an existing deployment with a different schema, review its migration history and add a forward migration rather than blindly replaying or editing an applied migration. Back up existing data before migration work.

## 2. Set configuration and authentication

Copy `.env.example` to `.env.local` for local use. Enter values directly into local configuration or the hosting dashboard; do not commit them.

| Variable                               | Value and scope                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | The selected project's URL.                                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its browser-safe publishable key. Never a secret/service-role key.                                          |
| `NEXT_PUBLIC_SITE_URL`                 | The public Vercel URL, or custom domain after it is connected. Do not use localhost in hosted environments. |
| `AI_GATEWAY_API_KEY`                   | Optional server-only AI Gateway credential; needed for generated answers.                                   |
| `AI_MODEL`                             | Optional current Gateway model ID; required with the key for generated answers.                             |

No Supabase service-role credential is used by the app. Enable email/password authentication and email confirmation. Configure your own SMTP service before accepting real student registrations; Supabase's default email service is restricted and intended for testing. The built-in provider currently permits only two auth emails per hour, so `email rate limit exceeded` is expected once that project-wide quota or the per-request cooldown is reached. This error is returned by the `auth.signUp()` request before an email can be delivered; it is not a database RLS failure. Follow the [official SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Set Auth Site URL to the app's intended production origin. Add exact allowed callback URLs for each tested environment: `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback` if used, and `https://YOUR-APP-DOMAIN/auth/callback`. Add the precise Vercel preview callback when testing a preview. Check any customised confirmation template preserves the requested redirect. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

The app exchanges the confirmation code at `/auth/callback`. Complete confirmation in the browser where registration began for its PKCE session; if that exchange fails after confirming in another browser, return to the app and sign in. Password recovery UI is not included yet.

### Configure custom SMTP before public registration

This manual step cannot be performed from the frontend or this repository. Do it in the Supabase dashboard for the production project:

1. Create a transactional email account with [Resend](https://resend.com/) or [Brevo](https://www.brevo.com/), and verify a sending domain. Use a dedicated authentication sender such as `no-reply@auth.yourdomain.com`; do not paste credentials into GitHub, Vercel client variables or source files.
2. In Supabase open **Project settings → Authentication → SMTP Settings** (or **Authentication → Email → SMTP Settings**), enable custom SMTP, and enter the provider's exact SMTP host, port, username and password/API key. Set the sender email and sender name to the verified address.
3. Keep **email/password** enabled and keep **Confirm email** enabled. Do not enable autoconfirm as a workaround; confirmation is part of the account security flow.
4. In **Authentication → URL Configuration**, set **Site URL** to `https://campushub-drab.vercel.app`. Add these exact redirect URLs: `https://campushub-drab.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, and `http://127.0.0.1:3000/auth/callback`. Add a Vercel preview wildcard only if previews are tested, for example `https://*-pennypath.vercel.app/**`, and keep it limited to the correct team slug.
5. In **Authentication → Email Templates**, keep the confirmation link based on `{{ .ConfirmationURL }}` or `{{ .RedirectTo }}` as appropriate. Disable click/link tracking in the email provider so the single-use Supabase link is not rewritten.
6. In **Authentication → Rate Limits**, review the email limit after SMTP is enabled and set a value that matches the provider's plan. Supabase applies an initial protection limit even with custom SMTP; raise it only after deliverability and abuse controls are in place.
7. Send a test confirmation email from the Supabase dashboard, then register two real test accounts from CampusHub. Check the Auth logs and the provider delivery log if either message is delayed or rejected.

For Resend, the dashboard values are the SMTP values shown under the account's SMTP/API settings; for Brevo, use the SMTP relay values shown under **Transactional → Settings → SMTP & API**. The exact host, port, username and password are account-specific and must be copied from the provider after domain verification. This project never needs a Resend or Brevo API key in browser code. Vercel only needs the three public `NEXT_PUBLIC_*` variables listed above; SMTP credentials stay inside Supabase.

## 3. Run the source checks

From the project directory, with Node.js 22 or newer:

```sh
npm ci
npm run typecheck
npm run test:unit
npm run test:security
npm run build
npx playwright install chromium
npm test
```

Browser tests start the built app on port 3100. Ensure that port is free or already serves this exact build. On Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`, as the included workflow does. Automated tests use demo data and SQL fixtures; follow the live checks below for the connected services.

## 4. Publish a preview through GitHub and Vercel

Commit this directory as the repository root, including hidden `.github` files, or set it as Vercel's Root Directory if using a larger repository. Keep `.env.local`, `node_modules`, `.next` and test traces out of Git. The included GitHub workflow runs type checks, unit tests, SQL security tests, production build and desktop/mobile browser tests without production secrets.

Import the intended repository in the intended Vercel team. Use the Next.js framework preset, Node.js 22, `npm ci` as install command and `npm run build` as build command. The checked-in region is Mumbai (`bom1`); review it against your selected database region. Git integration creates deployments from repository pushes; see the [Vercel GitHub guide](https://vercel.com/docs/git/vercel-for-github).

Set the two public Supabase variables for the intended Preview/Production environments before building. Add server-only AI variables only where AI should operate. Configuration changes apply to new deployments, so rebuild after changes. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

Use a non-production branch for the first preview. Require the repository checks through branch protection. If production domain assignment must wait for those checks, configure [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks); Git integration and the supplied test workflow alone do not establish that gate. Release the verified commit after the live checks pass.

## 5. Verify live behaviour with two test accounts

1. Register account A, receive and confirm the email, onboard, edit the profile, add a term and subjects, then sign out/in. Check persistence and session refresh. Repeat registration with account B.
2. Create a deadline, class, attendance entry, assessments, grading scale, note, revision goal and application. Test edits, reloads, calendar export and personal JSON export.
3. Upload a small PDF/text file as A. Download through its signed URL, delete it, and verify that B and an anonymous request cannot read or mutate A's file or personal rows. Check failed-upload cleanup. The bucket must remain private.
4. Create a group as A; join as B with consent. Test posts, reports, blocking and owner-assigned moderation. Confirm B cannot self-promote or access A's academic records. Staff status must also leave personal records inaccessible.
5. Build A's portfolio, review the exact public preview, approve publishing and open the share link while signed out. Check that email/phone fields are absent, edit and republish, then unpublish and confirm a new anonymous visit no longer sees it.
6. Check phone/desktop layouts, keyboard navigation, install behaviour and the offline fallback. Account pages should not be stored in the service worker's cache. `/api/health` should respond successfully, but it is only an app liveness check and does not test database connectivity.
7. Test AI separately only after the configuration and evaluation below. Keep demo, fixture and live results distinct in the release record.

## 6. Provision institutions and community operations

An institution's name in a student's private profile is free text. A verified institution workspace is a separate operator-controlled record. Independently confirm the college/domain and authorised staff before using privileged SQL in the chosen Supabase project. Users cannot create verified institutions or mint staff roles from the client.

Example for a verified operator to adapt in the SQL editor:

```sql
insert into public.institutions (name, domain)
values ('Verified college name', 'verified-college.example')
returning id;

-- Have the verified staff member create an account and join with consent first.
-- Replace both UUID placeholders with the checked records, then grant staff:
update public.institution_members
set role = 'staff'
where institution_id = 'INSTITUTION_UUID'::uuid
  and user_id = 'VERIFIED_STAFF_USER_UUID'::uuid
returning institution_id, user_id, role;
```

Do not infer staff authority from a profile entry or email domain alone. Review the returned row; zero rows means the user has not joined or the IDs are incorrect. Revoking staff access means changing that row back to `student`. Staff may publish announcements for their institution; this does not grant access to personal data.

Group owners can appoint moderators inside the app. Before open community use, assign report responders, document moderation/appeal handling and add appropriate anti-spam controls. The source includes report resolution and an audit trail, but no staffed service or general posting rate limiter.

## 7. Enable and evaluate AI deliberately

The endpoint uses AI Gateway's [OpenAI-compatible chat API](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions). Choose a currently available model from the Gateway model catalogue and configure `AI_MODEL` and the server-only key. Verify provider spending controls in the selected account before enabling student use.

The implementation sends the question and excerpts from up to five owned text notes to the provider after the student's consent. It does not send uploaded PDFs, private files, the whole workspace or other students' notes. The server returns visible excerpts alongside the answer and checks citation indices. It has no tools or browsing capability. Answers are not stored in a conversation-history table by this app.

The database caps attempts at 20 per student per India calendar day. Each model request limits output to 1,000 tokens and times out after 45 seconds. Failures after reservation count toward the daily allowance. These controls are not a total spending cap across all users: set an account budget, monitor usage and document provider retention/data handling.

Before release, evaluate supported and unsupported questions, false citations, instructions embedded in notes, empty sources, concurrency at the quota boundary, provider timeouts and attempts to request another user's notes. Citation syntax validation does not establish factual correctness. Source review remains available when AI is unconfigured.

## 8. Production operations still to establish

Record monitoring/error reporting, uptime and performance targets, storage/AI budgets, incident contacts, retention/export/deletion procedures and a tested backup/restore process. Complete an accessibility review and load test with representative data. Database backup plans must cover file objects as well as database records. A code rollback does not reverse a database migration; preserve compatible schemas and use forward fixes for deployed data.

Full Hindi translation, private offline editing, background reminder delivery and account deletion/recovery screens are not implemented. The public offline fallback and navigation translation should not be described as complete offline or multilingual support.
