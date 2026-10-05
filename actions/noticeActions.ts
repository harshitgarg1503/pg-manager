"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export type NoticeActionResult =
  | { success: true }
  | { success: false; error: string };

function revalidateNoticePages() {
  revalidatePath("/");
  revalidatePath("/tenants");
  revalidatePath("/rooms");
}

/**
 * Save the organization's notice-period rule (days a tenant must serve
 * before vacating). Used to compute expected vacate dates.
 */
export async function updateNoticePeriodDays(
  days: number | string
): Promise<NoticeActionResult> {
  const org = await getCurrentUserOrg();
  if (!org) {
    return { success: false, error: "Not authenticated. Please sign in." };
  }

  const parsed = typeof days === "string" ? parseInt(days, 10) : days;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
    return {
      success: false,
      error: "Notice period must be between 0 and 365 days.",
    };
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { noticePeriodDays: parsed },
  });

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Serve notice to an occupying tenant. Expected vacate date = today +
 * the organization's noticePeriodDays rule.
 */
export async function serveNotice(
  tenantId: string
): Promise<NoticeActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId: org.id },
      select: { id: true, bedId: true, noticeStatus: true },
    });
    if (!tenant) {
      return {
        success: false,
        error: "Tenant was not found for your organization.",
      };
    }
    if (!tenant.bedId) {
      return {
        success: false,
        error: "This tenant is not occupying a bed.",
      };
    }
    if (tenant.noticeStatus === "SERVED") {
      return { success: false, error: "Notice is already served." };
    }
    if (tenant.noticeStatus === "VACATED") {
      return { success: false, error: "This tenant has already vacated." };
    }

    const servedAt = new Date();
    const expected = new Date(servedAt);
    expected.setDate(expected.getDate() + org.noticePeriodDays);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        noticeStatus: "SERVED",
        noticeServedAt: servedAt,
        expectedVacateDate: expected,
      },
    });

    revalidateNoticePages();
    return { success: true };
  } catch (error) {
    console.error("serveNotice failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to serve notice.",
    };
  }
}

/**
 * Mark a tenant as vacated: keeps their record (invoice history intact)
 * but disconnects the bed and flips it back to VACANT so it can be
 * re-booked immediately.
 */
export async function markAsVacated(
  tenantId: string
): Promise<NoticeActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId: org.id },
      select: { id: true, bedId: true, noticeStatus: true },
    });
    if (!tenant) {
      return {
        success: false,
        error: "Tenant was not found for your organization.",
      };
    }
    if (tenant.noticeStatus === "VACATED") {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          noticeStatus: "VACATED",
          bed: { disconnect: true },
        },
      });
      if (tenant.bedId) {
        await tx.bed.update({
          where: { id: tenant.bedId },
          data: { status: "VACANT" },
        });
      }
    });

    revalidateNoticePages();
    return { success: true };
  } catch (error) {
    console.error("markAsVacated failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to mark as vacated.",
    };
  }
}
