# EDGE-CASES.md — Culture Super App (CSA)

> Companion to `context.md` and `build-plan.md`. Every scenario here is a decision the code must handle. When you build the screen or rule that touches one of these, open this file and confirm the behaviour. Where the expected behaviour is marked **DECIDE**, the rule isn't locked yet — pick one before that phase and record it in `context.md`'s decisions log.
>
> Stack note: privacy is enforced in **server code** (Next.js route handlers / Workers), not database-level rules. Data lives in **Cloudflare D1**. Auth is **email + password** with **open signup**.

How to use this with Claude Code: when building a feature, paste the relevant section and say *"make sure the implementation handles each of these cases as described."*

---

## 1. Scoring, windows, and data sufficiency

| Scenario | Expected behaviour |
| --- | --- |
| User has 0 responses in the selected time window | Show "Not enough data" — no score, no chart. Never show 0 as if it were a real score. |
| User has 1–2 responses in the window (below the floor of 3) | Show "Not enough data". The 3-response minimum applies per window. |
| A pillar has responses overall but 0 in the selected window | That pillar card shows "Not enough data", not 0. Other pillars still render if they have ≥3. |
| User adds a retrospective (unanswered-screen) answer | It counts toward pillar/overall scores and recalculates historical averages for the week it belongs to — but does NOT count toward the streak. |
| Trend delta when there's no prior window to compare | Hide the delta/arrow rather than showing a misleading +0 or a huge swing from a tiny base. |
| Percentile when the org has very few users | Still compute it, but consider hiding percentile until the org has a minimum number of users (**DECIDE** the minimum, e.g. 5). |

## 2. Streak

| Scenario | Expected behaviour |
| --- | --- |
| User checks in this week with a non-skipped answer | Streak +1 for the week (one per week max, regardless of how many answers). |
| User only submitted retrospective answers this week | Streak does NOT increment — retrospective answers never count. |
| User misses a full week | Streak resets to 0; `longestStreak` is preserved. |
| Week boundary timing | A "week" is defined by `weeklyWindows`. Use that row, not a raw calendar week, so boundaries are consistent across timezones. |

## 3. Check-in question delivery

| Scenario | Expected behaviour |
| --- | --- |
| Same question skipped 3 times in a row | Permanently retire it for that user. It never appears again. |
| User answers a low-scoring option (score < 7) | Recommendation card appears inline before advancing — on both the fresh check-in AND the unanswered screen. |
| Low score answered retrospectively | **DECIDE**: does the recommendation still trigger for a retrospective answer? Recommend yes, flagged as retrospective so the return-check-in loop doesn't nag about a weeks-old item. |
| All 63 questions have been asked | **DECIDE**: repeat the bank from the start, or stop new questions and only surface unanswered ones. For pilot, simplest is to repeat after a cooldown. |
| Two questions land in the same week | Both delivered on random working days, 9am–6pm, in the active weekly window. Don't deliver both on the same day if avoidable. |

## 4. Anonymisation floor (manager visibility)

| Scenario | Expected behaviour |
| --- | --- |
| A team/pillar/question has fewer than 3 responses | Manager sees NO data for it — not a blurred or partial value. Show an "awaiting more responses" state. |
| Team has fewer than 3 reportees | No aggregation at all; manager dashboard shows an "add more reportees / not enough data" state. |
| Team had ≥3 responses, then drops below 3 (someone leaves) | Data hides again — the floor is evaluated live, not locked once unlocked. |
| Manager with fewer than 3 reportees opens the inbox | **DECIDE**: hide the inbox entirely, or show it empty with an explanation. Recommend hide until the floor is met. |
| Manager tries to infer an individual from a 3-person team | Acceptable risk at 3, but never expose response timestamps or any field that could de-anonymise. Aggregates only. |

## 5. Manager action → employee feedback loop

| Scenario | Expected behaviour |
| --- | --- |
| Manager submits an action | Store `submittedAt`; compute `visibleToEmployeesAt = submittedAt + 4 weeks`. Not visible to anyone until then. |
| Who sees the action after 4 weeks | Only employees who scored < 7 on that specific question. Nobody else. |
| Employee who qualified leaves before the 4 weeks elapse | They don't see it (account inactive). The action still counts for remaining qualifying employees. |
| Manager submits multiple actions for the same pillar/question in one week | **DECIDE**: allow multiple, or collapse into one editable action. Recommend one action per question per week to keep the resolution score meaningful. |
| Manager leaves the company mid-cycle | Pending actions stay attached to the team and remain visible to employees on schedule; new actions can't be created by that manager. **DECIDE** who inherits the inbox. |
| Employee responds Yes/Maybe/Not Yet | Write to `employeeResponses`; the manager inbox reflects it on its next poll. Item disappears from the employee's open list, stays in history (6b). |
| Same employee tries to respond twice | Only one response per employee per action. Editing allowed until **DECIDE** a cutoff, or lock on first submit. |

## 6. Roles and org changes

| Scenario | Expected behaviour |
| --- | --- |
| User is both employee and manager | Profile shows a dashboard toggle to switch views. Their own check-ins always go through the employee flow. |
| A user's role changes (promoted to manager) | Admin updates `user_roles`; on next login they get the new dashboard. Old data stays intact. |
| Manager moves to a new team | **DECIDE**: do they keep visibility of the old team's historical aggregates? Recommend no — visibility follows current team only. |
| Employee leaves the org | Account deactivated (**DECIDE**: auto on a signal, or manual by admin). Their past responses remain in team aggregates (anonymised) unless a deletion request says otherwise. |
| Self-signup user (no invite) | Lands as Employee with no team (`onboardingPath = "self_signup"`). An admin/manager can link them to a team later (**DECIDE** retroactive aggregation). |
| User belongs to two orgs (contractor) | **Out of scope for pilot** — one org per account. |

