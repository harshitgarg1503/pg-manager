"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { VIEW_MODE_COOKIE } from "@/lib/viewMode";
import type { Organization } from "@prisma/client";

export type AuthActionResult =
  | { success: true }
  | { success: false; error: string };

function slugify(name: string): string {
  // Brand-style slug from the first word: "Sunrise Coliving" -> "sunrise".
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  const base = firstWord
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  if (base) return base;
  const fallback = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return fallback || "my-pg";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let suffix = 0;
  // Loop until we find a free slug (handles "Sunrise PG" taken twice).
  for (;;) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

function getStr(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Sign up a new PG owner (2-step onboarding):
 * 1. Creates the Supabase Auth user.
 * 2. Creates Organization (ownerId = auth user id, walletBalance 0, brand
 *    slug, city) + default "Main Branch" Property (full address).
 * 3. Redirects to /wallet/recharge so the owner funds the account first.
 */
export async function signUpOwner(
  formData: FormData
): Promise<AuthActionResult> {
  const ownerName = getStr(formData, "ownerName");
  const pgName = getStr(formData, "pgName");
  const phone = getStr(formData, "phone");
  const email = getStr(formData, "email");
  const password = getStr(formData, "password");
  const city = getStr(formData, "city");
  const address = getStr(formData, "address");

  if (!ownerName) return { success: false, error: "Your name is required." };
  if (!pgName) return { success: false, error: "PG / Brand name is required." };
  if (!phone) return { success: false, error: "Phone number is required." };
  if (!email) return { success: false, error: "Email is required." };
  if (!password || password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };
  if (!city) return { success: false, error: "City is required." };
  if (!address) return { success: false, error: "Property address is required." };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { ownerName, phone, pgName, city },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return {
      success: false,
      error: "Signup succeeded but no user was returned. Please sign in.",
    };
  }

  // Idempotent: if this owner already onboarded (e.g. double submit), skip.
  const existing = await prisma.organization.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });

  if (!existing) {
    const slug = await uniqueSlug(slugify(pgName));

    await prisma.organization.create({
      data: {
        name: pgName,
        slug,
        ownerId: userId,
        ownerName,
        phone,
        city,
        walletBalance: 0,
        properties: {
          create: {
            name: "Main Branch",
            address,
          },
        },
      },
    });
  }

  // When Supabase requires email confirmation there is no session yet, so
  // redirecting onward would bounce straight back to /login. Tell the
  // owner to confirm first — the org above is already created idempotently.
  if (!data.session) {
    return {
      success: false,
      error: "Account created! Check your email to confirm, then sign in.",
    };
  }

  redirect("/wallet/recharge");
}

/**
 * Universal sign-in: accepts an owner email OR a staff login ID
 * (9876543210@slug.com) with the password.
 * - Owner  -> view mode "owner", redirect to / (full admin dashboard).
 * - Staff  -> view mode "staff",  redirect to / (restricted staff view).
 */
export async function loginUser(
  formData: FormData
): Promise<AuthActionResult> {
  const identifier = getStr(formData, "email");
  const password = getStr(formData, "password");

  if (!identifier)
    return { success: false, error: "Email or Staff Login ID is required." };
  if (!password) return { success: false, error: "Password is required." };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { success: false, error: "Sign-in failed. Please try again." };
  }

  if (user.user_metadata?.role === "STAFF") {
    const orgId =
      typeof user.user_metadata?.orgId === "string"
        ? user.user_metadata.orgId
        : null;
    const staff =
      orgId && user.email
        ? await prisma.staff.findFirst({
            where: {
              organizationId: orgId,
              loginEmail: user.email,
              active: true,
            },
            select: { id: true },
          })
        : null;
    if (!orgId || !staff) {
      // Deactivated or orphaned staff account: don't leave a session behind.
      await supabase.auth.signOut();
      return {
        success: false,
        error: "This staff account is inactive. Contact your PG owner.",
      };
    }
    (await cookies()).set(VIEW_MODE_COOKIE, "staff", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    (await cookies()).set(VIEW_MODE_COOKIE, "owner", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  redirect("/");
}

/**
 * Returns the active Organization for the signed-in Supabase user,
 * or null when signed out / not onboarded.
 * - Owner: org where ownerId matches the auth user id.
 * - Staff: org from the user's metadata, only while a matching ACTIVE
 *   staff row exists (deactivation takes effect on the next request).
 */
export async function getCurrentUserOrg(): Promise<Organization | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  if (user.user_metadata?.role === "STAFF") {
    const orgId =
      typeof user.user_metadata?.orgId === "string"
        ? user.user_metadata.orgId
        : null;
    if (!orgId || !user.email) return null;
    const staff = await prisma.staff.findFirst({
      where: {
        organizationId: orgId,
        loginEmail: user.email,
        active: true,
      },
      select: { id: true },
    });
    if (!staff) return null;
    return prisma.organization.findUnique({ where: { id: orgId } });
  }

  const org = await prisma.organization.findUnique({
    where: { ownerId: user.id },
  });

  return org;
}

/** "STAFF" for staff sessions, "OWNER" for owner sessions, else null. */
export async function getSessionRole(): Promise<"OWNER" | "STAFF" | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.role === "STAFF" ? "STAFF" : "OWNER";
}

/** Returns the signed-in Supabase user id, or null when signed out. */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Completes onboarding for an already-authenticated user that has no
 * Organization yet (e.g. signed up before the org row was created, or was
 * created via email confirmation / OAuth). Creates the org + default
 * "Main Branch" property, then redirects to /rooms.
 */
export async function completeOnboarding(
  formData: FormData
): Promise<AuthActionResult> {
  const ownerName = getStr(formData, "ownerName");
  const pgName = getStr(formData, "pgName");
  const phone = getStr(formData, "phone");

  if (!ownerName) return { success: false, error: "Your name is required." };
  if (!pgName)
    return { success: false, error: "PG / Property name is required." };
  if (!phone) return { success: false, error: "Phone number is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated. Please sign in." };
  }

  const existing = await prisma.organization.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!existing) {
    const slug = await uniqueSlug(slugify(pgName));
    await prisma.organization.create({
      data: {
        name: pgName,
        slug,
        ownerId: user.id,
        ownerName,
        phone,
        properties: {
          create: { name: "Main Branch", address: "" },
        },
      },
    });
  }

  redirect("/rooms");
}

export async function signOutOwner(): Promise<void> {
  await logoutUser();
}

/**
 * Sign out the current user: clears the Supabase session cookies via the
 * server client and lands on /login.
 */
export async function logoutUser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
