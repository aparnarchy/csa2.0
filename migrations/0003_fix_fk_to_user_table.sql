-- Fix all FKs to point to better-auth's 'user' table (singular) instead of 'users' (plural).
-- SQLite doesn't support ALTER COLUMN, so we drop and recreate each table.
-- The 'users' table is superseded by better-auth's 'user' table + additionalFields.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS checkIns;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS journalEntries;
DROP TABLE IF EXISTS streaks;
DROP TABLE IF EXISTS careerCompanies;
DROP TABLE IF EXISTS employeeResponses;
DROP TABLE IF EXISTS userWisdomProgress;
DROP TABLE IF EXISTS user_completed_content;
DROP TABLE IF EXISTS user_completed_modules;
DROP TABLE IF EXISTS user_badges;
DROP TABLE IF EXISTS managerActions;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_roles (
  userId TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','reviewing_manager','ceo_hr','admin')),
  PRIMARY KEY (userId, role),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  managerId TEXT,
  departmentId TEXT,
  FOREIGN KEY (managerId) REFERENCES user(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','employee')),
  invitedBy TEXT NOT NULL,
  teamId TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invitedBy) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkIns (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  pillarId TEXT NOT NULL,
  weekId TEXT NOT NULL,
  score INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  isRetrospective INTEGER NOT NULL DEFAULT 0,
  followUpStatus TEXT CHECK(followUpStatus IN ('acted','not_acted')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id),
  FOREIGN KEY (weekId) REFERENCES weeklyWindows(weekId)
);

CREATE TABLE IF NOT EXISTS managerActions (
  id TEXT PRIMARY KEY,
  managerId TEXT NOT NULL,
  teamId TEXT NOT NULL,
  pillarId TEXT NOT NULL,
  weekId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  recommendationText TEXT,
  actionText TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
  submittedAt TEXT,
  visibleToEmployeesAt TEXT,
  FOREIGN KEY (managerId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS employeeResponses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  actionId TEXT NOT NULL,
  response TEXT NOT NULL CHECK(response IN ('yes','maybe','not_yet')),
  submittedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(userId, actionId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (actionId) REFERENCES managerActions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journalEntries (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  weekId TEXT,
  questionId TEXT,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('follow_up','coaching')),
  submittedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS streaks (
  userId TEXT PRIMARY KEY,
  currentStreak INTEGER NOT NULL DEFAULT 0,
  longestStreak INTEGER NOT NULL DEFAULT 0,
  lastCheckInWeek TEXT,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS careerCompanies (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  startDate TEXT,
  endDate TEXT,
  overallScore REAL,
  pillarScores TEXT,
  questionnaire TEXT,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS userWisdomProgress (
  userId TEXT PRIMARY KEY,
  currentLevel TEXT NOT NULL DEFAULT 'beginner' CHECK(currentLevel IN ('beginner','advanced','expert')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_content (
  userId TEXT NOT NULL,
  contentId TEXT NOT NULL,
  PRIMARY KEY (userId, contentId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (contentId) REFERENCES wisdomContent(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_modules (
  userId TEXT NOT NULL,
  moduleId TEXT NOT NULL,
  PRIMARY KEY (userId, moduleId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (moduleId) REFERENCES wisdomModules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_badges (
  userId TEXT NOT NULL,
  badge TEXT NOT NULL,
  moduleId TEXT NOT NULL,
  earnedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (userId, moduleId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
