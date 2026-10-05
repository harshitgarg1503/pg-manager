export const VIEW_MODE_COOKIE = "pg-view-mode";

/** Window event name the switcher fires so the sidebar updates instantly. */
export const VIEW_MODE_EVENT = "pg-view-mode";

export type ViewMode = "owner" | "staff";

/** Client-side cookie reader (server components use viewMode.server). */
export function readViewMode(): ViewMode {
  if (typeof document === "undefined") return "owner";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${VIEW_MODE_COOKIE}=(owner|staff)`),
  );
  return match?.[1] === "staff" ? "staff" : "owner";
}
