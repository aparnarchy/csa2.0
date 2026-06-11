# CONTEXT.md — Culture Super App (CSA)

> Single source of truth for the CSA build. Paste this at the start of every Claude Code session before writing any code. If a decision changes, update this file first, then tell Claude Code to re-read it. Code and spec must never drift apart.

**Last updated:** 11 June 2026 — stack switched to Cloudflare + email/password auth + PWA (see Decisions log).

---

## What this app is

Culture Super App (CSA) is an internal employee happiness platform, delivered as a **mobile app (PWA)**. Employees answer 2 check-in questions per week across 4 happiness pillars. Their responses generate personal insights, trend data, and recommendations. Managers see aggregated team data, act on low scores, and close the feedback loop with their team. Senior roles see data across multiple teams or the whole org.

All employee response data is private. Managers only ever see aggregates, never individual scores.

## Tech stack

- App + backend: **Next.js (App Router)**, built **mobile-first as a PWA** (installable to home screen, full-screen, app-like)
- Hosting + backend runtime: **Cloudflare Pages + Workers**
- Database: **Cloudflare D1** (SQL / SQLite-based)
- Deploy tooling: **Wrangler** (Cloudflare CLI)
- Auth: **Email + password**, via a vetted auth library (e.g. Auth.js Credentials, Lucia, or better-auth — never hand-rolled). **Open signup** — anyone with any email (including personal) can register.
- Password reset: email-based, via a transactional email service (e.g. Resend)
- Styling: Tailwind CSS
- AI insights: Gemini Flash API (swap to another LLM API — e.g. OpenAI or Anthropic — if Google access is restricted)
- Real-time updates: short-interval **polling** (e.g. manager inbox refreshes every few seconds). No always-on socket layer for the pilot.
- Code editor: VS Code + Claude Code

### Mobile delivery
The pilot ships as a **PWA**: a mobile-first web app users open by link and "Add to Home Screen". No app stores, no developer accounts, instant updates. If true native / app-store presence is needed post-pilot, wrap the same app with **Capacitor** — no rebuild required.

## Relationship to the prototype

A 55-screen React + Vite prototype exists (mock data only, inline styles, single-component state, already designed at phone-frame dimensions). It is a **design reference, not a code base**. The 2.0 app is a fresh Next.js PWA. Screens are rebuilt by harvesting the prototype's visual design (layouts, copy, UX flow) and re-implementing them in Next.js + Tailwind against the D1 data layer. Do not import the prototype's code or architecture.

## Roles

| Role | What they see |
| ----- | ----- |
| Employee | Own check-in flow, personal insights, career history, inbox, wisdom, profile |
| Manager | Team dashboard, recommendations inbox, wisdom, profile |
| Reviewing Manager | All managers under them, drill into each manager's team data |
| CEO / HR | Org-wide happiness data, drill into any team |
| Admin | Admin panel only — manages org structure, question bank, wisdom content |

A user can have multiple roles. If they are both an employee and a manager, they see a dashboard toggle in their profile to switch between views. A person who self-signs-up (not via an invite) starts as an **Employee with no team**; an admin or manager can connect them to the org structure later.

## Database — Cloudflare D1 (relational schema)

> SQL tables. Column types are Claude Code's to finalise; this defines the shape and relationships. Multi-value fields (roles, completed content, etc.) use either join tables (preferred) or JSON columns where simpler. IDs are surrogate keys.

