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
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
  type QuestionInput,
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
