import { redirect } from "next/navigation";

/**
 * The manager Action Inbox now lives at the shared /inbox route (the bottom
 * nav's "Inbox" tab branches by role there) instead of this separate screen —
 * redirect anything still pointing here.
 */
export default function ManagerInboxRedirect() {
  redirect("/inbox");
}