```
users
  id, name, email (unique), passwordHash, teamId (FK, nullable),
  managerId (FK users.id, nullable), departmentId (FK, nullable),
  currentCompany, currentRole, yearsOfExperience,
  mentorName, mentorEmail,
  onboardingComplete (bool),
  onboardingPath ("admin_upload" | "manager_invite" | "individual_invite" | "self_signup"),
  createdAt

user_roles            -- a user can hold several roles
  userId (FK), role ("employee"|"manager"|"reviewing_manager"|"ceo_hr"|"admin")

teams
  id, name, managerId (FK users.id), departmentId (FK)
  -- a team's employees = users WHERE teamId = this team

departments
  id, name
  -- a dept's teams = teams WHERE departmentId = this dept

invites
  id, email, role ("manager"|"employee"), invitedBy (FK users.id),
  teamId (FK, nullable), status ("pending"|"accepted"), createdAt

checkIns
  id, userId (FK), questionId (FK), pillarId, weekId (FK weeklyWindows),
  score, timestamp, isRetrospective (bool),
  followUpStatus (null | "acted" | "not_acted")

questions
  id, text, pillarId,
  optionA_text, optionA_score, optionB_text, optionB_score,
  optionC_text, optionC_score, isActive (bool)

recommendations
  id, questionId (FK), pillarId, scoreBandMin, scoreBandMax, text

managerActions
  id, managerId (FK), teamId (FK), pillarId, weekId, questionId (FK),
  recommendationText, actionText,
  status ("open"|"in_progress"|"resolved"),
  submittedAt, visibleToEmployeesAt   -- = submittedAt + 4 weeks

employeeResponses
  id, userId (FK), actionId (FK managerActions), response ("yes"|"maybe"|"not_yet"),
  submittedAt
  -- one response per (userId, actionId)

journalEntries
  id, userId (FK), weekId, questionId (FK), text,
  type ("follow_up"|"coaching"), submittedAt

streaks
  userId (FK, PK), currentStreak, longestStreak, lastCheckInWeek

careerCompanies          -- career history, one row per past company per user
  id, userId (FK), name, role, startDate, endDate,
  overallScore, pillarScores (JSON: {meaningfulWork, growth, culture, compensation}),
  questionnaire (JSON: {answers})

questions/pillars are referenced by pillarId across tables:
  pillars = Meaningful Work | Growth | Culture | Compensation

wisdomModules
  id, title, pillarId, audience ("employee"|"manager"|"both"),
  level ("beginner"|"advanced"|"expert"), badgeAwarded (text), isActive (bool)

wisdomContent
  id, moduleId (FK), title, type ("lesson"|"article"|"video"|"quiz"),
  pillarId, audience, body, sortOrder, isActive (bool),
  level, hasQuiz (bool), quizQuestions (JSON)

userWisdomProgress
  userId (FK, PK), currentLevel ("beginner"|"advanced"|"expert")
user_completed_content   userId (FK), contentId (FK)
user_completed_modules   userId (FK), moduleId (FK)
user_badges              userId (FK), badge (text), moduleId (FK), earnedAt

weeklyWindows
  weekId (PK), startDate, endDate, isActive (bool)

sessions                 -- managed by the auth library
  (handled by the chosen auth library; do not hand-roll)
```

---

## The 4 happiness pillars

1. Meaningful Work
2. Growth
3. Culture
4. Compensation

---

## Key rules and thresholds

| Rule | Value |
| ----- | ----- |
| Check-in frequency | 2 questions per week, random working days, 9am–6pm only |
| Low score threshold | < 7 (triggers recommendation for employee and manager) |
| Score scale | 0–10, derived from A/B/C answer mapping per question |
| **Anonymisation floor** | **Manager sees NO data for a team/pillar/question unless there are at least 3 responses for it. A team also needs ≥3 reportees to aggregate.** |
| **Manager action delay** | **Employee sees manager's action 4 weeks after manager submits it** |
| Retrospective answers | Count toward pillar scores but NOT toward streak |
| Skip limit | After 3 consecutive skips of the same question, it is permanently retired |
| Minimum data for score display | Fewer than 3 responses in selected time window → show "Not enough data" |
| Streak unit | Consecutive weeks with ≥1 non-skipped response |

---

## Authentication

- **Email + password signup and login.** Open to anyone with any email (personal addresses allowed) so the app can be shared freely by link.
- Passwords are stored **hashed** by a vetted auth library — never plain text, never hand-rolled crypto.
- **Password reset** via emailed reset link (transactional email service).
- Sessions managed by the auth library.
- After signup → onboarding form (if `onboardingComplete = false`) → role-appropriate dashboard.

## Privacy enforcement

There are no database-level "security rules" like Firestore. **All access control is enforced in server code** (Next.js route handlers / server actions / Workers). Every server query must check the caller's identity and role before returning data. Specifically:
- Managers can only ever receive **aggregated** team data — never another user's raw responses or identity.
- A manager action is not returned to employees before its `visibleToEmployeesAt`.
- Journal entries are returned only to their author.
- A user can read/write only their own personal records.

---

## Onboarding — pathways

Every user ends up in the same individual flow regardless of how they joined.

### Path 1 — Admin bulk upload
Admin uploads a CSV via the admin panel with org structure and user data. Invited users receive an email to set their password and log in. On first login they complete the onboarding form and career history questionnaire.
CSV template columns: name, email, role, department, team, manager_email, designation

### Path 2 — Manager self-onboards and invites team
Manager signs up (email + password), completes onboarding form, then invites direct reports by email. Each invite creates an `invites` record and sends an email. Reportees click the link, set a password, sign up, and complete onboarding. They are automatically linked to the manager's team.

### Path 3 — Individual invite only
A person is invited directly as an individual with no manager connection. They sign up, complete onboarding, and enter the individual flow. A manager connection can be added later by an admin.

### Open self-signup
Anyone given the app link can sign up directly (no invite). They land as an Employee with no team (`onboardingPath = "self_signup"`); an admin or manager can connect them to a team later.

