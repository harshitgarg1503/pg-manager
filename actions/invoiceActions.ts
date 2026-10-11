"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export interface GenerateInvoiceData {
  tenantId: string;
  roomRent: number | string;
  electricityUnits: number | string;
  totalAmount: number | string;
  prevMeterReading?: number | string | null;
  currMeterReading?: number | string | null;
  electricityAmount?: number | string | null;
}

function toOptNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type InvoiceActionResult =
  | { success: true; invoiceId: string }
  | { success: false; error: string };

function toNum(v: number | string): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

/**
 * All invoices for the signed-in owner's organization, newest period first,
 * with tenant and room details for display.
 */
export async function getInvoices() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.invoice.findMany({
    where: { organizationId: org.id },
    include: {
      tenant: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          beds: {
            select: {
              bedNumber: true,
              room: { select: { roomNumber: true } },
            },
            orderBy: { bedNumber: "asc" },
          },
        },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Generate a PENDING bill for a tenant for the current month.
 * One invoice per tenant per month (unique) — duplicates are rejected with a
 * friendly message instead of a Prisma error.
 */
export async function generateInvoice(
  data: GenerateInvoiceData
): Promise<InvoiceActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in to generate bills.",
      };
    }

    const tenantId = data.tenantId?.trim();
    const roomRent = toNum(data.roomRent);
    const electricityUnits = toNum(data.electricityUnits);
    const totalAmount = toNum(data.totalAmount);

    if (!tenantId) return { success: false, error: "Tenant is required." };
    if (!Number.isFinite(roomRent) || roomRent < 0)
      return { success: false, error: "Room rent must be a valid amount." };
    if (!Number.isFinite(electricityUnits) || electricityUnits < 0)
      return { success: false, error: "Electricity units must be valid." };
    if (!Number.isFinite(totalAmount) || totalAmount <= 0)
      return { success: false, error: "Total amount must be greater than zero." };

    // Tenant isolation: the tenant must belong to this owner's org.
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId: org.id },
      select: { id: true },
    });
    if (!tenant) {
      return {
        success: false,
        error: "Selected tenant was not found for your organization.",
      };
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const existing = await prisma.invoice.findUnique({
      where: { tenantId_month_year: { tenantId, month, year } },
      select: { id: true },
    });
    if (existing) {
      const label = now.toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
      });
      return {
        success: false,
        error: `Bill already exists for this tenant for ${label}.`,
      };
    }

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenantId,
        month,
        year,
        roomRent,
        prevMeterReading: toOptNum(data.prevMeterReading),
        currMeterReading: toOptNum(data.currMeterReading),
        electricityUnits,
        electricityAmount: toOptNum(data.electricityAmount),
        totalAmount,
        status: "PENDING",
      },
    });

    revalidatePath("/invoices");

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("generateInvoice failed:", error);
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        (error as { code?: string }).code === "P2002")
    ) {
      return {
        success: false,
        error: "Bill already exists for this tenant for this month.",
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate bill.",
    };
  }
}

/** Mark an invoice as PAID. */
export async function markInvoicePaid(
  invoiceId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: org.id },
      select: { id: true, status: true },
    });
    if (!invoice) {
      return {
        success: false,
        error: "Invoice was not found for your organization.",
      };
    }
    if (invoice.status !== "PAID") {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "PAID" },
      });
    }

    revalidatePath("/invoices");

    return { success: true };
  } catch (error) {
    console.error("markInvoicePaid failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update bill.",
    };
  }
}
