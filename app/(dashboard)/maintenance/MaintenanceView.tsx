"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplets,
  Timer,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import {
  updateTicketStatus,
  type TicketStatusInput,
} from "@/actions/maintenanceActions";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type TicketStatus = "Open" | "In Progress" | "Resolved";
export type TicketFilter = "All" | "Pending / Open" | "In Progress" | "Resolved";

export interface TicketOccupant {
  fullName: string;
  phone: string;
}

export interface TicketRow {
  id: string;
  title: string;
  description: string;
  category: string;
  roomNumber: string;
  occupants: TicketOccupant[];
  reportedAgo: string;
  status: TicketStatus;
}

interface MaintenanceViewProps {
  tickets: TicketRow[];
  resolvedThisMonth: number;
}

const FILTERS: TicketFilter[] = [
  "All",
  "Pending / Open",
  "In Progress",
  "Resolved",
];

const FILTER_STATUS: Record<Exclude<TicketFilter, "All">, TicketStatus> = {
  "Pending / Open": "Open",
  "In Progress": "In Progress",
  Resolved: "Resolved",
};

/* ------------------------------ Style mappings ---------------------------- */

const CATEGORY_STYLES: Record<string, { badge: string; icon: typeof Zap }> = {
  Plumbing: {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Droplets,
  },
  Electrical: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Zap,
  },
  "Wi-Fi": {
    badge: "border-purple-200 bg-purple-50 text-purple-700",
    icon: Wifi,
  },
};

function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      badge: "border-slate-200 bg-slate-50 text-slate-600",
      icon: Wrench,
    }
  );
}

/* -------------------------------- Component ------------------------------- */

export default function MaintenanceView({
  tickets,
  resolvedThisMonth,
}: MaintenanceViewProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<TicketFilter>("All");
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const open = tickets.filter((t) => t.status === "Open").length;
    const inProgress = tickets.filter((t) => t.status === "In Progress").length;
    const resolved = tickets.filter((t) => t.status === "Resolved").length;
    return { open, inProgress, resolved, all: tickets.length };
  }, [tickets]);

  const filterCount = (filter: TicketFilter): number => {
    if (filter === "All") return counts.all;
    return tickets.filter((t) => t.status === FILTER_STATUS[filter]).length;
  };

  const filtered = useMemo(() => {
    if (activeFilter === "All") return tickets;
    return tickets.filter((t) => t.status === FILTER_STATUS[activeFilter]);
  }, [tickets, activeFilter]);

  async function handleStatusChange(
    ticketId: string,
    status: TicketStatusInput,
  ) {
    setActionError(null);
    setUpdatingId(ticketId);
    try {
      const result = await updateTicketStatus(ticketId, status);
      if (!result.success) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const showAllClear =
    filtered.length === 0 &&
    (activeFilter === "All" || activeFilter === "Pending / Open");

  return (
    <div className="space-y-5">
      {/* Metric counters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-red-100 p-2 text-red-700">
            <AlertCircle size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Open Issues</p>
            <p className="text-xl font-semibold tracking-tight text-red-700 tabular-nums">
              {counts.open}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
            <Timer size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">In Progress</p>
            <p className="text-xl font-semibold tracking-tight text-amber-700 tabular-nums">
              {counts.inProgress}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">
              Resolved this month
            </p>
            <p className="text-xl font-semibold tracking-tight text-emerald-700 tabular-nums">
              {resolvedThisMonth}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Filter complaints by status"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {filter}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {filterCount(filter)}
              </span>
            </button>
          );
        })}
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* Ticket cards / empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {showAllClear
              ? "No pending complaints. All systems running smoothly!"
              : `No ${activeFilter.toLowerCase()} tickets`}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
            {showAllClear
              ? "Every reported issue has been resolved. New complaints will appear here for triage."
              : `There are no tickets with “${activeFilter}” status right now.`}
          </p>
          {!showAllClear && (
            <button
              type="button"
              onClick={() => setActiveFilter("All")}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              View all tickets
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {filtered.map((ticket) => {
            const style = categoryStyle(ticket.category);
            const CategoryIcon = style.icon;
            const busy = updatingId === ticket.id;
            const raisedBy =
              ticket.occupants.length > 0
                ? ticket.occupants
                    .map((o) => `${o.fullName} (${o.phone})`)
                    .join(", ")
                : "No current occupant";
            return (
              <li
                key={ticket.id}
                className={cn(
                  "flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow",
                  ticket.status === "Resolved" && "opacity-80",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">
                    {ticket.title}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                      style.badge,
                    )}
                  >
                    <CategoryIcon size={12} aria-hidden />
                    {ticket.category}
                  </span>
                </div>

                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
                  {ticket.description}
                </p>

                <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-slate-500">
                  <span className="font-medium text-slate-700">
                    Room {ticket.roomNumber}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-slate-700">{raisedBy}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden />
                    {ticket.reportedAgo}
                  </span>
                </p>

                {/* Resolution actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {ticket.status === "Open" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleStatusChange(ticket.id, "IN_PROGRESS")
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13px] font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Timer size={14} aria-hidden />
                        {busy ? "Saving…" : "Mark In-Progress"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleStatusChange(ticket.id, "RESOLVED")
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        {busy ? "Saving…" : "Resolve"}
                      </button>
                    </>
                  )}

                  {ticket.status === "In Progress" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleStatusChange(ticket.id, "RESOLVED")
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        {busy ? "Saving…" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleStatusChange(ticket.id, "OPEN")
                        }
                        className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
                      >
                        Back to Open
                      </button>
                    </>
                  )}

                  {ticket.status === "Resolved" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-700">
                        <CheckCircle2 size={14} aria-hidden />
                        Resolved
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleStatusChange(ticket.id, "OPEN")
                        }
                        className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
                      >
                        Reopen
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
