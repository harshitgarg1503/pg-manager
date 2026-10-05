"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type AvailabilityFilter = "all" | "soon" | "now";

export interface UpcomingVacancy {
  bedId: string;
  roomNumber: string;
  bedLabel: string;
  sharingLabel: string;
  rent: number;
  tenantFirstName: string;
  expectedDate: string;
  daysRemaining: number | null;
}

export interface ImmediateVacancy {
  bedId: string;
  roomNumber: string;
  bedLabel: string;
  sharingLabel: string;
  rent: number;
}

interface UpcomingAvailabilityProps {
  upcomingVacancies: UpcomingVacancy[];
  immediateVacancies: ImmediateVacancy[];
}

const FILTERS: { id: AvailabilityFilter; label: string }[] = [
  { id: "all", label: "All Available" },
  { id: "soon", label: "Available Soon (Notice Served)" },
  { id: "now", label: "Vacant Right Now" },
];

/* -------------------------------- Component ------------------------------- */

export default function UpcomingAvailability({
  upcomingVacancies,
  immediateVacancies,
}: UpcomingAvailabilityProps) {
  const [activeFilter, setActiveFilter] =
    useState<AvailabilityFilter>("all");

  const counts = useMemo(
    () => ({
      all: upcomingVacancies.length + immediateVacancies.length,
      soon: upcomingVacancies.length,
      now: immediateVacancies.length,
    }),
    [upcomingVacancies.length, immediateVacancies.length],
  );

  const showSoon = activeFilter === "all" || activeFilter === "soon";
  const showNow = activeFilter === "all" || activeFilter === "now";

  const isEmpty =
    (showSoon && showNow && counts.all === 0) ||
    (activeFilter === "soon" && counts.soon === 0) ||
    (activeFilter === "now" && counts.now === 0);

  return (
    <section
      aria-label="Room availability and inquiry desk"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
            <BedDouble size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Room Availability &amp; Inquiry Desk
            </h2>
            <p className="text-xs text-slate-500">
              Check immediate vacancies and upcoming beds freeing up soon.
            </p>
          </div>
        </div>
      </div>

      {/* Filter toggle */}
      <div
        role="tablist"
        aria-label="Filter availability"
        className="mt-4 flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {isEmpty ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            All beds are currently occupied with no upcoming move-outs.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Room &amp; Bed
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Sharing
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Monthly Rent
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Available
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {showNow &&
                    immediateVacancies.map((b) => (
                      <tr
                        key={b.bedId}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3.5 font-medium tabular-nums text-slate-900">
                          Room {b.roomNumber} - {b.bedLabel}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {b.sharingLabel}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                          {formatINR(b.rent)}
                          <span className="text-xs font-normal text-slate-400">
                            /mo
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={13} aria-hidden />
                            Available Immediately
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-slate-500">
                          Ready to book
                        </td>
                      </tr>
                    ))}
                  {showSoon &&
                    upcomingVacancies.map((b) => (
                      <tr
                        key={b.bedId}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3.5 font-medium tabular-nums text-slate-900">
                          Room {b.roomNumber} - {b.bedLabel}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {b.sharingLabel}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                          {formatINR(b.rent)}
                          <span className="text-xs font-normal text-slate-400">
                            /mo
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium tabular-nums text-amber-800">
                            <CalendarClock size={13} aria-hidden />
                            {availabilityLabel(b)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-slate-500">
                          Tenant {b.tenantFirstName} leaving
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function availabilityLabel(b: UpcomingVacancy): string {
  if (b.daysRemaining === null) return `Available from ${b.expectedDate}`;
  if (b.daysRemaining < 0)
    return `Available from ${b.expectedDate} · overdue`;
  if (b.daysRemaining === 0) return `Available from ${b.expectedDate} · today`;
  return `Available from ${b.expectedDate} · in ${b.daysRemaining} day${b.daysRemaining === 1 ? "" : "s"}`;
}
