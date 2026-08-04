"use server";

/**
 * Career-screen reads and the questionnaire write. Identity is re-derived from
 * the session here; the real guard (assertOwner) lives in lib/career.
 */

import { getSession } from "@/lib/auth-session";
import {
  addCareerCompany,
  deleteCareerCompany,
  getCareerQuestions,
  getCompanyDetail,
  type AddCareerCompanyInput,
  type CareerQuestion,
} from "@/lib/career";
import type { CompanyDetail } from "@/lib/data";

export async function getCompanyDetailAction(companyId: string): Promise<CompanyDetail | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCompanyDetail(session.user, session.user.id, companyId);
}

/** The career questionnaire. Not user-specific, but sign-in still required. */
export async function getCareerQuestionsAction(): Promise<CareerQuestion[]> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCareerQuestions();
}

/** Writes one completed questionnaire as a past-company snapshot. */
export async function addCareerCompanyAction(input: AddCareerCompanyInput): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return addCareerCompany(session.user, session.user.id, input);
}

/** Removes one past company. Past companies only — see lib/career. */
export async function deleteCareerCompanyAction(companyId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return deleteCareerCompany(session.user, session.user.id, companyId);
}
