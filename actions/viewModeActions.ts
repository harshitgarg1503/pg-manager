"use server";

import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/viewMode";

/** Persist the Owner/Warden view toggle. The client refreshes after. */
export async function setViewMode(mode: ViewMode): Promise<void> {
  if (mode !== "owner" && mode !== "staff") {
    throw new Error("Invalid view mode.");
  }
  (await cookies()).set(VIEW_MODE_COOKIE, mode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}
