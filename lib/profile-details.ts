import type { getDB } from "./db";

type DB = ReturnType<typeof getDB>;

/** The sign-up details a person can edit on Profile (their own only). */
export interface OwnDetails {
  name: string;
  company: string | null;
  role: string | null;
  yearsOfExperience: number | null;
  /** Their organisation set them up (team/department/employee ID from an
      admin roster or invite), so the company name isn't theirs to change. */
  companyLocked: boolean;
  /** The active job record the edit also updates, if any. */
  employmentId: string | null;
}

export async function getOwnDetails(db: DB, userId: string): Promise<OwnDetails> {
  const [u, emp] = await Promise.all([
    db
      .prepare("SELECT name, currentCompany, currentRole, yearsOfExperience FROM user WHERE id = ?")
      .bind(userId)
      .first<{ name: string; currentCompany: string | null; currentRole: string | null; yearsOfExperience: number | null }>(),
    db
      .prepare(
        `SELECT id, companyName, designation, teamId, departmentId, employeeId FROM employment
          WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1`,
      )
      .bind(userId)
      .first<{
        id: string;
        companyName: string | null;
        designation: string | null;
        teamId: string | null;
        departmentId: string | null;
        employeeId: string | null;
      }>(),
  ]);
  return {
    name: u?.name ?? "",
    // The job record is what the rest of the app shows; the user columns are its cache.
    company: emp?.companyName ?? u?.currentCompany ?? null,
    role: emp?.designation ?? u?.currentRole ?? null,
    yearsOfExperience: u?.yearsOfExperience ?? null,
    companyLocked: Boolean(emp && (emp.teamId || emp.departmentId || emp.employeeId)),
    employmentId: emp?.id ?? null,
  };
}
