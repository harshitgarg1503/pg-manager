"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg, getSessionRole } from "@/actions/authActions";
import { createAdminClient } from "@/utils/supabase/admin";

const VALID_ROLES = ["WARDEN", "CARETAKER", "MANAGER", "MAINTENANCE"] as const;

export interface StaffPermissions {
  canManageMaintenance?: boolean;
  canAddExpenses?: boolean;
  canViewBeds?: boolean;
  canViewTenantsEmergency?: boolean;
}

export interface CreateStaffData {
  name: string;
  phone: string;
  email?: string;
  role: string;
  password?: string;
  permissions?: StaffPermissions;
}

export type StaffActionResult =
  | { success: true; staffId: string; loginEmail: string; tempPassword: string }
  | { success: false; error: string };

/** Normalize a mobile number to digits, dropping a leading 91 country code. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

/** All staff members of the signed-in owner's organization. */
export async function getStaffMembers() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.staff.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Add a staff member with all permissions enabled unless explicitly
 * overridden via `permissions`. Auto-generates the staff login
 * (`<mobile>@<org-slug>.com`), creates the Supabase Auth user (confirmed,
 * metadata { role: "STAFF", orgId }), and returns the credentials ONCE for
 * the admin to share. The password is never stored — Supabase holds the
 * hash; the Staff.password column stays null.
 */
export async function createStaffMember(
  data: CreateStaffData
): Promise<StaffActionResult> {
  const org = await getCurrentUserOrg();
  if (!org) {
    return {
      success: false,
      error: "Not authenticated. Please sign in to manage staff.",
    };
  }
  // Only owners can mint staff logins (staff sessions resolve an org too).
  if ((await getSessionRole()) !== "OWNER") {
    return { success: false, error: "Only the owner can add staff." };
  }

  try {
    const name = data.name?.trim();
    const phone = data.phone?.trim();
    const role = data.role?.trim().toUpperCase().replace(/\s+/g, "_");
    const password = data.password ?? "";

    if (!name) return { success: false, error: "Full name is required." };
    if (!phone) return { success: false, error: "Phone number is required." };
    if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
      return { success: false, error: "Select a valid role." };
    }
    if (password.length < 6) {
      return {
        success: false,
        error: "Set a password of at least 6 characters.",
      };
    }

    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      return { success: false, error: "Enter a valid 10-digit mobile number." };
    }
    const loginEmail = `${digits}@${org.slug}.com`;

    const taken = await prisma.staff.findUnique({
      where: { loginEmail },
      select: { id: true },
    });
    if (taken) {
      return {
        success: false,
        error: `Login ${loginEmail} already exists for another staff member.`,
      };
    }

    const p = data.permissions ?? {};
    const staff = await prisma.staff.create({
      data: {
        organizationId: org.id,
        name,
        phone,
        email: null,
        role,
        loginEmail,
        canManageMaintenance: p.canManageMaintenance ?? true,
        canAddExpenses: p.canAddExpenses ?? true,
        canViewBeds: p.canViewBeds ?? true,
        canViewTenantsEmergency: p.canViewTenantsEmergency ?? true,
      },
    });

    // Service-role creation: no session change, admin stays signed in.
    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      await prisma.staff.delete({ where: { id: staff.id } });
      return {
        success: false,
        error: e instanceof Error ? e.message : "Auth admin unavailable.",
      };
    }
    const { error: authError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { role: "STAFF", orgId: org.id, staffName: name },
    });
    if (authError) {
      await prisma.staff.delete({ where: { id: staff.id } });
      return { success: false, error: authError.message };
    }

    revalidatePath("/settings");

    return { success: true, staffId: staff.id, loginEmail, tempPassword: password };
  } catch (error) {
    console.error("createStaffMember failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add staff.",
    };
  }
}

/** Activate or deactivate a staff member. */
export async function toggleStaffStatus(
  staffId: string,
  active: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: org.id },
      select: { id: true },
    });
    if (!staff) {
      return {
        success: false,
        error: "Staff member was not found for your organization.",
      };
    }

    await prisma.staff.update({ where: { id: staffId }, data: { active } });

    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("toggleStaffStatus failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update staff.",
    };
  }
}

/** Remove a staff member permanently. */
export async function deleteStaffMember(
  staffId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: org.id },
      select: { id: true },
    });
    if (!staff) {
      return {
        success: false,
        error: "Staff member was not found for your organization.",
      };
    }

    await prisma.staff.delete({ where: { id: staffId } });

    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("deleteStaffMember failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove staff.",
    };
  }
}
