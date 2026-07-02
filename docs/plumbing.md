# How CSA is wired — the plumbing, in plain English

A one-read guide to the moving parts, what each one does, and the handful of
things only you can do (create accounts, paste keys, approve the go-live).
No code knowledge needed.

---

## 1. The big picture

CSA is a **website that behaves like a phone app** (a "PWA" — people open a link,
then "Add to Home Screen" and it looks/feels like an installed app). There's no
App Store step for the pilot.

Everything runs on top of a few pieces:

```
        ┌─────────────────────────────────────────────┐
        │  Person's phone (browser / installed PWA)     │
        └───────────────┬───────────────────────────────┘
                        │  taps, check-ins, logins
                        ▼
        ┌─────────────────────────────────────────────┐
        │  CSA app  (hosted on CLOUDFLARE PAGES)         │
        │  - shows the screens                           │
        │  - enforces privacy rules on the server        │
        └───┬───────────────┬───────────────┬───────────┘
            │               │               │
            ▼               ▼               ▼
   ┌────────────────┐ ┌───────────┐ ┌────────────────┐
   │ CLOUDFLARE D1  │ │  RESEND   │ │  GEMINI (AI)   │
   │ the database   │ │  sends    │ │  writes the    │
   │ (all the data) │ │  emails   │ │  insight text  │
   └────────────────┘ └───────────┘ └────────────────┘
```

Three of those boxes are **outside helpers** the app "phones out" to. That's what
item 5 is — and the only reason they need **keys** (explained below).

---

## 2. The parts, one by one

For each: **what it is · why we need it · what you do**.

### a) Cloudflare Pages — the hosting
- **What:** the "building" the app lives in on the internet.
- **Why:** so the app has a real web address anyone can open.
- **What you do:** create a Cloudflare account, run one login command in the
  terminal (`wrangler login` — opens your browser to approve), and click
  "approve" on the first go-live. One-time.

### b) Cloudflare D1 — the database
- **What:** the filing cabinet that stores everything — users, check-ins,
  questions, teams, invites, Wisdom content.
- **Why:** the app needs somewhere durable to keep data.
- **What you do:** nothing extra. It's already set up on my machine; it comes
  online automatically when we go live.

### c) better-auth — the front-door lock (login & passwords)
- **What:** the vetted library that handles email + password sign-up, login, and
  "forgot password".
- **Why:** so people log in securely. It scrambles ("hashes") passwords so even
  we can never read them — this is a safety requirement, and we never hand-roll it.
- **What you do:** nothing. **No key needed.**

### d) Resend — the email sender
- **What:** a service that actually delivers emails.
- **Why:** two features need to send email — **invites** (Admin → Invites) and
  **password resets**. Right now both are *built but parked*: invites get recorded,
  but no email leaves until Resend is connected.
- **What you do:** create a Resend account, verify a "from" address, copy its
  **API key**, and I'll tell you exactly where to paste it.

### e) Gemini — the AI that writes insight blurbs
- **What:** Google's AI model.
- **Why:** it turns the numbers into a short, plain-English "here's what your
  scores mean" paragraph (added last, in Phase 5). If Google access is blocked at
  your org, we swap it for another AI — the app doesn't care which.
- **What you do:** get a Gemini API **key** and paste it where I point.

---

## 3. Keys & secrets — what they are, and the one golden rule

A **"key"** is just a **password that lets our app use an outside service** (Resend,
Gemini). The service checks the key to confirm the request is really from us.

Where keys live:
- **On my machine while building:** a private file called `.dev.vars` that is
  **never uploaded to GitHub** (it's on the ignore list).
- **When live:** stored as **Cloudflare "secrets"** — encrypted, not in the code.

> **Golden rule:** never paste a key into a chat, a document, or the code. When
> it's time, I'll point you to the exact spot and you paste it there. If a key
> ever leaks, we just delete it in the service and make a new one.

**What happens without each key (this is today's state):**

| Missing key | Effect |
|---|---|
| No Resend key | Invites/resets are *recorded* but no email is actually sent. |
| No Gemini key | The AI blurb falls back to a simple built-in template. |

So the app fully works for the pilot **before** any keys — keys just switch on the
two "reach the outside world" features.

---

## 4. Where YOUR content (items 1–4) goes in

You said questions, recommendations, Wisdom content, and copy are ready. Here's
how each gets loaded — no key needed for any of it:

| Your content | Goes in via |
|---|---|
| Check-in questions (+ A/B/C scoring) | **Admin → Question bank** (already built) |
| Recommendation text per question | loaded with the questions (admin/seed) |
| Wisdom learning content | **Admin → Wisdom content** (already built) |
| App copy (the words on screens) | **one editable copy file** I'll set up |

---

## 5. Local vs live (a key distinction)

- **Today = "local":** everything runs on my machine. The database is local-only —
  the data you've seen is test data on my computer, not on the internet.
- **"Deploy" = go live:** I copy the app to Cloudflare so anyone with the link can
  use it. At that moment: the database structure is created on the *real*
  Cloudflare database, and the keys move into Cloudflare's secret storage.

Nothing is public until we deliberately deploy — and you approve that step.

---

## 6. The handoff checklist — what only you can do

I can't create accounts or log in as you. These are the moments I'll pause and give
you click-by-click steps. Nothing here is needed to keep *building*; they're for
*going live* and switching on email/AI.

**Needed to go live:**
1. Create a **GitHub** account/repo (or confirm the one to use) and connect it.
2. Create a **Cloudflare** account, run `wrangler login` (browser approve).
3. Approve the **first deploy**.

**Needed to switch on the two outside features (can be after go-live):**
4. Create a **Resend** account, verify a sender, paste the **Resend key**.
5. Get a **Gemini** key (or tell me if Google is blocked so we swap), paste it.

For each, I'll tell you exactly which button to click and what to copy back.

---

## 7. Who does what — the recap

| I do (no keys needed) | You do (the handoffs) |
|---|---|
| Build & wire every screen to the database | Create GitHub + Cloudflare accounts |
| Enforce all privacy rules in server code | Run `wrangler login`, approve deploy |
| Load your questions/Wisdom/copy | Provide Resend + Gemini keys |
| Keep everything working & committed | Approve go-live |
| Set up email/AI code (parked until keyed) | Final look-and-feel review pass |

---

**Bottom line:** items 1–4 are content you already have and I'll load. Item 5 is
just **accounts + keys for three outside services** (Cloudflare to host, Resend to
email, Gemini for AI) — each a quick "create account, paste key" step I'll walk you
through, and none of it blocks me from building the rest now.
