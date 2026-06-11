# Screen Mapping — Prototype → CSA 2.0

> Every prototype component mapped to its `context.md` equivalent.
> **BUILD FRESH** = rebuild in Next.js + Tailwind using prototype as visual reference.
> **DROP** = cut from the pilot; do not build.
> **NO PROTOTYPE** = new screen with no prototype reference; build from spec only.

---

## Individual / Employee screens

| Prototype file | context.md screen | Status | Notes |
|---|---|---|---|
| `WelcomeScreen.jsx` | Onboarding form (all paths, first login) | BUILD FRESH | Prototype is a splash screen only. We need email+password signup + full onboarding form fields. |
| `QuestionScreen.jsx` | Screen 1 — Check-in question screen | BUILD FRESH | Core A/B/C card layout; reuse visual style. |
| `CheckInScreen.jsx` | Screen 1 — Check-in question screen | BUILD FRESH | Variant of QuestionScreen; merge into one check-in screen. |
| `UnansweredScreen.jsx` | Screen 2 — Unanswered questions | BUILD FRESH | "2 of 5" progress + Save & Next + Skip; reuse layout. |
| `ReturnCheckIn.jsx` | Screen 3 — Return check-in / follow-up | BUILD FRESH | "Were you able to act?" flow; reuse copy and layout. |
| `AnalysisScreen.jsx` | Screen 4 — Analysis screen (main dashboard) | BUILD FRESH | Richest prototype screen; use as primary visual template. |
| `LearningScreen.jsx` | Screen 5 — Wisdom / Learning | BUILD FRESH | Prototype calls levels Beginner/Intermediate/Expert; spec locks Beginner/Advanced/Expert. Use layout, rename levels. |
| `InboxScreen.jsx` | Screen 6 — Inbox (+ 6b history) | BUILD FRESH | Use layout; add 4-week delay logic and history tab. |
| `IndividualProfile.jsx` | Screen 7 — Profile | BUILD FRESH | Use layout; remove heatmap, add badge row and dashboard toggle. |
| `FeedbackScreen.jsx` | Feedback / coaching screen | **DROP** | Cut from pilot per spec. |
| `CommunityScreen.jsx` | Community / social feed | **DROP** | Cut from pilot per spec. |
| `StreakScreen.jsx` | Streak calendar heatmap | **DROP** | Heatmap cut. Streak counter (flame + number + dot row) is kept but lives inline in Profile and Analysis, not a separate screen. |
| `AletheiaScreen.jsx` | Aletheia AI assistant | **DROP** | Cut from pilot per spec. |
| `ProfileSelector.jsx` | Role selector | **DROP** | Replaced by server-side role routing. Dual-role handled via toggle in Profile screen. |
| *(none)* | Screen 8 — Career history | NO PROTOTYPE | Build from spec. |
| *(none)* | Screen 8b — Company detail (static snapshot) | NO PROTOTYPE | Build from spec. |

---

## Manager screens

| Prototype file | context.md screen | Status | Notes |
|---|---|---|---|
| `manager/ManagerFirstTime.jsx` | Screen 9 — Manager onboarding popup | BUILD FRESH | First-login explainer; add Path 2 invite flow. |
| `manager/ManagerCheckIn.jsx` | Manager check-in screen | **DROP** | Cut from pilot. Managers do their own check-in via the standard employee flow. |
| `manager/ManagerDashboard.jsx` | Screen 10 — Manager dashboard | BUILD FRESH | Use as primary visual reference for team score, pillar cards, trend chart. |
| `manager/ManagerInbox.jsx` | Screen 11 — Manager inbox | BUILD FRESH | Use layout; implement 4-week delay, polling, flagged section. |
| `manager/ManagerWisdom.jsx` | Screen 12 — Manager wisdom | BUILD FRESH | Same structure as employee wisdom; filter by audience = manager. |
| `manager/ManagerLearning.jsx` | Screen 12 — Manager wisdom (content view) | BUILD FRESH | Merge with ManagerWisdom; one wisdom screen with in-module content view. |
| `manager/ManagerProfile.jsx` | Profile screen (manager view) | BUILD FRESH | Same Profile component as employee; toggled via role switch. |
| `manager/ManagerTools.jsx` | *(internal manager tools)* | **DROP** | No matching pilot screen; functionality absorbed into the inbox and admin panel. |
| `manager/ReviewingManagerScreen.jsx` | Screens 13 + 13b — Reviewing Manager list + detail | BUILD FRESH | Use layout; remove participation rate next to names. |
| `manager/DeptHeadDashboard.jsx` | Department Head dashboard | **DROP** | Dept Head view cut from pilot per spec. |

---

## Shared / utility components

| Prototype file | context.md equivalent | Status | Notes |
|---|---|---|---|
| `Avatar.jsx` | Mascot / avatar component | BUILD FRESH | Use as visual reference for the mascot expression sprite. |
| `Mascot.jsx` | Mascot image | BUILD FRESH | Reuse the design; implement as a Next.js Image component. |
| `BottomNav.jsx` | `ScreenShell` bottom nav (employee) | BUILD FRESH | Part of the shared `ScreenShell` component kit. |
| `manager/ManagerBottomNav.jsx` | `ScreenShell` bottom nav (manager) | BUILD FRESH | Merge with ScreenShell; active tab driven by role. |

---

## Screens with no prototype reference (build from spec only)

| context.md screen | Phase | Notes |
|---|---|---|
| Signup / login page (email + password) | Phase 1 | No prototype; pure spec build. |
| Password reset flow | Phase 1 | No prototype. |
| Screen 8 — Career history | Phase 2 | No prototype; spec defines layout top-to-bottom. |
| Screen 8b — Company detail | Phase 2 | No prototype. |
| Screen 14 — CEO / HR dashboard | Phase 4 | No prototype; same shape as manager dashboard at org scope. |
| Screen 15 — Admin panel | Phase 4 | No prototype; four sections from spec. |

---

## Summary counts

| Status | Count |
|---|---|
| BUILD FRESH (with prototype reference) | 16 |
| DROP | 8 |
| NO PROTOTYPE (build from spec) | 6 |
| **Total** | **30** |
