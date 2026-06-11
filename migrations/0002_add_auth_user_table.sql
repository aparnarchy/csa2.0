-- better-auth uses a 'user' table (singular). We add all app-specific fields here too.
-- This replaces the need for a separate 'users' table for auth identity.

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  -- App-specific profile fields (managed as better-auth additionalFields)
  onboardingComplete INTEGER NOT NULL DEFAULT 0,
  onboardingPath TEXT,
  teamId TEXT,
  managerId TEXT,
  departmentId TEXT,
  currentCompany TEXT,
  currentRole TEXT,
  yearsOfExperience INTEGER,
  mentorName TEXT,
  mentorEmail TEXT
);
