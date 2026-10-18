"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";
import { ACTIVE_BRANCH_COOKIE } from "@/lib/branch";

export interface BranchInfo {
  id: string;
  name: string;
}

function revalidateBranchPages() {
  revalidatePath("/");
  revalidatePath("/rooms");
}

/**
 * The owner's currently active branch (Property). Auto-creates
 * "Main Branch" for orgs that have none, and falls back to the first
 * branch when the cookie is missing or points elsewhere.
 */
export async function getActiveBranch() {
  const org = await getCurrentUserOrg();
  if (!org) return null;

  let branches = await prisma.property.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });
  if (branches.length === 0) {
    const created = await prisma.property.create({
      data: { organizationId: org.id, name: "Main Branch", address: "" },
    });
    branches = [created];
  }

  const activeId = (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value;
  return branches.find((b) => b.id === activeId) ?? branches[0];
}

/**
 * All branches of the active org + the active branch id. Never empty for
 * signed-in owners (auto-creates "Main Branch").
 */
export async function getBranches(): Promise<{
  branches: BranchInfo[];
  activeBranchId: string | null;
}> {
  const org = await getCurrentUserOrg();
  if (!org) return { branches: [], activeBranchId: null };

  const active = await getActiveBranch();
  if (!active) return { branches: [], activeBranchId: null };

  const branches = await prisma.property.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  return { branches, activeBranchId: active.id };
}

/**
 * Add a new branch (Property) and switch to it immediately.
 */
export async function createBranch(data: {
  name: string;
  address?: string;
}): Promise<{ success: true; branchId: string } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const name = data.name?.trim();
    const address = data.address?.trim() ? data.address.trim() : "";
    if (!name) return { success: false, error: "Branch name is required." };

    const duplicate = await prisma.property.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A branch with this name already exists.",
      };
    }

    const branch = await prisma.property.create({
      data: { organizationId: org.id, name, address },
    });

    (await cookies()).set(ACTIVE_BRANCH_COOKIE, branch.id, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidateBranchPages();
    return { success: true, branchId: branch.id };
  } catch (error) {
    console.error("createBranch failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add branch.",
    };
  }
}

/**
 * Switch the active branch context.
 */
export async function switchBranch(
  branchId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const org = await getCurrentUserOrg();
  if (!org) {
    return { success: false, error: "Not authenticated. Please sign in." };
  }

  const branch = await prisma.property.findFirst({
    where: { id: branchId, organizationId: org.id },
    select: { id: true },
  });
  if (!branch) {
    return {
      success: false,
      error: "Branch was not found for your organization.",
    };
  }

  (await cookies()).set(ACTIVE_BRANCH_COOKIE, branch.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidateBranchPages();
  return { success: true };
}
