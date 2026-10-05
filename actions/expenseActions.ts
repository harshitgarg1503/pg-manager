"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg, getSessionRole } from "@/actions/authActions";

export type ExpenseRole = "OWNER" | "WARDEN";
export type ExpenseDecision = "APPROVED" | "REJECTED";

const VALID_ROLES: ExpenseRole[] = ["OWNER", "WARDEN"];
const VALID_DECISIONS: ExpenseDecision[] = ["APPROVED", "REJECTED"];

const CATEGORIES = [
  "GROCERY",
  "UTILITIES",
  "MAINTENANCE",
  "STAFF_SALARY",
  "MISC",
] as const;

export interface CreateExpenseData {
  title: string;
  amount: number | string;
  category: string;
  expenseDate: Date;
  addedByRole: ExpenseRole;
  addedByName?: string;
}

export type ExpenseActionResult =
  | { success: true; expenseId: string }
  | { success: false; error: string };

/**
 * Log an expense. Owners approve instantly; warden/staff entries go to
 * PENDING_APPROVAL for the owner to review.
 */
export async function createExpense(
  data: CreateExpenseData
): Promise<ExpenseActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in to log expenses.",
      };
    }

    const title = data.title?.trim();
    const amount =
      typeof data.amount === "string" ? parseFloat(data.amount) : data.amount;
    const category = data.category?.trim().toUpperCase();
    const addedByName = data.addedByName?.trim()
      ? data.addedByName.trim()
      : null;

    if (!title) return { success: false, error: "Title is required." };
    if (!Number.isFinite(amount) || amount <= 0)
      return { success: false, error: "Amount must be greater than zero." };
    if (!category || !(CATEGORIES as readonly string[]).includes(category))
      return { success: false, error: "Select a valid category." };
    if (!VALID_ROLES.includes(data.addedByRole))
      return { success: false, error: "Invalid role." };

    // Staff sessions can never self-approve: force WARDEN regardless of the
    // requested role so the entry lands in PENDING_APPROVAL.
    const effectiveRole =
      (await getSessionRole()) === "STAFF" ? "WARDEN" : data.addedByRole;

    // Preserve the picked calendar day regardless of timezone: a date input
    // arrives as UTC midnight, so rebuild it in server-local time.
    const picked = new Date(data.expenseDate);
    if (Number.isNaN(picked.getTime()))
      return { success: false, error: "Invalid date." };
    const expenseDate = new Date(
      picked.getUTCFullYear(),
      picked.getUTCMonth(),
      picked.getUTCDate()
    );

    const expense = await prisma.expense.create({
      data: {
        organizationId: org.id,
        title,
        amount,
        category,
        expenseDate,
        addedByRole: effectiveRole,
        addedByName,
        status:
          effectiveRole === "OWNER" ? "APPROVED" : "PENDING_APPROVAL",
      },
    });

    revalidatePath("/expenses");

    return { success: true, expenseId: expense.id };
  } catch (error) {
    console.error("createExpense failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to log expense.",
    };
  }
}

/**
 * Approved expenses from the last 3 calendar months (current + previous 2),
 * newest first.
 */
export async function getExpensesForPast3Months() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return prisma.expense.findMany({
    where: {
      organizationId: org.id,
      status: "APPROVED",
      expenseDate: { gte: from },
    },
    orderBy: { expenseDate: "desc" },
  });
}

/** Warden/staff entries awaiting the owner's decision, newest first. */
export async function getPendingExpenses() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.expense.findMany({
    where: { organizationId: org.id, status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "desc" },
  });
}

/** Approve or reject a pending expense. */
export async function updateExpenseStatus(
  id: string,
  status: ExpenseDecision
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }
    if (!VALID_DECISIONS.includes(status)) {
      return { success: false, error: "Invalid status." };
    }

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    });
    if (!expense) {
      return {
        success: false,
        error: "Expense was not found for your organization.",
      };
    }

    await prisma.expense.update({ where: { id }, data: { status } });

    revalidatePath("/expenses");

    return { success: true };
  } catch (error) {
    console.error("updateExpenseStatus failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update expense.",
    };
  }
}