### Onboarding form (all paths, first login)
Appears after signup if `onboardingComplete = false`. Fields:
- Name (entered by the user)
- Current company
- Current role
- Years of experience
- Add a manager: name + email (optional)
- Add a mentor: name + email (optional)

On submit: writes the user record, sets `onboardingComplete: true`, records `onboardingPath`. Then routes to the career history questionnaire prompt, then to the role-appropriate dashboard.

---

## Screen list — Employee

### 1. Check-in question screen
- Single question with A/B/C options (tappable cards). Score hidden.
- If chosen score < 7 → recommendation card appears inline before advancing.
- Writes a `checkIns` row.

### 2. Unanswered questions screen
- Appears only if the user has unanswered questions from previous weeks. Oldest first. "2 of 5" progress.
- Save & Next (after selection), Skip this for now (text link).
- Low score → inline recommendation before advancing. Saved answers flagged `isRetrospective`.
- 3 consecutive skips of the same question → permanently retired.

### 3. Return check-in / follow-up screen
- Appears at session start only if there's an unacted recommendation.
- Shows the recommendation, asks "Were you able to act on it?"
- Yes → journal box → on submit set `followUpStatus = "acted"` + a `journalEntries` (follow_up).
- Not yet → `followUpStatus = "not_acted"`, encouragement, advance.
- If already completed this session → skipped. No high-score path (cut).

### 4. Analysis screen (main dashboard)
Top to bottom: header (My Dashboard + mascot + Current Company / Overall Career toggle); large overall score + trend delta + participation % + percentile; streak flame inline; 2×2 pillar cards (tap → pillar detail); AI qualitative snapshot; trend chart with time filter (1M/3M/6M/1Y/All) + pillar filter and reference lines (org/dept/industry avg). <3 responses in window → "Not enough data". Time filter updates score, pillars, and chart together.

### 4b. Pillar detail screen
Header (pillar + score + trend + percentile); AI insight for this pillar; trend chart (same format); Strength / Concern toggle; rows of question text + score + progress bar.

### 5. Wisdom / Learning screen
> Pilot learning system. **Marketplace is cut.**
Three levels: Beginner → Advanced → Expert. Levels contain modules; modules contain content (lessons, articles, videos + optional quiz).
Layout: current level badge + progress to next; active module card (title, pillar tag, content list with completion ticks); completed modules with earned badge; content ordered by lowest-scoring pillar first.
Completion: article/video = partial credit; quiz = full credit + badge; all badges in a level → next level unlocks. Badge names set by admin per module. Admin uploads all content.

### 6. Inbox screen (+ 6b history)
Three sections: latest check-in summary (+ recommendation if <7); read-only unanswered list (tap low-scoring → recommendation inline); "Actions taken on your feedback" — manager actions shown only after the 4-week delay, only to employees who scored <7 on that question, only if ≥3 responses exist for it. Respond Yes/Maybe/Not yet (explicit Submit) → writes `employeeResponses`; item moves to history (6b, read-only).

### 7. Profile screen
User info; career-history summary link; streak dot row (last 8–10 weeks) + flame + number (**no calendar heatmap**); wisdom badge row; dashboard toggle (only if also manager); settings (notification prefs, account); sign out.

### 8. Career history screen (+ 8b company detail)
(8) Overall career score + percentiles; AI label; career-long trend chart; pillars-across-companies 2×2; historical company list (tap → 8b); Intelligent Insights (AI). First visit → questionnaire prompt; empty until submitted.
(8b) Static per-company snapshot — frozen scores, pillar grid, tenure-filtered chart, strength/concern toggle.

---

## Screen list — Manager

### 9. Manager onboarding popup
First login only; explains the dashboard; if Path 2, includes "invite direct reports by email".

### 10. Manager dashboard
Team score + trend + participation %; 2×2 pillar cards (team avg + colour: ≥7 green, 4–6 amber, ≤3 red); AI team-level insight; trend chart (team vs org/dept/industry avg); recommendations panel (one card per pillar <7, link to inbox). **Anonymisation:** nothing shown for any team/pillar/question with <3 responses, and nothing at all if team has <3 reportees.

### 11. Manager inbox
Header (Action Inbox + % resolved + progress bar); Open/Resolved tabs; each card = pillar tag + date + status + trigger question + team avg + A/B/C breakdown bar + pre-authored recommendation + "Have you taken action?" Yes/Not Yet (explicit Submit). Yes → journal box → log `managerActions` (set `submittedAt`, `visibleToEmployeesAt = submittedAt + 4 weeks`). Submit disclaimer about the 4-week visibility. Flagged section for "Not yet" responses. **Updates via polling** (refresh every few seconds).

