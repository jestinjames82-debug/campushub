# CampusHub phase status

Version 2.0 implements an initial functional slice in every planned area. “Implemented” below describes source and local behaviour. A production release also needs configured services, live integration checks and the operational work listed here. Test results are recorded separately in [VERIFICATION.md](VERIFICATION.md).

## Phase 1 — Foundation

Implemented: responsive student workspace, email/password authentication and confirmation flow, onboarding, editable academic profile, terms, subjects CRUD, dashboard, settings, server route protection and owner-based database policies.

Next: verify live email delivery, sessions, revoked sessions and two-account isolation. Add password recovery and account deletion UX before a broad self-service launch.

## Phase 2 — Academic organiser

Implemented: assignments, exams, in-app reminders, due/completed lists, recurring timetable with conflicts and cancelled occurrences, attendance logging, configurable targets and forecasts, and one-time ICS calendar export using India Standard Time.

Next: pilot timetable and attendance workflows with students. Background email/push reminders, calendar subscriptions and external calendar synchronisation remain separate integrations.

## Phase 3 — Study workspace

Implemented: notes with tags/search and subject association; resource links; private PDF/text uploads and signed downloads; revision goals and completion. Storage policies isolate user folders, with file size/type checks and upload cleanup.

Next: verify hosted Storage upload/download/deletion, failed-upload recovery and quota behaviour. Establish storage budgets and file retention. Rich document search, PDF text extraction and revision analytics remain future extensions.

## Phase 4 — Performance and goals

Implemented: weighted assessments, configurable grading thresholds, SGPA by term, CGPA across completed credits, explicit incomplete results, attendance forecasts and academic goals.

Next: validate pilot colleges' grading rules and explain how their policies map to the configuration. Institution-specific repeat/backlog/exemption rules and detailed historical trend charts need further work. Calculated results are personal planning aids, not official transcripts.

## Phase 5 — Campus community

Implemented: opt-in club/study-group discovery and membership, posts and shared links, events, blocking/reporting, owner-managed moderator roles, report resolution and audit records. Community roles remain separate from private academics.

Next: test live multi-account interactions and moderation; appoint operators and define reporting response times. Anti-spam throttling, invitation-only groups and broader abuse controls remain release work before open community growth.

## Phase 6 — Career preparation

Implemented: manually entered opportunities/applications with source, expiry and status; interview notes; preparation tasks; portfolio/resume editing and browser print/PDF. Publishing requires explicit approval of a separate public snapshot; email/phone fields are excluded and unpublishing is supported.

Next: verify the live publish/view/update/unpublish flow and review printed resumes. External placement feeds, automatic opportunity verification and application integrations are not connected.

## Phase 7 — Study assistance

Implemented: local source review from selected notes; a server-side AI Gateway route for explanation, quiz and plan modes; note ownership checks, visible excerpts and structural citation validation. The database reserves up to 20 attempts per student per India calendar day; provider errors after reservation still consume an attempt.

Next: configure a model and provider budget, then evaluate actual answers, unsupported questions, prompt injection and cross-user denial. Citation syntax checks cannot prove factual grounding. Uploaded-document extraction, conversation history and deletion/retention management for provider processing are outside the current implementation.

## Phase 8 — Institutions and operational readiness

Implemented: install manifest, public offline fallback, English/Hindi navigation labels, private JSON export and calendar export, health endpoint, verified institution directory, consent-based student membership and privileged staff provisioning/announcements. Academic records stay personal after joining an institution.

Next: complete full UI translation, accessibility audit, live tenant/role tests, monitoring, recovery drills, support and retention policies, and measured load/performance testing. Offline editing and private data synchronisation are not implemented. Institutions require independent operator verification; users cannot self-assign a verified college or staff role.

## Release sequence

1. Connect the chosen Supabase and Vercel environments using [DEPLOYMENT.md](DEPLOYMENT.md), run all source checks and complete the live two-account smoke test.
2. Pilot the personal academic/study/career tools with a small student group; fix issues from actual use.
3. Enable shared communities and verified institution workspaces when moderation and staff verification are ready.
4. Enable paid AI after model evaluation and spending controls are in place.
5. Expand languages, notifications, integrations and capacity based on the pilot's needs and measured performance.

There are no promised launch dates or claims of production-scale readiness. The core personal workspace remains useful without AI, community membership or a college partnership.
