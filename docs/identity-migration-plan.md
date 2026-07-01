# Identity-model migration plan (for approval before any schema change)

**Status: PROPOSAL — nothing in the database changes until the owner approves this.**

This plan turns the current "one account = one job" model into the locked
**lifelong person-account + time-bounded employment** model
(see the `identity-distribution-model` decision). It also removes the cancelled
**mentor** feature and leaves **manager-invite** on hold.

---

## Plain-English summary

Today, a person's account *is* their job — their team, manager, company and role
all live directly on the login record. If they change jobs, that breaks.

We're separating the two ideas:

- **The person** (the login) is forever. It's anchored on a personal email and
  holds only person-level things: name, login, look-and-feel preferences.
- **An employment** is one job at one company for a stretch of time. It holds
  team, manager, department, job title, the verified work email, and start/end
  dates. A person can have several over their life; usually one is "active".

Two big wins this unlocks:
1. **Double-opt-in work-email linking** — an org's uploaded roster row only
   attaches to a real person when that person adds the work email *and* clicks a
   link sent to it, proving they control both inboxes. The employer never sees
   the personal email.
2. **Employment-scoped data** — team averages only count check-ins made *while a
   person was actually on that team*, and leaving freezes an anonymised snapshot.

**Why now is the cheap moment:** the dashboards currently run on mock data
(`lib/data.ts`), and the only real database writes so far are auth, roles, and
the admin panel. There is no real check-in aggregation to rewrite yet. Doing
this before that gets built saves the most rework.

---

## What we have today (verified in code)

- `user` (better-auth, singular) carries **job fields as `additionalFields`**
  (`lib/auth.ts`): `teamId`, `managerId`, `departmentId`, `currentCompany`,
  `currentRole`, `yearsOfExperience`, `mentorName`, `mentorEmail`.
- `getSession()` (`lib/auth-session.ts`) exposes `teamId` on the session user;
  dashboards read it.
- `/api/onboarding` writes those fields for the caller's own record; it stores
  `mentorName/mentorEmail` but **already ignores** the manager name/email.
- `teams.managerId` and `invites.teamId` live on their own tables (not on the
  person) — **unaffected** by this migration.
- The mentor feature touches: `OnboardingForm.tsx`, `/api/onboarding`,
  `lib/types.ts`, `lib/auth.ts`, `lib/copy.generated.ts`, `docs/*`,
  `migrations 0001/0002`.

---

## Target schema

### 1. `user` stays the lifelong person
Keep: `id, name, email, emailVerified, image, createdAt, updatedAt,
onboardingComplete, onboardingPath, themeMode, persona`, and `yearsOfExperience`
(a career-level fact about the person, not one job).

Remove (mentor cancelled): `mentorName`, `mentorEmail`.

Job fields (`teamId, managerId, departmentId, currentCompany, currentRole`) move
to `employment` — but see the **staged approach** below for how we retire them
safely without breaking the running app.

### 2. New `employment` table (one row per job)
```sql
CREATE TABLE employment (
  id TEXT PRIMARY KEY,
  userId TEXT,                       -- the person; NULL for an un-claimed roster row
  companyName TEXT,                  -- pilot: the single org's name (was currentCompany)
  departmentId TEXT,                 -- FK departments.id
  teamId TEXT,                       -- FK teams.id
  managerId TEXT,                    -- FK user.id (the manager's PERSON account)
  designation TEXT,                  -- job title (was currentRole)
  workEmail TEXT,                    -- the work email that links roster row -> person
  workEmailVerified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
         CHECK(status IN ('pending','active','ended')),
  startedAt TEXT,
  endedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
```
- **Bulk upload** creates a `pending` row with `workEmail` set and `userId` NULL.
- **Claiming** (double opt-in) sets `userId`, `workEmailVerified = 1`,
  `status = 'active'`, `startedAt`.
- **Departure** sets `status = 'ended'`, `endedAt`.

### 3. New `workEmailLinks` table (double opt-in tokens)
```sql
CREATE TABLE workEmailLinks (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,              -- the logged-in person adding a work email
  workEmail TEXT NOT NULL,
  token TEXT NOT NULL,
  employmentId TEXT,                 -- the pending roster row it will attach to
  expiresAt TEXT NOT NULL,
  consumedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
```
The verification email itself needs the Resend key — **owner handoff**, same as
invites. We build the flow and stub the send until then.

### 4. Scope check-ins to an employment
Add `employmentId TEXT` to `checkIns` (and later `managerActions`) so team
rollups can count only check-ins made during an active employment window. Cheap
now because no real check-ins exist yet.

---

## Staged approach (honours "smallest change that works")

**Phase A — do now, on approval (this migration):**
1. `migrations/0006_identity_employment.sql`:
   - create `employment` + `workEmailLinks`;
   - add `checkIns.employmentId`;
   - `ALTER TABLE user DROP COLUMN mentorName; ... mentorEmail;` (D1/SQLite
     supports DROP COLUMN);
   - **backfill**: for every existing user that has a `teamId`/`currentCompany`,
     insert one matching `employment` row (`status='active'`).
   - **Keep** `user.teamId/managerId/departmentId/currentCompany/currentRole`
     for now as a *cache of the active employment*, so existing screens keep
     working untouched.
2. Code: remove mentor from `lib/auth.ts`, `lib/types.ts`, `OnboardingForm.tsx`,
   `/api/onboarding`, and the copy file. (Manager section: leave the field but
   keep it unstored, since manager-invite is on hold — or hide it; owner's call.)
3. Add an `employment` data layer (`lib/employment.ts`) + admin roster view uses
   it. Invites/CSV can create `pending` employment rows.

**Phase B — later, when real check-in aggregation is built:**
- Move team rollups to read `employment` (scoped by `startedAt`/`endedAt`), then
  drop the cached job columns off `user`. Build the claim/verify UI end-to-end.

This way the app never breaks between steps, and each step is a separate commit
you can undo.

---

## Reversibility & safety
- New migration is additive first (new tables + backfill) — the destructive part
  (dropping mentor columns) comes after the backfill in the same file and is the
  only irreversible bit; mentor data is being intentionally discarded anyway.
- We take a D1 export/backup before running it (owner triggers `wrangler d1
  export`).
- Every code change is its own commit.

## Owner decisions (settled 2026-07-01)
1. **Manager section in onboarding** — **HIDE it** for Phase A (manager-invite on
   hold). Fields removed from the form; easy to restore later.
2. **`companyName`** — **free-text from onboarding** (`employment.companyName`
   comes from the person's `currentCompany` input).
3. **Backup** — **yes, back up first** via `wrangler d1 export` before applying
   the migration.

## Edge cases to honour (from the decision + edge-cases.md)
- Person signs up with a **work email** → encourage adding a personal email,
  then attach the work one via the verified link.
- **No name-matching**, ever — linking is only via the verified work email.
- **≥3 anonymisation floor** interacts with employment windows: a team's count
  for a period must be ≥3 *active* employments with ≥3 responses.
- Duplicate-account merges remain hard — out of scope for this migration; we
  avoid creating them by never auto-linking.
