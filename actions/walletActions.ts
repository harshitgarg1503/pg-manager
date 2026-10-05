"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export interface WalletTransactionRow {
  id: string;
  amount: number;
  type: string;
  description: string;
  balanceAfter: number;
  dateLabel: string;
}

export interface WalletData {
  organizationName: string;
  walletBalance: number;
  transactions: WalletTransactionRow[];
}

function toRow(t: {
  id: string;
  amount: number;
  type: string;
  description: string;
  balanceAfter: number;
  createdAt: Date;
}): WalletTransactionRow {
  return {
    id: t.id,
    amount: t.amount,
    type: t.type,
    description: t.description,
    balanceAfter: t.balanceAfter,
    dateLabel: t.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
}

/** Current balance + recent ledger for the signed-in owner's org. */
export async function getWalletBalance(): Promise<WalletData | null> {
  const org = await getCurrentUserOrg();
  if (!org) return null;
  const transactions = await prisma.walletTransaction.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return {
    organizationName: org.name,
    walletBalance: org.walletBalance,
    transactions: transactions.map(toRow),
  };
}

/**
 * Top up the org wallet. Records a RECHARGE transaction and bumps the
 * balance atomically.
 * (No payment gateway wired yet — this logs the top-up for testing.)
 */
export async function rechargeWallet(
  amount: number | string
): Promise<{ success: true } | { success: false; error: string }> {
  const org = await getCurrentUserOrg();
  if (!org) {
    return { success: false, error: "Not authenticated. Please sign in." };
  }

  const parsed = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { success: false, error: "Enter an amount greater than zero." };
  }
  if (parsed > 1000000) {
    return { success: false, error: "Amount looks too large — try smaller." };
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const value = round2(parsed);

  await prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({
      where: { id: org.id },
      select: { walletBalance: true },
    });
    if (!current) throw new Error("Organization not found.");
    const balanceAfter = round2(current.walletBalance + value);
    await tx.organization.update({
      where: { id: org.id },
      data: { walletBalance: balanceAfter },
    });
    await tx.walletTransaction.create({
      data: {
        organizationId: org.id,
        amount: value,
        type: "RECHARGE",
        description: `Wallet recharged (+₹${value})`,
        balanceAfter,
      },
    });
  });

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}
