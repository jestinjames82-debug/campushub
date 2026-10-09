# CampusHub deployment runbook


## Current hosted release

The production release is live at [campushub-drab.vercel.app](https://campushub-drab.vercel.app). The private source repository is [jestinjames82-debug/campushub](https://github.com/jestinjames82-debug/campushub), deployed from `main` in the `pennypath/campushub` Vercel project.

The connected Supabase production project is `CAMPUSHUB` in Mumbai (`ap-south-1`). Its project URL is `https://oqdiqmdsnrubhjkgxxtq.supabase.co`. Migrations `202610080001_phase1.sql` through `202610080005_portfolios.sql` are applied in order. Supabase Auth uses `https://campushub-drab.vercel.app` as its Site URL and allows `https://campushub-drab.vercel.app/auth/callback` (the previous deployment callback remains allowed for continuity).

The latest verified Vercel deployment is the `e7ff6a4` `Update tsconfig.json` source, with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` configured for Production. The optional Study Assistant remains disabled until an AI Gateway key and model are deliberately configured.

Keep a record of the chosen Git commit, Supabase project and Vercel team/project for each environment when creating a separate preview or staging release.


## 1. Establish the database


Create/select a Supabase project. Use a separate development/preview project from production where possible. Apply these files exactly once in order through the SQL editor, or track them with the [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations):


| Order | File | Purpose |
| --- | --- | --- |
| 1 | `supabase/migrations/202610080001_phase1.sql` | Profiles, terms, subjects and ownership policies. |
| 2 | `supabase/migrations/202610080002_personal_tools.sql` | Personal records, linked-record cleanup and AI usage reservation. |
| 3 | `supabase/migrations/202610080003_community.sql` | Groups, moderation, institutions, role boundaries and membership functions. |
| 4 | `supabase/migrations/202610080004_storage.sql` | Private study file bucket and user-folder policies. |
| 5 | `supabase/migrations/202610080005_portfolios.sql` | Opt-in public snapshots with exact-slug lookup. |


These scripts target a Supabase database with its managed `auth` and `storage` schemas, not a bare PostgreSQL server. They are not general repeatable seed scripts. If Phase 1 was already applied, apply only the unapplied files. For an existing deployment with a different schema, review its migration history and add a forward migration rather than blindly replaying or editing an applied migration. Back up existing data before migration work.


## 2. Set configuration and authentication


Copy `.env.example` to `.env.local` for local use. Enter values directly into local configuration or the hosting dashboard; do not commit them.


| Variable | Value and scope |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The selected project's URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its browser-safe publishable key. Never a secret/service-role key. |
| `NEXT_PUBLIC_SITE_URL` | The public Vercel URL, or custom domain after it is connected. Do not use localhost in hosted environments. |
| `AI_GATEWAY_API_KEY` | Optional server-only AI Gateway credential; needed for generated answers. |
| `AI_MODEL` | Optional current Gateway model ID; required with the key for generated answers. |


No Supabase service-role credential is used by the app. Enable email/password authentication and email confirmation. Configure your own SMTP service before accepting real student registrations; Supabase's default email service is restricted and intended for testing. Follow the [official SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).


Set Auth Site URL to the app's intended production origin. Add exact allowed callback URLs for each tested environment: `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback` if used, and `https://YOUR-APP-DOMAIN/auth/callback`. Add the precise Vercel preview callback when testing a preview. Check any customised confirmation template preserves the requested redirect. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
