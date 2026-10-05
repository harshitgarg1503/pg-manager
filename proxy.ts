import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/rooms",
  "/tenants",
  "/invoices",
  "/maintenance",
  "/settings",
  "/onboarding",
  "/expenses",
  "/wallet",
];

/** Owner-financial pages hidden from the staff (warden) view. */
const STAFF_BLOCKED_PREFIXES = ["/invoices", "/settings", "/wallet"];

function isProtected(path: string) {
  if (path === "/") return true;
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — required for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Carry refreshed cookies onto redirect responses so a rotated session
  // is not dropped when we bounce between public/protected routes.
  const redirectWithCookies = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      res.cookies.set(c.name, c.value);
    });
    return res;
  };

  // Signed-out visitors cannot see the dashboard — send them to /login.
  if (!user && isProtected(path)) {
    return redirectWithCookies("/login");
  }

  // Signed-in owners should not see the login page — send them to /rooms.
  if (user && (path === "/login" || path.startsWith("/login/"))) {
    return redirectWithCookies("/rooms");
  }

  // Signed-in owners hitting /signup either need onboarding (no org yet) or
  // already have one — /onboarding sorts both cases (org → /rooms).
  if (user && (path === "/signup" || path.startsWith("/signup/"))) {
    return redirectWithCookies("/onboarding");
  }

  // Staff (warden) view cannot open owner-financial pages.
  const viewMode = request.cookies.get("pg-view-mode")?.value;
  if (
    user &&
    viewMode === "staff" &&
    STAFF_BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))
  ) {
    return redirectWithCookies("/rooms");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images and auth callbacks.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
