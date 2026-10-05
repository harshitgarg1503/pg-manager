import { PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export interface FinancialSummaryData {
  totalCollection: number;
  totalExpenses: number;
  netProfit: number;
  pendingDues: number;
}

/* -------------------------------- Component ------------------------------- */

export default function FinancialSummary({
  totalCollection,
  totalExpenses,
  netProfit,
  pendingDues,
}: FinancialSummaryData) {
  const margin =
    totalCollection > 0
      ? Math.round((netProfit / totalCollection) * 100)
      : null;

  return (
    <section
      aria-label="Monthly financial summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {/* Collections */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-800">
            Total Collections
          </p>
          <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
            <TrendingUp size={18} />
          </span>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {formatINR(totalCollection)}
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-700">
          This Month&apos;s Inflows
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
          {formatINR(pendingDues)} still pending
        </p>
      </div>

      {/* Expenses */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-rose-800">Total Expenses</p>
          <span className="rounded-lg bg-rose-100 p-2 text-rose-700">
            <TrendingDown size={18} />
          </span>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {formatINR(totalExpenses)}
        </p>
        <p className="mt-1 text-xs font-medium text-rose-700">
          This Month&apos;s Outflows
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Approved spending only
        </p>
      </div>

      {/* Net profit */}
      <div
        className={cn(
          "rounded-xl border p-5 shadow-sm",
          netProfit < 0
            ? "border-red-300 bg-red-50/60"
            : "border-indigo-200 bg-indigo-50/60",
        )}
      >
        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-sm font-medium",
              netProfit < 0 ? "text-red-800" : "text-indigo-800",
            )}
          >
            Net Monthly Profit
          </p>
          <span
            className={cn(
              "rounded-lg p-2",
              netProfit < 0
                ? "bg-red-100 text-red-700"
                : "bg-indigo-100 text-indigo-700",
            )}
          >
            <PiggyBank size={18} />
          </span>
        </div>
        <p
          className={cn(
            "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
            netProfit < 0 ? "text-red-700" : "text-slate-900",
          )}
        >
          {formatINR(netProfit)}
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            netProfit < 0 ? "text-red-700" : "text-indigo-700",
          )}
        >
          Net Margin
          {margin !== null && (
            <span className="tabular-nums"> · {margin}%</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Cashflow this month</p>
      </div>
    </section>
  );
}
