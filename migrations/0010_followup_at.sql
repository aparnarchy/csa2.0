-- Return check-in cooldown.
--
-- The return check-in ("did you act on your last recommendation?") should appear
-- at most once every couple of days, not on every app open. To know when it was
-- last answered we need a timestamp for when followUpStatus was set — the
-- checkIns row only had the status, not when it changed. This column records it;
-- lib/checkins.getReturnCheckIn suppresses the return check-in when the most
-- recent followUpAt is within the cooldown window.

ALTER TABLE checkIns ADD COLUMN followUpAt TEXT;
