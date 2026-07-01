export type PillarId = 'meaningful_work' | 'growth' | 'culture' | 'compensation';
export type Role = 'employee' | 'manager' | 'reviewing_manager' | 'ceo_hr' | 'admin';
export type OnboardingPath = 'admin_upload' | 'manager_invite' | 'individual_invite' | 'self_signup';
export type WisdomLevel = 'beginner' | 'advanced' | 'expert';
export type WisdomAudience = 'employee' | 'manager' | 'both';
export type ContentType = 'lesson' | 'article' | 'video' | 'quiz';
export type ActionStatus = 'open' | 'in_progress' | 'resolved';
export type InviteStatus = 'pending' | 'accepted';
export type FollowUpStatus = 'acted' | 'not_acted';

// Look & feel. Mode = design only (Professional ↔ Play). Persona lives under
// Play and changes the voice/copy (Spiderman / Batman).
export type ThemeMode = 'professional' | 'play';
export type Persona = 'spiderman' | 'batman';
export type EmployeeResponseValue = 'yes' | 'maybe' | 'not_yet';
export type JournalType = 'follow_up' | 'coaching';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  teamId: string | null;
  managerId: string | null;
  departmentId: string | null;
  currentCompany: string | null;
  currentRole: string | null;
  yearsOfExperience: number | null;
  onboardingComplete: boolean;
  onboardingPath: OnboardingPath | null;
  createdAt: string;
}

export interface UserRole {
  userId: string;
  role: Role;
}

export interface Team {
  id: string;
  name: string;
  managerId: string | null;
  departmentId: string | null;
}

export interface Department {
  id: string;
  name: string;
}

export interface Invite {
  id: string;
  email: string;
  role: 'manager' | 'employee';
  invitedBy: string;
  teamId: string | null;
  status: InviteStatus;
  createdAt: string;
}

export interface WeeklyWindow {
  weekId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Question {
  id: string;
  text: string;
  pillarId: PillarId;
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
  isActive: boolean;
}

export interface CheckIn {
  id: string;
  userId: string;
  questionId: string;
  pillarId: PillarId;
  weekId: string;
  score: number;
  timestamp: string;
  isRetrospective: boolean;
  followUpStatus: FollowUpStatus | null;
}

export interface Recommendation {
  id: string;
  questionId: string;
  pillarId: PillarId;
  scoreBandMin: number;
  scoreBandMax: number;
  text: string;
}

export interface ManagerAction {
  id: string;
  managerId: string;
  teamId: string;
  pillarId: PillarId;
  weekId: string;
  questionId: string;
  recommendationText: string | null;
  actionText: string | null;
  status: ActionStatus;
  submittedAt: string | null;
  visibleToEmployeesAt: string | null;
}

export interface EmployeeResponse {
  id: string;
  userId: string;
  actionId: string;
  response: EmployeeResponseValue;
  submittedAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  weekId: string | null;
  questionId: string | null;
  text: string;
  type: JournalType;
  submittedAt: string;
}

export interface Streak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckInWeek: string | null;
}

export interface CareerCompany {
  id: string;
  userId: string;
  name: string;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  overallScore: number | null;
  pillarScores: Record<PillarId, number> | null;
  questionnaire: Record<string, string> | null;
}

export interface WisdomModule {
  id: string;
  title: string;
  pillarId: PillarId;
  audience: WisdomAudience;
  level: WisdomLevel;
  badgeAwarded: string | null;
  isActive: boolean;
}

export interface WisdomContent {
  id: string;
  moduleId: string;
  title: string;
  type: ContentType;
  pillarId: PillarId;
  audience: WisdomAudience;
  body: string | null;
  sortOrder: number;
  isActive: boolean;
  level: WisdomLevel;
  hasQuiz: boolean;
  quizQuestions: Array<{ question: string; options: string[]; answer: number }> | null;
}

export interface UserWisdomProgress {
  userId: string;
  currentLevel: WisdomLevel;
}

export interface UserBadge {
  userId: string;
  badge: string;
  moduleId: string;
  earnedAt: string;
}

// ── Session user (returned by auth, used throughout the app) ──────────────────
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  onboardingComplete: boolean;
  teamId: string | null;
  themeMode: ThemeMode;
  persona: Persona;
}
