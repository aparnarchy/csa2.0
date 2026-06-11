# BUILD-PLAN.md — CSA 2.0 (comprehensive, phase by phase)

> This is the build spec. Each phase lists **exactly what to build**, the **edge cases to handle while building it** (drawn from `edge-cases.md`), and the **tests to pass before moving on**. Build in order. Finish and test a phase before starting the next. Standing rules live in `CLAUDE.md`; the product spec lives in `context.md`.
>
> **Stack:** Next.js (App Router) mobile-first **PWA** · **Cloudflare** Pages + Workers + **D1** database · **Wrangler** deploy · **email + password** auth (open signup) via a vetted library · Tailwind · Gemini Flash (AI) · polling for near-real-time.
>
> Legend: **(owner)** = the non-technical owner does this (accounts, console clicks, CLI logins). **(CC)** = Claude Code does this. **DECIDE** = an open decision to lock before that phase; record it in `context.md`.

---

## How each screen gets built (the per-screen loop)

For every screen in Phases 2–4:
1. **(CC)** Read the matching screen in `reference-prototype/` for layout, copy, and visual style.
2. **(CC)** Rebuild it in Next.js + Tailwind, **mobile-first**. Drop anything cut for the pilot.
3. **(CC)** Wire it to `lib/data.ts` (the single data-access layer), not directly to the database.
4. **(CC)** Implement the rules and edge cases listed under that screen.
5. **(CC)** Self-check against the phase's test list, then commit with a plain-English message.

Never start the next screen until the current one is committed and working.

---

# Phase 0 — Setup and a blank PWA live on Cloudflare

**Goal:** an empty mobile-first PWA already deployed on Cloudflare, with the repo, prototype reference, and spec docs in place. No features yet.

### Exactly what to build / do
1. **(owner)** Confirm accounts: GitHub, **Cloudflare**, a transactional email service (e.g. Resend) for password resets, and an AI API key (Gemini, or alternative if Google access is restricted).
2. **(owner)** `mkdir csa2.0 && cd csa2.0` (already done).
3. **(CC)** Scaffold a Next.js (App Router) + TypeScript + Tailwind project, configured for Cloudflare Pages (use the Cloudflare Next.js adapter, e.g. `@cloudflare/next-on-pages` or OpenNext). Add **PWA setup**: web app manifest, icons, service worker, mobile-first viewport/meta. Nothing else.
4. **(CC)** `git init`. **(owner)** create an empty private GitHub repo `csa2.0`. **(CC)** connect and push the first commit.
5. **(CC)** Create `docs/` with `context.md`, `build-plan.md`, `edge-cases.md`; put `CLAUDE.md` and `architecture.png` at the root.
6. **(CC)** Bring in the prototype as read-only reference: `mkdir reference-prototype`, copy the prototype's `src` from `/Users/aparna/happiness-app/src` into it, add `reference-prototype/` to `.gitignore`.
7. **(CC)** Read `reference-prototype/` and produce the **screen-mapping table**: every prototype screen → its `context.md` equivalent, marked **reuse / drop / build-fresh**. (Drop: Marketplace, community share, feedback/coaching, calendar heatmap, manager check-in.)
8. **(owner + CC)** Cloudflare + D1: **(owner)** create a Cloudflare account; run `wrangler login` when prompted (opens the browser to authorise). **(CC)** create the D1 database (`wrangler d1 create csa`), wire it into the project via `wrangler.toml`, and create `lib/db.ts` for queries. Put any secrets in `.dev.vars` / Cloudflare secrets, gitignored.
9. **(CC)** Add the **email-auth library** (Auth.js Credentials, Lucia, or better-auth) with a sessions table in D1. Don't build screens yet — just the wiring.
10. **(owner + CC)** Deploy the blank PWA to **Cloudflare Pages** via Wrangler (or the Pages Git integration). **(owner)** approve the deploy/login steps.

### Tests to pass before Phase 1
- [ ] Blank PWA loads at its Cloudflare URL **and** is installable on a phone ("Add to Home Screen" works, opens full-screen).
- [ ] D1 database exists and the app can run a trivial query against it.
- [ ] Repo on GitHub with the first commit; no secrets committed.
- [ ] The screen-mapping table exists and you've read it.

---

# Phase 1 — Foundation: schema, email auth, server-side access control, role routing

**Goal:** the skeleton. A user can sign up / log in with email + password and land on the correct (stub) dashboard for their role, and privacy is enforced in server code. No real screens yet.

