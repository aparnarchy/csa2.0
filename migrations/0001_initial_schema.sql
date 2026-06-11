-- CSA 2.0 — Initial schema
-- All tables for the Culture Super App pilot

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  teamId TEXT,
  managerId TEXT,
  departmentId TEXT,
  currentCompany TEXT,
  currentRole TEXT,
  yearsOfExperience INTEGER,
  mentorName TEXT,
  mentorEmail TEXT,
  onboardingComplete INTEGER NOT NULL DEFAULT 0,
  onboardingPath TEXT CHECK(onboardingPath IN ('admin_upload','manager_invite','individual_invite','self_signup')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  userId TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','reviewing_manager','ceo_hr','admin')),
  PRIMARY KEY (userId, role),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  managerId TEXT,
  departmentId TEXT,
  FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','employee')),
  invitedBy TEXT NOT NULL,
  teamId TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weeklyWindows (
  weekId TEXT PRIMARY KEY,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  pillarId TEXT NOT NULL CHECK(pillarId IN ('meaningful_work','growth','culture','compensation')),
  optionA_text TEXT NOT NULL,
  optionA_score INTEGER NOT NULL,
  optionB_text TEXT NOT NULL,
  optionB_score INTEGER NOT NULL,
  optionC_text TEXT NOT NULL,
  optionC_score INTEGER NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1
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
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id),
  FOREIGN KEY (weekId) REFERENCES weeklyWindows(weekId)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  questionId TEXT NOT NULL,
  pillarId TEXT NOT NULL,
  scoreBandMin INTEGER NOT NULL,
  scoreBandMax INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
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
  FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS employeeResponses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  actionId TEXT NOT NULL,
  response TEXT NOT NULL CHECK(response IN ('yes','maybe','not_yet')),
  submittedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(userId, actionId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
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
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS streaks (
  userId TEXT PRIMARY KEY,
  currentStreak INTEGER NOT NULL DEFAULT 0,
  longestStreak INTEGER NOT NULL DEFAULT 0,
  lastCheckInWeek TEXT,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wisdomModules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pillarId TEXT NOT NULL,
  audience TEXT NOT NULL CHECK(audience IN ('employee','manager','both')),
  level TEXT NOT NULL CHECK(level IN ('beginner','advanced','expert')),
  badgeAwarded TEXT,
  isActive INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS wisdomContent (
  id TEXT PRIMARY KEY,
  moduleId TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('lesson','article','video','quiz')),
  pillarId TEXT NOT NULL,
  audience TEXT NOT NULL,
  body TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL,
  hasQuiz INTEGER NOT NULL DEFAULT 0,
  quizQuestions TEXT,
  FOREIGN KEY (moduleId) REFERENCES wisdomModules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS userWisdomProgress (
  userId TEXT PRIMARY KEY,
  currentLevel TEXT NOT NULL DEFAULT 'beginner' CHECK(currentLevel IN ('beginner','advanced','expert')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_content (
  userId TEXT NOT NULL,
  contentId TEXT NOT NULL,
  PRIMARY KEY (userId, contentId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contentId) REFERENCES wisdomContent(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_modules (
  userId TEXT NOT NULL,
  moduleId TEXT NOT NULL,
  PRIMARY KEY (userId, moduleId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (moduleId) REFERENCES wisdomModules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_badges (
  userId TEXT NOT NULL,
  badge TEXT NOT NULL,
  moduleId TEXT NOT NULL,
  earnedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (userId, moduleId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- sessions table is managed by better-auth; defined here for reference
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER,
  updatedAt INTEGER
);
