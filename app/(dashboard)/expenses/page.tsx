import { redirect } from "next/navigation";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getViewMode } from "@/lib/viewMode.server";
import {
  getExpensesForPast3Months,
  getPendingExpenses,
} from "@/actions/expenseActions";
import ExpensesView, {
  type ExpenseRow,
  type MonthTab,
  type PendingRow,
} from "./ExpensesView";

function formatShort(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ExpensesPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const staffMode = (await getViewMode()) === "staff";

  const [approved, pending] = await Promise.all([
    getExpensesForPast3Months(),
    getPendingExpenses(),
  ]);

  const now = new Date();
  const months: MonthTab[] = [0, 1, 2].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
      shortLabel:
        back === 0 ? "Current Month" : back === 1 ? "Month -1" : "Month -2",
    };
  });

  const expenses: ExpenseRow[] = approved.map((e) => ({
    id: e.id,
    title: e.title,
    amount: e.amount,
    category: e.category,
    dateLabel: formatShort(e.expenseDate),
    monthKey: `${e.expenseDate.getFullYear()}-${String(e.expenseDate.getMonth() + 1).padStart(2, "0")}`,
    addedBy:
      e.addedByName && e.addedByRole !== "OWNER"
        ? `${e.addedByName} - ${capitalize(e.addedByRole)}`
        : capitalize(e.addedByRole),
  }));

  const pendingRows: PendingRow[] = pending.map((e) => ({
    id: e.id,
    title: e.title,
    amount: e.amount,
    addedBy: e.addedByName
      ? `${e.addedByName} - ${capitalize(e.addedByRole)}`
      : capitalize(e.addedByRole),
    dateLabel: formatShort(e.expenseDate),
  }));

  return (
    <div className="space-y-6">
      <ExpensesView
        months={months}
        expenses={expenses}
        pending={staffMode ? [] : pendingRows}
        organizationName={org.name}
        staffMode={staffMode}
      />
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
