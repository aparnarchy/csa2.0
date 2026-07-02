"use server";

/** Company-detail read for the career screen. Own-data (assertOwner in lib/career). */

import { getSession } from "@/lib/auth-session";
import { getCompanyDetail } from "@/lib/career";
import type { CompanyDetail } from "@/lib/data";

export async function getCompanyDetailAction(companyId: string): Promise<CompanyDetail | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCompanyDetail(session.user, session.user.id, companyId);
}
