export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { ProfileView } from "./ProfileView";

/** Profile screen. For now it hosts the look & feel (mode + persona) switcher. */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <ProfileView session={session.user} />;
}
