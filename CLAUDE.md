# CLAUDE.md — CSA 2.0 (standing rules for Claude Code)

You are helping build the **Culture Super App (CSA) 2.0**: a mobile-first **PWA** on **Next.js + Cloudflare**, with **email/password** auth. The owner is **non-technical**. Explain choices in plain English, never make large unrequested changes, and pause for the owner whenever a step needs a human (account creation, CLI logins like `wrangler login`, pasting keys).

Read this file at the start of every session. The detailed work lives in the spec files below.

## Source-of-truth files (read these before coding)
- `docs/context.md` — the full product spec. Re-read at the start of each session.
- `docs/build-plan.md` — the phase order and exact build spec, with edge cases folded into each phase. Follow it in order; never jump ahead.
- `docs/edge-cases.md` — the complete edge-case catalogue.
- `reference-prototype/` — the OLD React+Vite prototype. **Read-only design reference only.** Never import its code; rebuild every screen fresh in Next.js + Tailwind, mobile-first.
- `architecture.png` — the app architecture diagram.

## Tech stack (locked)
Next.js (App Router) + TypeScript, built **mobile-first as a PWA** · **Cloudflare** Pages + Workers · **Cloudflare D1** database · **Wrangler** deploy · **email + password** auth via a vetted library (Auth.js Credentials / Lucia / better-auth / Clerk) · password reset via a transactional email service (e.g. Resend) · Tailwind · Gemini Flash for AI insights (added last; swap LLM if Google access is restricted) · near-real-time via **polling**.

## Hard rules (never break these)
1. **Build bottom-up:** schema → auth → server-side access control → shared components → screens. Never wire a screen to data that doesn't exist yet.
2. **One task per session.** Do ONLY what the owner asks. No app-wide refactors, no "improvements" to files they didn't mention.
3. **Plan first.** State your plan in 3–5 steps and wait for the owner's "go" before writing code.
4. **Commit after every working change** with a clear message, and explain in plain English what it contains. This is the owner's undo button.
5. **Auth safety:** use a vetted auth library. **Never hand-roll password storage or crypto.** Passwords must be hashed by the library; sessions managed by it.
6. **Privacy is enforced in SERVER CODE** (route handlers / server actions / Workers), since there are no Firestore-style rules. Every server query checks identity and role before returning data:
   - Managers never see any individual's score or identity — aggregates only.
   - A manager action is hidden from employees until its `visibleToEmployeesAt` (submit + 4 weeks).
   - Journal entries are returned only to their author.
   - Users read/write only their own personal records.
7. **Never commit secrets.** D1 credentials, the email-service key, and the AI key stay in `.dev.vars` / Cloudflare secrets, gitignored. Confirm before the first push.
8. **Smallest change that works.** Don't add dependencies without asking. Fix one thing at a time.
9. **If code and `context.md` disagree, stop and ask** before proceeding.

## Operating checklist — DO
- Build `lib/data.ts` (data layer) and the shared component kit BEFORE the screens.
- Build and test the server-side access-control layer in Phase 1 by trying to break it, not just reading it.
- Seed realistic fake data early so every screen can be eyeballed with believable numbers.
- Reuse one `TrendChart` and one `PillarCard` across all dashboards.
- Design every screen mobile-first; confirm PWA installability in Phase 0 and again in Phase 5.
- Pause and instruct the owner whenever a step is theirs (see "When to hand off").

## Operating checklist — DON'T
- Don't build on top of the Vite prototype — reference only.
- Don't hand-roll auth/password storage.
- Don't do app-wide refactors or touch files outside the current task.
- Don't wire a screen to data that doesn't exist yet.
- Don't skip commits because a change is "small."
- Don't commit any secret, ever.
- Don't enforce privacy only in the UI — it lives in server code.
- Don't add libraries that aren't needed. Stack = Next.js, Cloudflare/D1, the auth library, Tailwind, one chart lib, the email SDK, the LLM SDK.
- Don't build the AI layer early — Phase 5.
- Don't let the mascot/avatar overlap or hide titles/wording. Lay it out *beside* the text (e.g. a flex row with the text in `min-w-0 flex-1` and the mascot `flex-shrink-0`), never on top of it. Keep mascot sizing consistent across screens, and always check long titles (e.g. "Meaningful Work") aren't covered.

## Locked decisions (do not re-litigate)
- Backend = Cloudflare (Pages + Workers + D1), deployed with Wrangler. (Firebase dropped — org-blocked.)
- Auth = email + password via a vetted library; **open signup** for any email (personal included). No OAuth.
- Delivered as a mobile-first **PWA**, shared by link. Capacitor is the post-pilot path to app stores.
- Real-time via **polling** for the pilot.
- Privacy enforced in **server code**.
- Marketplace cut; Wisdom (Beginner/Advanced/Expert + badges) is the only learning system.
- Manager action delay = **4 weeks**.
- Anonymisation floor = **≥3 responses** (team also needs ≥3 reportees).
- **No participation rate** next to individual/manager names.

## Fast-track build order (saves time)
foundation + access-control layer → data layer (`lib/data.ts`) + shared component kit → **Employee Analysis screen first as the template** → rest of employee loop → manager loop (riskiest) → senior/admin views → AI + PWA polish. Most dashboards are the same shape at different scopes, so nailing the kit and the first dashboard turns the rest into assembly.

## When to hand off to the owner (pause and instruct them)
You cannot create accounts or do browser logins. Pause and give plain-English steps when it's time to:
- Create the GitHub repo and connect it.
- Create the Cloudflare account and run `wrangler login` (authorises in the browser).
- Set up the email service (e.g. Resend) and paste its key into `.dev.vars` / Cloudflare secrets.
- Paste the AI API key.
- Approve the first Cloudflare Pages deploy.
Tell the owner exactly which buttons to click and what to copy back.

## Per-session starter (the owner will paste a task like this)
> "Re-read docs/context.md, docs/build-plan.md, docs/edge-cases.md. Today: <one specific screen or task>. Do only this, follow CLAUDE.md, commit when it works. Give me your 3–5 step plan and wait for my go."
