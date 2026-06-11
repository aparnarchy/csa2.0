# OWNER-PLAYBOOK.md — how to build CSA 2.0 as a non-technical owner

> This is for YOU, not for Claude Code. It's how to drive the build without writing code: the habits that keep you safe, how to test things you can't read, the warning signs, and ready-to-paste prompts. Keep it open while you work.

---

## The 5 golden rules (if you remember nothing else)

1. **One thing at a time.** Ask Claude to build a single screen or feature per session. Never "build the whole app."
2. **Plan before code.** Always make Claude tell you its plan and wait for your "go." You catch wrong turns before they cost time.
3. **Commit every time something works.** This is your save point. Say: *"commit this and tell me in plain English what it does."*
4. **Test before moving on.** Click through it yourself. If you can't, ask Claude how to check it works.
5. **Keep context.md true.** When you decide something, tell Claude to update `docs/context.md`. The docs are the brain of the project.

---

## Your work rhythm (repeat this loop)

**Plan → Go → Build → Test → Commit → Next.**

1. **Plan** — paste your task and ask for a 3–5 step plan.
2. **Go** — if the plan looks sensible, say "go." If not, correct it in plain English.
3. **Build** — let Claude work. Read its plain-English summary, not the code.
4. **Test** — try it yourself in the browser, or ask Claude to walk you through checking it.
5. **Commit** — "commit this with a clear message."
6. **Next** — only now start the next screen.

Never have two half-finished screens at once. That's the #1 cause of the tangled bugs you're trying to avoid.

---

## How to test when you can't read code

You don't need to read code to know if something works. Use these:

- **Click it yourself.** Open the app in the browser (Claude will give you a `localhost` link). Does the screen look right? Does the button do what it should?
- **Ask for a test plan:** *"Give me 5 things to click to confirm this screen works, in plain English."*
- **Ask it to prove the rule:** *"Show me that a manager genuinely cannot see an individual's score — how do I verify that myself?"*
- **Use the seed data.** You'll have fake users (one per role). Log in as each and check they see the right thing.
- **Screenshot problems.** If something looks wrong, screenshot it and paste it to Claude: *"this looks off, here's a screenshot — what's wrong and what's the smallest fix?"*

---

## Git, explained simply (your undo button)

Git saves snapshots of your project. You don't need to master it — just build these habits:

- **Commit = save point.** After every working screen, "commit this."
- **Push = backup to GitHub.** Once a day: *"push everything to GitHub."* Now it's safe even if your laptop dies.
- **Roll back = undo.** When something breaks badly, don't debug for hours — say: *"this is broken, roll back to the last working commit."* You lose only the broken work, nothing else.

That's 90% of what you'll ever need.

---

## Warning signs — STOP and slow down if you see these

- Claude starts changing **many files** when you asked for one screen → say *"stop, only touch the screen I asked about."*
- It says it's **refactoring** or **cleaning up** things you didn't mention → stop it; that's how working things break.
- You've gone a long stretch **without a commit** → commit now before anything else.
- It's **fixing a bug by changing several things at once** → ask for the smallest single fix instead.
- The app **was working an hour ago and now isn't**, and you can't tell why → roll back to the last commit rather than digging.
- It wants to **add a new library/tool** you didn't ask about → ask why, and whether it's really needed.

---

## How to phrase requests (specific beats vague)

**Good** (you'll get good results):
- "Build only the employee check-in screen from build-plan.md Phase 2.1. Wire it to lib/data.ts. Show me your plan first."
- "The pillar card colour is wrong — it should be green at 7+. Smallest fix only."

**Bad** (invites sprawl and bugs):
- "Start building." / "Make it all work." / "Improve the app."

Rule of thumb: name the **one screen or rule**, point to the **doc section**, and ask for a **plan first**.

---

## Managing decisions (the DECIDE items)

`build-plan.md` lists small decisions to lock before each phase (e.g. timezone for working hours, what happens when someone leaves). When you hit one:

1. Decide it (ask Claude to lay out the options in plain English if you're unsure).
2. Tell Claude: *"update docs/context.md decisions log with this."*
3. Then continue building.

Don't leave decisions floating — an undecided rule built two different ways is a classic source of circular bugs.

---

## Safety habits (non-negotiable)

- **Never share or commit secret keys.** Claude handles this, but if you ever see it about to put a Firebase key or Gemini key into a normal file, stop it — keys live only in `.env.local`.
- **Test the privacy rules on purpose.** Before launch, confirm a manager genuinely cannot reach an individual's score. Ask Claude to prove it to you.
- **Back up to GitHub daily.** "Push to GitHub."

---

## When you're stuck

- **Roll back first, debug second.** The last commit is almost always faster than fixing a mess.
- **Ask for plain English.** *"Explain what's broken like I'm not technical, and give me the simplest fix."*
- **Take a break at a commit.** Always stop work at a clean, committed point so you can pick up easily.
- **One change at a time when fixing.** Resist letting Claude "try a few things" — that's how one bug becomes three.

---

## Copy-paste shortcut prompts

**Start a session:**
> "Re-read CLAUDE.md and docs/. Today we build ONLY: <screen/feature>. Give me your 3–5 step plan and wait for my go."

**Approve:**
> "Plan looks good — go. Commit when it works and tell me in plain English what changed."

**Get a test plan:**
> "Give me 5 simple things to click to confirm this works."

**Something looks wrong:**
> "This looks off [screenshot]. Don't make broad changes — find the smallest cause, explain it simply, propose the smallest fix, wait for my go."

**Undo:**
> "This is broken. Roll back to the last working commit."

**Record a decision:**
> "We've decided <X>. Update docs/context.md decisions log, then continue."

**Daily backup:**
> "Push everything to GitHub."

**End a session cleanly:**
> "Commit where we are and give me a one-line note of what's done and what's next."

---

## Knowing a phase is "done"

A phase is done when every box in that phase's test list in `build-plan.md` is ticked AND everything is committed. Only then start the next phase. Going in order, fully finishing each phase, is what keeps the build from collapsing under its own weight.

---

## A note on pace

You're doing this solo and non-technically — slower-but-clean beats fast-but-tangled every single time. Finishing one solid screen a session is real progress. Protect the order of the phases over any deadline, and you'll get there without the circular bugs.
