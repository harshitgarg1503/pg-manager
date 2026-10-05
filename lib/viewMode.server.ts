import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, type ViewMode } from "./viewMode";

/**
 * Server-side view mode. Staff have no Supabase accounts in this app, so
 * "staff mode" is a UI-level restriction (owner demoing the warden view),
 * persisted in a readable cookie so Server Components can honor it.
 */
export async function getViewMode(): Promise<ViewMode> {
  const value = (await cookies()).get(VIEW_MODE_COOKIE)?.value;
  return value === "staff" ? "staff" : "owner";
}
