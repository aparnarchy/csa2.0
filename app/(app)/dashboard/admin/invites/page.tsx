export const runtime = "edge";

import { redirect } from "next/navigation";

/** Invites now live in the single People table (Admin → People). Kept so old
 *  links and bookmarks still land somewhere useful. */
export default function InvitesPage() {
  redirect("/dashboard/admin/people");
}
