-- An employee can leave a note when responding to a manager's action ("Did
-- you notice the change?"). Previously this only went into their own private
-- journal — never reached the manager. This column lets it also feed the
-- manager's inbox, but only in aggregate (see lib/feedback.ts getManagerInbox,
-- which requires >= ANONYMISATION_FLOOR notes on the same action before
-- surfacing any of them, same rule as every other team aggregate).
ALTER TABLE employeeResponses ADD COLUMN note TEXT;