### 12. Manager wisdom screen
Same structure as employee wisdom; content filtered to audience = manager (and "both").

---

## Screen list — Reviewing Manager

### 13. Manager list view
"My Managers" + count + ranked by team happiness; org avg reference; each card = name, team score, percentile, resolution score %, colour bar. **No participation rate next to names.** Tap → detail (13b).

### 13b. Manager detail view
Manager name + back; team score + trend + percentile + resolution score (**no per-name participation**); 2×2 pillar grid; trend chart; High/Low scoring toggle.

---

## Screen list — CEO / HR

### 14. CEO / HR dashboard
Manager-dashboard shape at org-wide scope; dropdown to drill into any department/team; org score, pillar breakdown, AI insight, trend chart, high/low insights, action-impact summary. **No per-name participation in any listing.**

---

## Screen list — Admin panel

### 15. Admin panel (admin role only)
**Org structure** — add/edit/delete departments, teams, employee/manager assignments, designations; CSV upload (columns: name, email, role, department, team, manager_email, designation); send email invites.
**Invites** — view pending, resend, cancel; invite as manager or individual.
**Question bank** — view all 63 questions, add, delete; each = text, pillar, A/B/C with score mapping.
**Wisdom content** — create/manage modules (title, pillar, audience, level); upload content items; set order; publish/unpublish; assign badge name.

---

## Key flows

### Check-in flow (in order)
Return check-in (if applicable) → Unanswered questions (if any) → Fresh check-in question → Analysis screen

### Manager action → employee feedback loop
1. Manager sees low team score → records action in inbox → stored with `submittedAt`.
2. `visibleToEmployeesAt = submittedAt + 4 weeks`.
3. After 4 weeks, action appears for employees who scored <7 on that question.
4. Employee responds Yes/Maybe/Not Yet → `employeeResponses`.
5. Manager inbox reflects it on next poll.

### Career history questionnaire flow
First visit (or post-onboarding prompt) → fill questionnaire → write `careerCompanies` rows → screen populates.

### Wisdom progression flow
Beginner first module unlocked → complete content → complete quiz → earn badge → next module → all modules in a level → next level. Badges shown on profile.

### Onboarding — Path 2 (manager invite)
Manager signs up + onboards → enters reportee emails → `invites` rows + emails sent → reportee sets password, signs up, onboards → auto-linked to team.

---

## What is NOT in scope for the pilot

- Marketplace (learning/coaching directory) — cut; replaced by Wisdom
- Google / LinkedIn / any OAuth login — replaced by email + password
- Aletheia AI assistant
- Department Head view
- Community share / social feed; upvote/downvote
- Calendar heatmap (streak counter kept)
- Feedback / coaching post-analysis journaling screen
- High score path on return check-in
- Participation rate next to individual/manager names
- Native app-store apps (PWA for pilot; Capacitor is the post-pilot path)
- Always-on real-time sockets (polling for pilot)

---

## Decisions log

| Date | Decision |
| ----- | ----- |
| Jun 2026 | Low score threshold < 7 across the app |
| Jun 2026 | Three invite onboarding paths in pilot |
| Jun 2026 | Wisdom uses Beginner/Advanced/Expert badge structure |
| Jun 2026 | Social/community deferred; Dept Head cut |
| 11 Jun 2026 | Marketplace cut. Wisdom is the only learning system. |
| 11 Jun 2026 | Manager action delay = 4 weeks. |
| 11 Jun 2026 | Anonymisation floor = ≥3 responses (team also needs ≥3 reportees). |
| 11 Jun 2026 | No participation rate next to individual/manager names. |
| **11 Jun 2026** | **Backend stack = Cloudflare (Pages + Workers + D1), deployed with Wrangler. (Firebase dropped — org-blocked.)** |
| **11 Jun 2026** | **Auth = email + password via a vetted library; open signup for any email. No OAuth.** |
| **11 Jun 2026** | **Delivered as a mobile-first PWA (installable, shared by link). Capacitor is the post-pilot path to app stores.** |
| **11 Jun 2026** | **Real-time updates via polling for the pilot (no socket layer).** |
| **11 Jun 2026** | **Privacy enforced in server code (no Firestore-style rules).** |
| **11 Jun 2026** | **Auth library = better-auth (native D1 adapter, edge runtime compatible).** |
| **11 Jun 2026** | **Invite email matching: allow any email at signup. An invite pre-links org structure only when emails match; anyone can sign up freely.** |
| **11 Jun 2026** | **AI insights = Anthropic Claude API (Gemini dropped — org-blocked Google Cloud project creation).** |

---

## Current phase

**Phase 1 — Foundation.** Schema, email auth, server-side access control, role routing. See `build-plan.md`.
