# CSA 2.0: backend and hosting handoff (for DevOps)

*Written 2026-10-26. This describes how the app is actually built and hosted today, so you can review it and suggest architecture or hosting changes. Every fact below was checked against the code and the live Cloudflare account on that date.*

**What it is:** the Culture Super App (CSA) is a mobile-first PWA for weekly employee-happiness check-ins. Employees answer 2 questions a week. Managers, HR and CEOs see **aggregates only**, never an individual's answers. It's in a small pilot with real users (4 accounts in production right now; a few dozen expected in the pilot).

**Owner:** Aparna (non-technical). Code has been written with Claude Code, following the rules in `CLAUDE.md`.

---

## 1. Architecture at a glance

```
 Phone / browser (PWA)
        │  HTTPS
        ▼
 Cloudflare Pages project "csa2"  →  https://csa2.pages.dev
   Next.js 15 App Router, built with @cloudflare/next-on-pages
   Every route runs on the edge runtime (Workers), server components + server actions
        │
        ├── D1 database "csa" (binding DB)  ── all app data, incl. auth tables
        ├── Resend HTTP API                 ── invite + password-reset emails
        └── Groq API (OpenAI-compatible)    ── AI wording, currently switched OFF

 Cloudflare Worker "csa2-cron"  (cron-worker/)
   Mondays 07:00 UTC  →  POST https://csa2.pages.dev/api/cron/weekly  (Bearer CRON_SECRET)
```

There are no other servers, containers, queues, KV namespaces, R2 buckets or VPCs. Real-time updates are done by **polling**: the manager inbox polls every 60s, and a version watcher polls `/version.json` so open tabs refresh after a deploy.

## 2. Stack

| Layer | What | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | `export const runtime = "edge"` on every route |
| Build adapter | `@cloudflare/next-on-pages` 1.13 | Output in `.vercel/output/static`. **Cloudflare has deprecated this adapter in favour of OpenNext (`@opennextjs/cloudflare`)**, so it's worth evaluating a move. |
| Hosting | Cloudflare Pages | `wrangler.toml`: `compatibility_date 2024-09-23`, `nodejs_compat` |
| Database | Cloudflare D1 (SQLite) | One database, `csa` (id `7f59a44e-…1827`). Primary observed in APAC (SIN). About 0.5 MB today. |
| DB access | Raw D1 prepared statements in `lib/*.ts`; Kysely + kysely-d1 only for better-auth | No ORM for app queries |
| Auth | better-auth 1.6, email + password, open signup | Sessions in D1. **Password hashing replaced with PBKDF2 via WebCrypto** (`lib/auth-password.ts`), because better-auth's default JS scrypt exceeded the free-plan CPU limit per request (error 1102 / 503). |
| Email | Resend REST API via plain `fetch` (`lib/email.ts`) | The SDK was removed because its size pushed every request over the CPU limit. |
| AI | Groq `openai/gpt-oss-120b` (`lib/ai.ts`) | `AI_WORDING = false`: insights are written by code from the numbers. Only aggregate numbers would ever go into a prompt. |
| Styling | Tailwind v4 | No runtime cost |
| Other deps | recharts, gsap | Client-side only |

Plan: the Cloudflare account appears to be on the **Workers free plan**. The code has repeatedly been tuned to fit its per-request CPU limit (see the PBKDF2 and Resend notes above). Please confirm the plan in the dashboard.

## 3. Cloudflare resources (live)

| Resource | Name | Purpose |
|---|---|---|
| Pages project | `csa2` → `csa2.pages.dev` | **Production app** |
| Pages project | `csa2-0` → `csa2-0.pages.dev` | Older/duplicate project, last deployed about 3 weeks ago. **Not used by the app; probably safe to delete.** Please confirm with the owner first. |
| D1 database | `csa` | All data |
| Worker | `csa2-cron` | Weekly rollover trigger (last changed 2026-08-06) |

No custom domain yet. The owner is considering one, and `BETTER_AUTH_URL` would need to change with it.

## 4. Secrets and config

Set as Cloudflare Pages secrets on `csa2` (production). Names only here; values are never in git.

| Name | Used for |
|---|---|
| `BETTER_AUTH_SECRET` | better-auth session signing |
| `BETTER_AUTH_URL` | Public base URL. Also the **only trusted origin in production** (CSRF), so it must match the domain users open. |
| `CRON_SECRET` | Shared with the `csa2-cron` worker; guards `/api/cron/weekly` |
| `RESEND_API_KEY` | Email |
| `GROQ_API_KEY` | AI (unused while `AI_WORDING = false`) |

Local development uses `.dev.vars` (gitignored). `.env*`, `.dev.vars`, `.wrangler`, `.vercel` and `backups/` are all gitignored, and a scan of the git history found no API keys.