## 7. Onboarding, signup, and invites

| Scenario | Expected behaviour |
| --- | --- |
| User signs up but `onboardingComplete = false` | Force the onboarding form before any dashboard. No skipping. |
| Signup email already has an account | Block duplicate signup; route them to login (and to password reset if needed). |
| Signup email differs from an invited email | Open signup allows it — they just sign up as a self-signup user. An invite only auto-links team/role when the emails match. **DECIDE** if you want to warn on a near-match. |
| Password reset requested for an email with no account | Show the same neutral "if an account exists, we've sent a link" message — don't reveal whether the email is registered. |
| Duplicate invite to the same email | Don't create a second pending invite; reuse/resend the existing one. |
| Invite already accepted, link clicked again | Route to login/dashboard, not back through onboarding. |
| Admin CSV has a malformed row (missing email, bad role) | Reject that row with a clear error, import the valid rows, show a summary of what failed. Never half-import a user silently. |
| CSV references a manager_email that doesn't exist yet | Queue the link and resolve it once that manager is created, or flag the row. Don't crash the import. |

## 8. Career history

| Scenario | Expected behaviour |
| --- | --- |
| First visit to Career History tab | Show the questionnaire prompt; screen stays empty until submitted. |
| User skips the questionnaire | Career view shows an empty/prompt state, not fake data. They can fill it later. |
| Past-company happiness score source | **DECIDE**: self-reported via the questionnaire (recommended for pilot) vs pulled from prior CSA usage. Lock this before building screen 8. |
| Company detail (8b) after editing career history | Snapshots are static — frozen at exit date. Editing the questionnaire shouldn't silently rewrite a past snapshot without intent. |

## 9. Wisdom / Learning

| Scenario | Expected behaviour |
| --- | --- |
| User opens a locked level (Advanced/Expert) | Locked until all modules in the prior level earn their badge. Show what's needed to unlock. |
| User reads an article/watches a video but skips the quiz | Partial credit only; no badge until the quiz is completed. |
| Module's badge already earned, user revisits | No double-award; show as completed. |
| Lowest-scoring pillar changes between sessions | Content re-orders to surface the new lowest pillar first; already-earned progress is unaffected. |
| Admin unpublishes content a user already completed | Keep their earned badge; just hide the content from new users. |
| Content tagged audience "both" | Appears for employees and managers alike. |

## 10. Authentication, privacy, and data

| Scenario | Expected behaviour |
| --- | --- |
| Open signup with a personal email | Allowed by design — the app is shared freely by link. The user lands as a self-signup Employee. |
| Passwords | Stored hashed by the auth library — never plain text, never hand-rolled crypto. |
| Employee requests deletion of their own data | **DECIDE** the policy: what happens to aggregates they contributed to? Recommend: remove their identifiable records, keep anonymised aggregate counts. Decide before Phase 5. |
| Journal entries | Private to the employee. Managers and the org cannot read them. Enforced in **server code**, not just the UI. |
| Data residency | Cloudflare D1 location documented with India/DPDPA in mind in Phase 0. |
| Manager attempts to read an individual's raw score (via the data layer, not the UI) | The **server-side access-control layer** must block it. There are no DB-level rules — every query checks identity/role. Test this directly. |

## 11. AI insights (Gemini Flash / chosen LLM)

| Scenario | Expected behaviour |
| --- | --- |
| AI API call fails or times out | Screen still renders; show the numbers with a graceful "insight unavailable" fallback. Never block a dashboard on the AI call. |
| Not enough data to generate a meaningful insight | Skip the AI snapshot rather than producing a generic/hallucinated one. |
| AI cost/latency on every dashboard load | Cache the generated insight per user/window and only regenerate when underlying scores change. |

## 12. Timing, timezones, notifications

| Scenario | Expected behaviour |
| --- | --- |
| "9am–6pm working hours" — whose timezone? | **DECIDE**: employee's local timezone (recommended) vs org timezone. Lock before Phase 2. |
| What counts as a working day | **DECIDE**: Mon–Fri globally vs configurable per org. Pilot can hardcode Mon–Fri. |
| Weekly window boundary | Driven by `weeklyWindows`; a check-in late on the last day still counts for that week. |
| Employee has notifications off | App still surfaces pending questions in-app (inbox/check-in). Notifications are a nudge, not the only path. |
| Manager notified when an employee responds | **DECIDE**: in-app only (inbox updates on poll) vs also email. Pilot can be in-app only. |

## 13. PWA / mobile delivery

| Scenario | Expected behaviour |
| --- | --- |
| User opens the link in a mobile browser | Prompt/allow "Add to Home Screen"; once installed it opens full-screen, app-like. |
| App opened offline or on a flaky connection | Show a graceful offline/loading state; don't crash to a blank screen. |
| iOS push notifications | Limited for PWAs — rely on in-app + email for the pilot. Native push is a post-pilot (Capacitor) concern. |
| Polling while the app is backgrounded | Pause or slow polling when the app isn't visible, to save battery/requests. |

---

## Quick "must-not-happen" list (privacy-critical — never ship if any of these are possible)

1. A manager can see any individual employee's score or identity.
2. Data shows for a team/pillar/question with fewer than 3 responses.
3. A manager action becomes visible to employees before the 4-week delay.
4. Journal entries are readable by anyone other than the author.
5. A user reaches a dashboard before completing onboarding.
6. Passwords are stored unhashed, or any secret (D1 credentials, email-service key, AI API key) is committed to git.
