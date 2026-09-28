/**
 * Testing mode — temporary switches for the test period.
 *
 * While TESTING_MODE is true:
 *   - every user gets ONE check-in question per day (instead of 2 per week)
 *   - a manager's submitted action reaches affected employees after 1 week
 *     (instead of 4)
 *
 * Set TESTING_MODE to false and redeploy to go back to the real product rules.
 * No server-only imports here: the manager inbox (a client component) reads the
 * delay too.
 */
export const TESTING_MODE = true;

/** One check-in question per day (testing) vs. 2 per week (normal). */
export const DAILY_QUESTIONS = TESTING_MODE;

/** Weeks of delay before a submitted manager action becomes visible to employees. */
export const MANAGER_ACTION_DELAY_WEEKS = TESTING_MODE ? 1 : 4;