### Exactly what to build
1. **(CC)** Create all D1 tables from `context.md` as SQL migrations (users, user_roles, teams, departments, invites, checkIns, questions, recommendations, managerActions, employeeResponses, journalEntries, streaks, careerCompanies, wisdomModules, wisdomContent, userWisdomProgress + completed/badge tables, weeklyWindows, sessions). Add matching TypeScript types in `lib/types.ts`.
2. **(CC)** **Email + password auth**: signup (open to any email), login, logout, sessions — all via the chosen library (passwords hashed by the library, never hand-rolled). Add the **password-reset** flow (request → emailed link → set new password) using the email service.
3. **(CC)** **Server-side access control** (this replaces Firestore security rules). Build a single enforcement layer that every data function passes through, guaranteeing:
   - A user reads/writes only their own personal records.
   - Managers receive only **aggregated** team data — never another user's raw responses or identity.
   - `managerActions` are not returned to employees before `visibleToEmployeesAt`.
   - `journalEntries` are returned only to their author.
4. **(CC)** On login: if no completed onboarding → onboarding (built Phase 2); else → the dashboard for the user's role. Role-based routing to **stub** dashboards (Employee, Manager, Reviewing Manager, CEO/HR, Admin). Dual-role users get a profile toggle stub.
5. **(CC)** Seed script: one user per role (known passwords), one team with ≥3 reportees, a department, ~10 questions across pillars, a few weeks of `checkIns`, and a current `weeklyWindows` row.

### Edge cases to handle in this phase
- Self-signup (no invite) → `onboardingPath = "self_signup"`, Employee role, no team.
- Logged-in user with `onboardingComplete = false` is forced to onboarding — no dashboard access.
- Invited email vs the email used at signup: **DECIDE** match required vs allow any (open signup leans "allow any"; an invite just pre-links team/role when the emails match).
- Dual-role user → both roles in `user_roles`; profile toggle picks the active view; own check-ins always use the employee flow.
- A manager calling a data function directly must be denied individual scores by the server-side layer — test this, don't trust the UI.

### Tests to pass before Phase 2
- [ ] Sign up with a brand-new email, log out, log back in.
- [ ] Password reset email arrives and lets you set a new password.
- [ ] Each seeded role lands on its own stub dashboard.
- [ ] A manager account is **denied** an individual's raw responses by the server layer (test deliberately).
- [ ] Journal entries are not returned to a second account.
- [ ] Committed.

---

# Phase 1.5 — Data layer + shared component kit (the time-saver)

**Goal:** build the reusable pieces once so every later screen is assembly.

### Exactly what to build
1. **(CC)** `lib/data.ts` — the single data-access layer every screen calls (e.g. `getEmployeeScores(userId, window)`, `getTeamAggregate(teamId, window)`). It runs through the Phase 1 access-control layer. Return realistic sample data first; swap the insides to real D1 queries later with no change to screens.
2. **(CC)** `lib/scoring.ts` — calculation helpers: overall score (avg of responses in window), pillar score, trend delta (current vs prior window), percentile vs org, streak (consecutive weeks with ≥1 non-skipped response; retrospective excluded), and the "<3 responses → not enough data" signal.
3. **(CC)** Shared, **mobile-first** component kit (Tailwind): `ScoreRing`/large score + delta, `PillarCard` (colour: ≥7 green, 4–6 amber, ≤3 red), `TrendChart` wrapper (time + pillar filters, reference lines), `RecommendationCard`, `NotEnoughData`, `ScreenShell` (mobile layout + bottom nav), `AIInsight` placeholder.

### Edge cases to handle
- `TrendChart` with no prior window → hide the delta.
- `scoring.ts` returns a clear "not enough data" (not 0) below the floor.
- Colour bands exactly ≥7 / 4–6 / ≤3.

### Tests to pass before Phase 2
- [ ] A throwaway page renders every kit component with sample data on a phone-sized screen.
- [ ] `scoring.ts` numbers spot-check correctly on the seed data.
- [ ] Committed.

---

# Phase 2 — Employee journey (the core loop)

**Goal:** a real employee completes the full loop end to end. One screen per session, ported from `reference-prototype`, wired to `lib/data.ts`.

### 2.0 Onboarding form (first login)
Fields: name (typed), current company, current role, years of experience, optional manager (name+email), optional mentor (name+email). On submit: write the user record, `onboardingComplete = true`, record `onboardingPath`, route to career-history prompt then dashboard. Edge: no dashboard before submit; invite vs self-signup both land here.

### 2.1 Check-in question screen
A/B/C cards, score hidden, writes `checkIns`. Score <7 → inline `RecommendationCard`. Edge: 2 questions/week on random working days 9am–6pm in the active weekly window; **DECIDE** working-hours timezone (employee-local recommended).