**Email caveat:** mail is sent from `noreply@resend.dev` (Resend's sandbox sender), which only delivers to the Resend account owner. Real invites and password resets need a **verified sending domain** in Resend, and the `from:` in `lib/auth.ts` and `lib/admin.ts` updated to match.

## 5. Data model and migrations

- SQL migrations live in `migrations/0001…0021_*.sql` and are applied with `wrangler d1 migrations apply csa --remote`. Wrangler tracks them in the `d1_migrations` table.
- Main tables:
  - `user`, `session`, `account`, `verification` (better-auth);
  - `user_roles`, `employment`, `teams`, `departments`, `invites`;
  - `questions`, `recommendations`, `weeklyWindows`, `checkInAssignments`, `checkIns`;
  - `managerActions`, `employeeResponses`, `journalEntries`, `streaks`;
  - `careerCompanies`, `careerQuestions`;
  - `wisdomModules`, `wisdomContent`, the `user_*` progress tables;
  - `aiInsights` (cache), `adminAuditLog`.
- **Content lives in the database, not the code:** the question bank and the tips ("recommendations") are edited in the app's Admin screens. `docs/recommendations.md` is a snapshot of the tips, kept in git as a record.
- **Backups:**
  - Manual SQL dumps (`wrangler d1 export`) are taken before risky migrations and kept locally in `backups/` (gitignored, on the owner's laptop only).
  - There are no scheduled backups. D1 Time Travel (point-in-time restore) is the only other safety net; its retention depends on the plan.

## 6. Privacy and security model (must be preserved)

These are product commitments, enforced in **server code** (`lib/access-control.ts` and the `lib/*.ts` data functions), not just the UI:

- Managers never receive an individual's score or identity, only aggregates.
- Anonymisation floor: **at least 3 responses** before any aggregate is shown, and a team needs at least 3 reportees. Splits need at least 5 people.
- Manager actions are hidden from employees until 4 weeks after they're submitted.
- Journal entries are returned only to their author.
- Only aggregate numbers would ever go to an AI provider: no names, individual scores or free text.

Any architecture change (caching, a CDN in front, analytics, logging, a new AI provider) needs to keep these true. In particular, **don't add response caching or logging that could store per-user payloads** where managers or third parties could reach them.

Other notes:
- `/api/seed` is blocked outside development and outside localhost. `/api/seed-demo-org` is admin-only.
- `lib/testing-mode.ts` has `TESTING_MODE = true` (daily questions, 1-week manager delay) for the pilot. It must be turned off before a real launch, and the `@test.com` accounts deleted.

## 7. Build, deploy and environments

There is **one environment (production)**, no staging and no CI. Deploys are run by hand from the owner's laptop:

```bash
rm -rf .next && npm run pages:build      # copy build + version stamp + next-on-pages
npx wrangler pages deploy                # uploads .vercel/output/static to csa2
curl https://csa2.pages.dev/version.json # should equal public/version.json
```

- `scripts/stamp-version.mjs` writes `public/version.json`. Open clients compare it against their own and reload after a deploy.
- `scripts/build-copy.mjs` compiles `copy/copy.html` (all on-screen wording) into `lib/copy.generated.ts`.
- Local dev: `npm run dev` (Next dev server with a local D1 under `.wrangler/state`), or `npx wrangler pages dev .vercel/output/static` to test the production build.
- Cron worker: `cd cron-worker && npx wrangler deploy`, with `CRON_SECRET` set on both sides. The app also self-heals on read (it assigns the week's questions when a user visits), so the cron is a convenience, not a dependency.

## 8. Known gaps and risks (worth your input)

1. **No staging, CI or automated tests in the deploy path.** Production is deployed from a laptop.
2. **No scheduled database backups** beyond whatever D1 Time Travel gives on this plan.
3. **Free-plan CPU limit** has already caused production 503s twice (password hashing, the email SDK bundle). Moving to the Workers Paid plan would remove most of this pressure.
4. **`@cloudflare/next-on-pages` is deprecated.** A migration to OpenNext on Workers is likely needed in the medium term.
5. **Email isn't production-ready** until a sending domain is verified in Resend.
6. **No monitoring or alerting** beyond the Cloudflare dashboard. Errors are caught by React error boundaries and retried (`lib/retry.ts`), but nothing pages anyone.
7. **Single D1 database, single region.** That's fine at pilot scale; D1 has per-database size limits worth knowing for growth.
8. Login rate limiting relies on better-auth's defaults and hasn't been reviewed.
9. PWA icons (`/icon-192.png`, `/icon-512.png`) referenced in `public/manifest.json` are missing.

## 9. Open questions from the owner

- **"Move to a virtual private cloud."** The current design is fully serverless on Cloudflare, with no VPC. Locked decisions in `CLAUDE.md` chose Cloudflare (Firebase was blocked by the org). If there's a compliance or IT requirement behind the VPC request (data residency, network isolation, SSO, audit), it would help to name it, so the change can be scoped against it. Options range from staying on Cloudflare with tighter controls, to moving the app to a container or VM in a cloud VPC with a managed Postgres.
- **AI provider.** The owner is considering OpenAI for insight wording. That's a contained change in `lib/ai.ts` (Groq already uses the OpenAI-compatible API). It needs an API key and a privacy sign-off.
- **Custom domain.** Add it in Pages → Custom domains, then update `BETTER_AUTH_URL` and the `APP_URL` var in `cron-worker/wrangler.toml`.

## 10. Where to look in the code

| Topic | File(s) |
|---|---|
| Access-control guards | `lib/access-control.ts` |
| DB handle | `lib/db.ts` (`getRequestContext().env.DB`) |
| Auth setup / password hashing | `lib/auth.ts`, `lib/auth-password.ts`, `app/api/auth/[...all]/route.ts` |
| Weekly scheduling | `lib/scheduler.ts`, `app/api/cron/weekly/route.ts`, `cron-worker/` |
| Email | `lib/email.ts` |
| AI | `lib/ai.ts`, `lib/insight*.ts` |
| Schema | `migrations/` |
| Product spec | `docs/context.md`, `docs/build-plan.md`, `docs/edge-cases.md` |
| Architecture diagram | `docs/architecture.png` (older; the AI box says Gemini, now Groq) |
| Owner-facing plain-English plumbing | `docs/plumbing.md` (older; written before go-live) |
