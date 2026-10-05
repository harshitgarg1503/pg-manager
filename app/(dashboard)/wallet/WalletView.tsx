"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, Wallet } from "lucide-react";
import { rechargeWallet } from "@/actions/walletActions";
import { BED_COST_RUPEES } from "@/lib/billing";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export interface WalletLedgerRow {
  id: string;
  amount: number;
  type: string;
  description: string;
  balanceAfter: number;
  dateLabel: string;
}

interface WalletViewProps {
  organizationName: string;
  walletBalance: number;
  transactions: WalletLedgerRow[];
  /** Onboarding variant: funding-first copy + continue CTA. */
  onboarding?: boolean;
}

const QUICK_AMOUNTS = [500, 1000, 2000];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

/* -------------------------------- Component ------------------------------- */

export default function WalletView({
  organizationName,
  walletBalance,
  transactions,
  onboarding = false,
}: WalletViewProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRecharge() {
    setError(null);
    startTransition(async () => {
      const result = await rechargeWallet(amount);
      if (!result.success) {
        setError(result.error);
      } else {
        setAmount("");
        router.refresh();
      }
    });
  }

  return (
    <div
      className={cn(
        "space-y-6",
        onboarding && "mx-auto w-full max-w-2xl",
      )}
    >
      {!onboarding && (
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Wallet
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {organizationName} — top up credit to create beds.
          </p>
        </div>
      )}

      {/* Balance card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
          <Wallet size={22} />
        </span>
        {!onboarding ? (
          <p className="mt-4 text-sm font-medium text-slate-500">
            Current Balance
          </p>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
              Fund your {organizationName} wallet
            </h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Bed additions deduct from this balance. Top up now so you can
              start adding rooms right away.
            </p>
          </>
        )}
        <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
          {formatINR(walletBalance)}
        </p>

        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <BadgeIndianRupee size={14} aria-hidden />
          Billed at ₹{BED_COST_RUPEES} / bed / month upon bed creation
        </p>

        {/* Quick recharge */}
        <form
          action={handleRecharge}
          className="mx-auto mt-6 max-w-md space-y-3"
        >
          <div
            role="group"
            aria-label="Quick recharge amounts"
            className="grid grid-cols-3 gap-2"
          >
            {QUICK_AMOUNTS.map((q) => {
              const selected = amount === String(q);
              return (
                <button
                  key={q}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAmount(String(q))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
                    selected
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  +{formatINR(q)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min={1}
              step="0.01"
              required
              placeholder="Custom amount in ₹"
              aria-label="Recharge amount in rupees"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Processing…" : "Recharge Now (UPI / QR)"}
            </button>
          </div>
        </form>

        {error && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {onboarding && (
          <Link
            href="/rooms"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continue to Rooms
            <ArrowRight size={16} />
          </Link>
        )}
      </div>

      {/* Ledger */}
      <section
        aria-label="Wallet ledger"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
          Wallet Ledger
        </h2>
        {transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No transactions yet — your recharges and bed deductions will appear
            here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {transactions.map((t) => {
              const isRecharge = t.amount >= 0;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {t.description}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">
                      {t.dateLabel} · Balance {formatINR(t.balanceAfter)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      isRecharge ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {isRecharge ? "+" : "−"}
                    {formatINR(Math.abs(t.amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
