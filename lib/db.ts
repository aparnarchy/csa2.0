import { getRequestContext } from "@cloudflare/next-on-pages";

export function getDB() {
  const { env } = getRequestContext();
  return env.DB;
}