### 2.2 Unanswered questions screen
Appears only if prior-week questions unanswered; oldest first; "2 of 5"; Save & Next; "Skip this for now". Saved = `isRetrospective`. Rules: low score → inline recommendation; **3 skips retire the question**; retrospective excluded from streak. Edge: **DECIDE** whether a retrospective low answer triggers a fresh recommendation.

### 2.3 Return check-in / follow-up
Appears only if an unacted recommendation exists. "Were you able to act on it?" Yes → journal → `followUpStatus="acted"` + journal entry. Not yet → `"not_acted"` + encouragement. Skip if already done this session. No high-score path.

### 2.4 Analysis screen — build FIRST as the template
Header (+ Current Company / Overall Career toggle); large score + delta + participation % + percentile; streak flame; 2×2 pillar cards (tap → detail); `AIInsight` placeholder; `TrendChart`. Rules: time filter updates score+pillars+chart together; <3 responses → `NotEnoughData`. Edge: pillar with 0 in window shows "not enough data", not 0; hide delta when no prior window.

### 2.5 Pillar detail screen
Header (pillar + score + delta + percentile); `AIInsight` for the pillar; `TrendChart`; Strength/Concern toggle; rows of question + score + bar.

### 2.6 Inbox (+ 2.6b history)
Sections: latest check-in summary (+ recommendation if <7); read-only unanswered list (tap low → recommendation inline); "Actions taken on your feedback" (rules below). Yes/Maybe/Not yet + explicit Submit → `employeeResponses`; item → history (6b). Rules: action shown only to employees who scored <7 on that question, only after the 4-week delay, only if ≥3 responses exist. Edge: one response per employee per action; history read-only.

### 2.7 Profile screen
User info; career-history link; streak dot row + flame + number (**no heatmap**); badge row; dashboard toggle (only if also manager); settings; sign out.

### 2.8 Career history (8) + company detail (8b)
(8) overall career score + percentiles; AI label; career trend chart; pillars-across-companies 2×2; company list (tap → 8b); Intelligent Insights (AI, Phase 5). First visit → questionnaire prompt; empty until submitted. (8b) static frozen snapshot. Edge: **DECIDE** past-company scores self-reported vs CSA data (self-reported recommended); snapshots stay static.

### 2.9 Wisdom (employee)
Current level badge + progress; active module card; completed modules + badges; content ordered by lowest pillar first. Rules: article/video = partial, quiz = full + badge, all badges → next level. Edge: locked levels show requirements; no double-award; re-order on lowest-pillar change; unpublished content keeps earned badges.

### Tests to pass before Phase 3
- [ ] A test employee: onboard → check-in → see it in analysis.
- [ ] Low-score recommendation appears in check-in and unanswered flows.
- [ ] 3-skip retire, retrospective-excluded-from-streak, "not enough data" all correct.
- [ ] Wisdom locking + badge award work.
- [ ] Each screen committed separately.

---

# Phase 3 — Manager journey + feedback loop (riskiest logic)

**Goal:** managers see anonymous aggregates and the 4-week action loop works on real employee data.

### 3.1 Manager onboarding popup
First-login explainer; Path 2 → "invite reportees by email" (creates `invites` + sends email).

### 3.2 Manager dashboard
Team score + trend + participation %; 2×2 pillar cards (colour bands); `AIInsight` (team); `TrendChart` (team vs org/dept/industry); recommendations panel (one card per pillar <7, link to inbox). **Anonymisation:** nothing for any team/pillar/question with <3 responses; nothing at all if <3 reportees. Edge: floor re-evaluated live; aggregates only, never a de-anonymising field.

### 3.3 Manager inbox
Header (Action Inbox + % resolved + bar); Open/Resolved tabs; cards (pillar + date + status + trigger question + team avg + A/B/C bar + recommendation + Yes/Not Yet + Submit). Yes → journal → log `managerActions` (`submittedAt`, `visibleToEmployeesAt = +4 weeks`). Submit disclaimer about 4-week visibility. Flagged section for "Not yet". **Updates via polling** (refresh every few seconds). Edge: **DECIDE** one vs multiple actions per question/week; manager leaves mid-cycle (pending actions stay, no new ones, **DECIDE** inheritance); <3-reportee manager → **DECIDE** hide inbox (recommend hide).

### 3.4 Manager wisdom
Same as employee wisdom; audience = manager (+ "both").

