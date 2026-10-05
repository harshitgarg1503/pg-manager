"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Plus,
  ReceiptText,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createExpense,
  updateExpenseStatus,
  type ExpenseRole,
} from "@/actions/expenseActions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export interface MonthTab {
  key: string;
  label: string;
  shortLabel: string;
}

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  category: string;
  dateLabel: string;
  monthKey: string;
  addedBy: string;
}

export interface PendingRow {
  id: string;
  title: string;
  amount: number;
  addedBy: string;
  dateLabel: string;
}

interface ExpensesViewProps {
  months: MonthTab[];
  expenses: ExpenseRow[];
  pending: PendingRow[];
  organizationName: string;
  /** Staff (warden) logger: role locked to WARDEN, no approval queue. */
  staffMode?: boolean;
}

const CATEGORIES = [
  "GROCERY",
  "UTILITIES",
  "MAINTENANCE",
  "STAFF_SALARY",
  "MISC",
] as const;

const CATEGORY_STYLES: Record<string, string> = {
  GROCERY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  UTILITIES: "border-blue-200 bg-blue-50 text-blue-700",
  MAINTENANCE: "border-amber-200 bg-amber-50 text-amber-700",
  STAFF_SALARY: "border-purple-200 bg-purple-50 text-purple-700",
  MISC: "border-slate-200 bg-slate-50 text-slate-600",
};

function categoryLabel(c: string): string {
  return c
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

/* -------------------------------- Component ------------------------------- */

export default function ExpensesView({
  months,
  expenses,
  pending,
  organizationName,
  staffMode = false,
}: ExpensesViewProps) {
  const router = useRouter();
  const [activeMonth, setActiveMonth] = useState(months[0]?.key ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [role, setRole] = useState<ExpenseRole>(staffMode ? "WARDEN" : "OWNER");
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(
    () => expenses.filter((e) => e.monthKey === activeMonth),
    [expenses, activeMonth],
  );
  const monthTotal = useMemo(
    () => visible.reduce((s, e) => s + e.amount, 0),
    [visible],
  );
  const activeLabel =
    months.find((m) => m.key === activeMonth)?.label ?? "";

  async function handleDecision(id: string, approve: boolean) {
    setError(null);
    setDecidingId(id);
    try {
      const result = await updateExpenseStatus(
        id,
        approve ? "APPROVED" : "REJECTED",
      );
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const dateStr = String(formData.get("expenseDate") ?? "");
      const result = await createExpense({
        title: String(formData.get("title") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        category: String(formData.get("category") ?? ""),
        expenseDate: dateStr ? new Date(`${dateStr}T00:00:00`) : new Date(),
        addedByRole: role,
        addedByName: String(formData.get("addedByName") ?? ""),
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setModalOpen(false);
        setRole(staffMode ? "WARDEN" : "OWNER");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {staffMode ? "Log Expense" : "Expense Tracker"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {staffMode
              ? `${organizationName} — log spending for owner approval.`
              : `${organizationName} — log spending and approve staff requests.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {error && !modalOpen && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section
          aria-label="Pending approvals"
          className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
              <Clock size={16} />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              Pending Approvals
              <span className="ml-2 rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">
                {pending.length}
              </span>
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Added by {p.addedBy} · {p.dateLabel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatINR(p.amount)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decidingId === p.id}
                      onClick={() => void handleDecision(p.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Check size={14} aria-hidden />
                      {decidingId === p.id ? "Saving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === p.id}
                      onClick={() => void handleDecision(p.id, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      <X size={14} aria-hidden />
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Month tabs */}
      <div
        role="tablist"
        aria-label="Filter expenses by month"
        className="flex flex-wrap gap-2"
      >
        {months.map((m) => {
          const isActive = activeMonth === m.key;
          const count = expenses.filter((e) => e.monthKey === m.key).length;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveMonth(m.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {m.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expenses table */}
      <section aria-label="Expense records" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {activeLabel} · {visible.length} expense
            {visible.length === 1 ? "" : "s"}
          </h2>
          <p className="text-sm tabular-nums text-slate-500">
            Total{" "}
            <span className="font-semibold text-slate-900">
              {formatINR(monthTotal)}
            </span>
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <ReceiptText size={24} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No expenses this month
            </h3>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
              Nothing logged for {activeLabel} yet. Use “Add Expense” to record
              groceries, utilities, repairs, or salaries.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Title
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Added By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((e) => (
                    <tr
                      key={e.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 tabular-nums text-slate-600">
                        {e.dateLabel}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {e.title}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                            CATEGORY_STYLES[e.category] ??
                              CATEGORY_STYLES.MISC,
                          )}
                        >
                          {categoryLabel(e.category)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatINR(e.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {e.addedBy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Add expense modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add an expense"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            aria-hidden
            onClick={() => setModalOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Add expense
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Log PG spending against your organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <form action={handleCreate} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="expense-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>
                <input
                  id="expense-title"
                  name="title"
                  type="text"
                  required
                  placeholder="20L Water Cans (5 units)"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="expense-amount"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Amount (₹)
                  </label>
                  <input
                    id="expense-amount"
                    name="amount"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    placeholder="500"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="expense-date"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Date
                  </label>
                  <input
                    id="expense-date"
                    name="expenseDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="expense-category"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Category
                </label>
                <select
                  id="expense-category"
                  name="category"
                  required
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              {staffMode ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Submitting as <span className="font-medium">Warden</span> —
                  entries go to the owner for approval.
                </p>
              ) : (
                <div>
                  <span
                    id="expense-role-label"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Added as
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="expense-role-label"
                    className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1"
                  >
                    {(
                      [
                        { value: "OWNER", label: "Owner (Instant)" },
                        { value: "WARDEN", label: "Warden (Approval)" },
                      ] as const
                    ).map((opt) => {
                      const selected = role === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setRole(opt.value)}
                          className={cn(
                            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            selected
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-600 hover:bg-white hover:text-slate-900",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {role === "OWNER"
                      ? "Owner entries are approved instantly."
                      : "Warden entries need owner approval first."}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="expense-added-by"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Added by name{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="expense-added-by"
                  name="addedByName"
                  type="text"
                  placeholder="Ramesh (Caretaker)"
                  className={inputClass}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    "Saving…"
                  ) : (
                    <>
                      {role === "OWNER" ? "Add Expense" : "Request Approval"}
                    </>
                  )}
                </button>
              </div>
            </form>

            {pending.length > 0 && (
              <p className="mt-4 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <TriangleAlert size={14} aria-hidden />
                {pending.length} warden request
                {pending.length === 1 ? "" : "s"} awaiting your approval.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
