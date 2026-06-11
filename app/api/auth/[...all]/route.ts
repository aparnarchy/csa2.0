import { createAuth } from "@/lib/auth";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

function getAuth() {
  const { env } = getRequestContext();
  return createAuth(env.DB);
}

export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
