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
  createDepartment,
  createQuestion,
  createTeam,
  deleteDepartment,
  deleteQuestion,
  deleteTeam,
  getOrgStructure,
  listQuestions,
  updateDepartment,
  updateQuestion,
  updateTeam,
  type OrgStructure,
  type QuestionInput,
  type TeamInput,
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
