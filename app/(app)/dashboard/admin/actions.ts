"use server";

/**
 * Admin server actions (Phase 4.4). Thin wrappers the client screens call to
 * persist changes. Each one re-fetches the session and the underlying lib/admin
 * functions re-check the admin role, so authorisation is enforced server-side
 * regardless of what the client sends. Mutations return the fresh list so the
 * screen can re-render from the source of truth.
 */

import { getSession } from "@/lib/auth-session";
import {
  bulkDeleteQuestions,
  clearRecommendation,
  createDepartment,
  createQuestion,
  createTeam,
  deleteDepartment,
  deleteQuestion,
  deleteTeam,
  getOrgStructure,
  getRecommendationsCms,
  importQuestionsCsv,
  listQuestions,
  updateDepartment,
  updateQuestion,
  updateTeam,
  upsertRecommendation,
  createContent,
  createModule,
  deleteContent,
  deleteModule,
  getWisdomCms,
  updateContent,
  updateModule,
  importInvitesCsv,
  resendInvite,
  approvePendingManager,
  rejectPendingManager,
  getDirectory,
  addPerson,
  updatePerson,
  bulkSetStatus,
  deletePeople,
  type BulkResult,
  type Directory,
  type PersonInput,
  type BulkDeleteResult,
  type CsvImportResult,
  type OrgStructure,
  type QuestionInput,
  type RecommendationRow,
  type RecommendationAudience,
  type TeamInput,
  type WisdomContentInput,
  type WisdomModuleInput,
  type WisdomModuleWithContent,
} from "@/lib/admin";
import type { Question } from "@/lib/types";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session.user;
}

export async function listQuestionsAction(): Promise<Question[]> {
  const user = await requireAdmin();
  return listQuestions(user);
}

export async function createQuestionAction(input: QuestionInput): Promise<Question[]> {
  const user = await requireAdmin();
  await createQuestion(user, input);
  return listQuestions(user);
}

export async function updateQuestionAction(id: string, input: QuestionInput): Promise<Question[]> {
  const user = await requireAdmin();
  await updateQuestion(user, id, input);
  return listQuestions(user);
}

export async function deleteQuestionAction(id: string): Promise<Question[]> {
  const user = await requireAdmin();
  await deleteQuestion(user, id);
  return listQuestions(user);
}

export async function bulkDeleteQuestionsAction(
  ids: string[],
): Promise<{ result: BulkDeleteResult; questions: Question[] }> {
  const user = await requireAdmin();
  const result = await bulkDeleteQuestions(user, ids);
  return { result, questions: await listQuestions(user) };
}

export async function importQuestionsCsvAction(
  text: string,
): Promise<{ result: CsvImportResult; questions: Question[] }> {
  const user = await requireAdmin();
  const result = await importQuestionsCsv(user, text);
  return { result, questions: await listQuestions(user) };
}

export async function getRecommendationsAction(): Promise<RecommendationRow[]> {
  const user = await requireAdmin();
  return getRecommendationsCms(user);
}

export async function upsertRecommendationAction(
  questionId: string,
  audience: RecommendationAudience,
  text: string,
): Promise<RecommendationRow[]> {
  const user = await requireAdmin();
  return upsertRecommendation(user, questionId, audience, text);
}

export async function clearRecommendationAction(
  questionId: string,
  audience: RecommendationAudience,
): Promise<RecommendationRow[]> {
  const user = await requireAdmin();
  return clearRecommendation(user, questionId, audience);
}

// ── Org structure ─────────────────────────────────────────────────────────────

export async function createDepartmentAction(name: string): Promise<OrgStructure> {
  const user = await requireAdmin();
  await createDepartment(user, name);
  return getOrgStructure(user);
}

export async function updateDepartmentAction(id: string, name: string): Promise<OrgStructure> {
  const user = await requireAdmin();
  await updateDepartment(user, id, name);
  return getOrgStructure(user);
}

export async function deleteDepartmentAction(id: string): Promise<OrgStructure> {
  const user = await requireAdmin();
  await deleteDepartment(user, id);
  return getOrgStructure(user);
}

export async function createTeamAction(input: TeamInput): Promise<OrgStructure> {
  const user = await requireAdmin();
  await createTeam(user, input);
  return getOrgStructure(user);
}

export async function updateTeamAction(id: string, input: TeamInput): Promise<OrgStructure> {
  const user = await requireAdmin();
  await updateTeam(user, id, input);
  return getOrgStructure(user);
}

export async function deleteTeamAction(id: string): Promise<OrgStructure> {
  const user = await requireAdmin();
  await deleteTeam(user, id);
  return getOrgStructure(user);
}

// ── Wisdom content CMS ────────────────────────────────────────────────────────

export async function createModuleAction(
  input: WisdomModuleInput,
): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await createModule(user, input);
  return getWisdomCms(user);
}

export async function updateModuleAction(
  id: string,
  input: WisdomModuleInput,
): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await updateModule(user, id, input);
  return getWisdomCms(user);
}

export async function deleteModuleAction(id: string): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await deleteModule(user, id);
  return getWisdomCms(user);
}

export async function createContentAction(
  moduleId: string,
  input: WisdomContentInput,
): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await createContent(user, moduleId, input);
  return getWisdomCms(user);
}

export async function updateContentAction(
  id: string,
  input: WisdomContentInput,
): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await updateContent(user, id, input);
  return getWisdomCms(user);
}

export async function deleteContentAction(id: string): Promise<WisdomModuleWithContent[]> {
  const user = await requireAdmin();
  await deleteContent(user, id);
  return getWisdomCms(user);
}

// ── People directory (people + invites in one table) ─────────────────────────

export async function getDirectoryAction(): Promise<Directory> {
  const user = await requireAdmin();
  return getDirectory(user);
}

export async function addPersonAction(input: PersonInput): Promise<Directory> {
  const user = await requireAdmin();
  await addPerson(user, input);
  return getDirectory(user);
}

export async function updatePersonAction(key: string, input: PersonInput): Promise<Directory> {
  const user = await requireAdmin();
  await updatePerson(user, key, input);
  return getDirectory(user);
}

export async function bulkSetStatusAction(
  keys: string[],
  to: "active" | "resigned",
  endedAt: string | null,
): Promise<{ result: BulkResult; directory: Directory }> {
  const user = await requireAdmin();
  const result = await bulkSetStatus(user, keys, to, endedAt);
  return { result, directory: await getDirectory(user) };
}

export async function deletePeopleAction(
  keys: string[],
): Promise<{ result: BulkResult; directory: Directory }> {
  const user = await requireAdmin();
  const result = await deletePeople(user, keys);
  return { result, directory: await getDirectory(user) };
}

/** Email one invite its signup link (records whether it was delivered). */
export async function emailInviteAction(inviteId: string): Promise<Directory> {
  const user = await requireAdmin();
  await resendInvite(user, inviteId);
  return getDirectory(user);
}

/** Roster / people-list upload; returns the summary and the refreshed table. */
export async function importPeopleCsvAction(
  text: string,
): Promise<{ result: CsvImportResult; directory: Directory }> {
  const user = await requireAdmin();
  const result = await importInvitesCsv(user, text);
  return { result, directory: await getDirectory(user) };
}

export async function approvePendingManagerAction(teamId: string): Promise<Directory> {
  const user = await requireAdmin();
  await approvePendingManager(user, teamId);
  return getDirectory(user);
}

export async function rejectPendingManagerAction(teamId: string): Promise<Directory> {
  const user = await requireAdmin();
  await rejectPendingManager(user, teamId);
  return getDirectory(user);
}
