============================================================
  CSA — APP WORDING (edit the words here)
============================================================

This folder is YOURS. Every file here is one screen of the app.
You can change any of the wording, titles, and button text
WITHOUT touching code.

------------------------------------------------------------
HOW TO EDIT
------------------------------------------------------------
1. Open the screen's file (e.g. 01_login.txt).
2. Find the bit you want to change — each one looks like:

       # Section 1 — the big title
       [Page title]
       Sign in to CSA

3. Change ONLY the text on the line(s) UNDER the [Label].
   In the example above, you'd change "Sign in to CSA".

4. DO NOT change the [Labels in brackets] or the # comment
   lines — those tell the app where each piece of text goes.

5. Anything in curly braces like {name} or {email} is filled
   in by the app automatically. Keep it as-is, move it if you
   like — e.g. "Nice work, {name}!" → "Way to go, {name}!"

------------------------------------------------------------
HOW TO SEE YOUR CHANGES
------------------------------------------------------------
After editing, the changes show up the next time the app is
(re)started/rebuilt. If Claude is running the dev server, just
ask it to restart, or run:  npm run copy

------------------------------------------------------------
THE SCREENS
------------------------------------------------------------
01_login.txt        Screen 1  — Log in
02_signup.txt       Screen 2  — Create account
03_reset.txt        Screen 3  — Reset password
04_onboarding.txt   Screen 4  — First-time setup
05_checkin.txt      Screen 5  — Weekly check-in
06_catchup.txt      Screen 6  — Catch up on missed weeks
07_followup.txt     Screen 7  — Follow up on a past nudge

(More screens — the dashboards — can be added here on request.)
