-- Optional personal email a person can add on their Profile, so their account
-- and data can follow them when their work inbox is shut down after they leave.
-- Stored only for now (unverified, not a login): the email service can't yet
-- deliver to arbitrary inboxes to confirm ownership, so switching login to it
-- waits until a sending domain is verified.
ALTER TABLE user ADD COLUMN personalEmail TEXT;
