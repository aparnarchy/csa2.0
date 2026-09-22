-- A team's manager can only be set to a real user id, but a real org import
-- can name a team's intended manager before that person has ever signed up
-- (open self-signup — the app never creates accounts for people, they create
-- their own). This holds that email until they sign up, at which point the
-- signup hook (lib/auth.ts) resolves it to their new user id and clears it.
ALTER TABLE teams ADD COLUMN pendingManagerEmail TEXT;
