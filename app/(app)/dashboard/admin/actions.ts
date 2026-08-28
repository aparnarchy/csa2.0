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
  cancelInvite,
  createInvite,
  getInvites,
  importInvitesCsv,
  resendInvite,
  type BulkDeleteResult,
  type CsvImportResult,
  type InviteInput,
  type InviteWithMeta,
  type OrgStructure,
  type QuestionInput,
  type RecommendationRow,
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
  text: string,
): Promise<RecommendationRow[]> {
  const user = await requireAdmin();
  return upsertRecommendation(user, questionId, text);
}

export async function clearRecommendationAction(questionId: string): Promise<RecommendationRow[]> {
  const user = await requireAdmin();
  return clearRecommendation(user, questionId);
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

// ── Invites ─────────────────────────────────────────────────────────────────

export async function createInviteAction(input: InviteInput): Promise<InviteWithMeta[]> {
  const user = await requireAdmin();
  await createInvite(user, input);
  return getInvites(user);
}

export async function resendInviteAction(id: string): Promise<InviteWithMeta[]> {
  const user = await requireAdmin();
  await resendInvite(user, id);
  return getInvites(user);
}

export async function cancelInviteAction(id: string): Promise<InviteWithMeta[]> {
  const user = await requireAdmin();
  await cancelInvite(user, id);
  return getInvites(user);
}

/** Bulk import; returns both the summary and the refreshed list. */
export async function importInvitesCsvAction(
  text: string,
): Promise<{ result: CsvImportResult; invites: InviteWithMeta[] }> {
  const user = await requireAdmin();
  const result = await importInvitesCsv(user, text);
  const invites = await getInvites(user);
  return { result, invites };
}