### Tests to pass before Phase 4
- [ ] Manager dashboard shows aggregates only; no individual score reachable.
- [ ] Anonymisation floor hides data below 3 responses and below 3 reportees.
- [ ] Submit an action → invisible to employees; after the delay it appears only for those who scored <7 (test with a temporarily shortened delay, then restore 4 weeks).
- [ ] An employee Yes/Maybe/Not Yet appears in the manager inbox on next poll and moves to history.
- [ ] Committed per screen.

---

# Phase 4 — Senior roles + Admin panel

**Goal:** roll-up read views over existing data, plus admin write tools.

### 4.1 / 4.2 Reviewing Manager — list (13) + detail (13b)
List: "My Managers" + count + ranked; org avg; cards = name, team score, percentile, resolution score %, colour bar. **No participation rate next to names.** Tap → detail: manager name + back; team score + trend + percentile + resolution score (**no per-name participation**); 2×2 pillar grid; trend chart; High/Low toggle.

### 4.3 CEO / HR dashboard (14)
Manager-dashboard shape, org-wide; dropdown to drill into any dept/team; org score, pillars, AI insight, trend chart, high/low insights, action-impact summary. **No per-name participation anywhere.**

### 4.4 Admin panel (15)
Org structure (add/edit/delete depts, teams, assignments, designations; **CSV upload**; send invites); Invites (pending/resend/cancel; invite as manager/individual); Question bank (63 questions; add/delete; A/B/C score mapping); Wisdom content (modules, content items, order, publish, badge names). Edge: malformed CSV row → reject that row with a clear error, import valid ones, show a summary; unknown `manager_email` → queue/flag, don't crash; duplicate invite → reuse existing.

### 4.5 Onboarding paths end to end
Path 1 (admin CSV → invite emails → set password → onboarding); Path 2 (manager invites → auto-link); Path 3 (individual invite); plus open self-signup. **DECIDE** Path-3 retroactive aggregation when a manager is linked later.

### Tests to pass before Phase 5
- [ ] Reviewing Manager + CEO views show correct roll-ups, no per-name participation rate.
- [ ] CSV upload creates users/teams/departments and handles a bad row gracefully.
- [ ] Admin can add/edit questions and wisdom modules.
- [ ] All onboarding paths + self-signup work end to end.
- [ ] Committed per screen.

---

# Phase 5 — AI insights, privacy pass, PWA polish, launch

**Goal:** go live.

### Exactly what to build / do
1. **(CC)** Wire **Gemini Flash** (or chosen LLM) into every `AIInsight` slot. Cache per user/window; regenerate only when scores change.
2. **(CC)** Final **access-control review** — re-test that managers can never reach individual scores; confirm the four privacy guarantees hold in server code.
3. **(owner + CC)** Privacy/data policy: document where D1 data lives; **DECIDE** data-retention + user self-deletion behaviour (what happens to aggregates) and implement.
4. **(CC)** **PWA polish:** confirm installability on iOS and Android, offline-friendly loading, correct icons/splash, full-screen behaviour. Notifications: in-app + email (native push is out for the PWA pilot).
5. **(CC)** General polish: empty states, loading states, error fallbacks.

### Edge cases to handle
- AI call fails/times out → render the numbers with an "insight unavailable" fallback; never block a dashboard on the AI.
- Not enough data for a meaningful insight → skip the AI snapshot rather than hallucinate.

### Tests to pass before launch (the must-not-happen list)
- [ ] A manager cannot see any individual's score or identity (re-tested against the server layer, not just UI).
- [ ] No data shows below 3 responses anywhere.
- [ ] No manager action is visible before its 4-week date.
- [ ] Journals are private to the author.
- [ ] No user reaches a dashboard before completing onboarding.
- [ ] Passwords are stored hashed; no secrets in the repo.
- [ ] The app installs to home screen and runs the full loop on a real phone via the live URL.

---

## When to hand off to the owner (pause and instruct them)
Claude Code can't create accounts or do browser logins. Pause and give plain-English steps for: creating the GitHub repo; creating the Cloudflare account and running `wrangler login`; setting up the email service (Resend) and pasting its key; pasting the AI API key; approving the first Cloudflare Pages deploy. Tell the owner exactly what to click and what to copy back.

## Open decisions to lock as you reach each phase
Phase 1: invite-vs-open email matching · (auth library choice — Auth.js / Lucia / better-auth / Clerk).
Phase 2: working-hours timezone · question-bank repeat-after-exhaustion · past-company score source · retrospective-recommendation trigger.
Phase 3: one-vs-multiple actions per question/week · manager-leaves inheritance · sub-3-reportee inbox visibility.
Phase 4: Path-3 retroactive aggregation.
Phase 5: data-retention + self-deletion policy · notification channel.

Record every decision in `context.md`'s decisions log when you make it.
