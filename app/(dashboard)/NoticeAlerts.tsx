"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarDays, UserCheck } from "lucide-react";
import { markAsVacated } from "@/actions/noticeActions";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export interface NoticeAlert {
  id: string;
  name: string;
  roomNumber: string;
  bedLabel: string;
  noticeServedAt: string;
  expectedVacateDate: string;
  daysRemaining: number | null;
}

function daysBadge(days: number | null): { label: string; className: string } {
  if (days === null)
    return { label: "Date TBD", className: "bg-slate-100 text-slate-600" };
  if (days < 0)
    return {
      label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      className: "bg-red-100 text-red-700",
    };
  if (days === 0) return { label: "Leaves today", className: "bg-red-100 text-red-700" };
  if (days <= 7)
    return {
      label: `${days} day${days === 1 ? "" : "s"} left`,
      className: "bg-amber-100 text-amber-800",
    };
  return {
    label: `${days} days left`,
    className: "bg-slate-100 text-slate-600",
  };
}

/* -------------------------------- Component ------------------------------- */

export default function NoticeAlerts({ alerts }: { alerts: NoticeAlert[] }) {
  const router = useRouter();
  const [vacatingId, setVacatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  async function handleVacated(id: string, name: string) {
    if (
      !window.confirm(
        `Mark ${name} as vacated? Their bed will be freed for re-booking immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    setVacatingId(id);
    try {
      const result = await markAsVacated(id);
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setVacatingId(null);
    }
  }

  return (
    <section
      aria-label="Notice alerts"
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <BellRing size={18} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Notice Alerts — Leaving Soon
          </h2>
          <p className="text-xs text-slate-500">
            {alerts.length} tenant{alerts.length === 1 ? "" : "s"} on notice
            period.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {alerts.map((a) => {
          const badge = daysBadge(a.daysRemaining);
          return (
            <li
              key={a.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {a.name}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                    Room {a.roomNumber} • {a.bedLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays size={13} aria-hidden />
                Notice given {a.noticeServedAt} · Expected vacate{" "}
                {a.expectedVacateDate}
              </p>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  disabled={vacatingId === a.id}
                  onClick={() => void handleVacated(a.id, a.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <UserCheck size={14} aria-hidden />
                  {vacatingId === a.id ? "Saving…" : "Mark as Vacated"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
