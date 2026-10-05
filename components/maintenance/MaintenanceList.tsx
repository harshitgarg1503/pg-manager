"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  UserPlus,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type TicketStatus = "Open" | "In Progress" | "Resolved";
export type TicketCategory = "Plumbing" | "Electrical" | "Wi-Fi";
export type TicketFilter = "All" | TicketStatus;

export interface MaintenanceTicket {
  id: string;
  title: string;
  description?: string;
  category: TicketCategory;
  reportedBy: string;
  roomNumber: string;
  /** Pre-formatted relative time, e.g. "2 hours ago". */
  reportedAgo: string;
  status: TicketStatus;
  assignedTo: string | null;
}

interface MaintenanceListProps {
  tickets?: MaintenanceTicket[];
  onStatusChange?: (ticketId: string, status: TicketStatus) => void;
  onAssign?: (ticketId: string, staffName: string) => void;
}

/* -------------------------------- Mock data ------------------------------- */

export const MOCK_STAFF = [
  "Ramesh Kumar",
  "Suresh Yadav",
  "Amit Singh",
  "Vikram Rao",
] as const;

export const MOCK_TICKETS: MaintenanceTicket[] = [
  {
    id: "t-001",
    title: "Geyser not working in Room 102",
    description: "No hot water since morning, heating light is off.",
    category: "Electrical",
    reportedBy: "Priya Sharma",
    roomNumber: "102",
    reportedAgo: "2 hours ago",
    status: "Open",
    assignedTo: null,
  },
  {
    id: "t-002",
    title: "Bathroom tap leaking continuously",
    description: "Tap in common washroom dripping heavily, wasting water.",
    category: "Plumbing",
    reportedBy: "Rahul Verma",
    roomNumber: "101",
    reportedAgo: "5 hours ago",
    status: "In Progress",
    assignedTo: "Ramesh Kumar",
  },
  {
    id: "t-003",
    title: "Wi-Fi very slow on 3rd floor",
    description: "Speed drops to unusable after 8 PM in rooms 301–304.",
    category: "Wi-Fi",
    reportedBy: "Sneha Iyer",
    roomNumber: "301",
    reportedAgo: "1 day ago",
    status: "Open",
    assignedTo: null,
  },
  {
    id: "t-004",
    title: "Tube light flickering in Room 204",
    description: "Flickers and goes off intermittently at night.",
    category: "Electrical",
    reportedBy: "Karan Mehta",
    roomNumber: "204",
    reportedAgo: "2 days ago",
    status: "In Progress",
    assignedTo: "Suresh Yadav",
  },
  {
    id: "t-005",
    title: "Wi-Fi not connecting in Room 103",
    description: "Devices fail to obtain IP on the PG_NET SSID.",
    category: "Wi-Fi",
    reportedBy: "Amit Patel",
    roomNumber: "103",
    reportedAgo: "3 days ago",
    status: "Resolved",
    assignedTo: "Amit Singh",
  },
  {
    id: "t-006",
    title: "Flush tank not filling in Room 205",
    description: "Cistern takes 20+ minutes to refill after each use.",
    category: "Plumbing",
    reportedBy: "Divya Nair",
    roomNumber: "205",
    reportedAgo: "4 days ago",
    status: "Resolved",
    assignedTo: "Ramesh Kumar",
  },
];

const FILTERS: TicketFilter[] = ["All", "Open", "In Progress", "Resolved"];
const STATUSES: TicketStatus[] = ["Open", "In Progress", "Resolved"];

/* ------------------------------ Style mappings ---------------------------- */

const CATEGORY_STYLES: Record<
  TicketCategory,
  { badge: string; icon: typeof Zap }
> = {
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

const STATUS_DOT: Record<TicketStatus, string> = {
  Open: "bg-red-500",
  "In Progress": "bg-amber-500",
  Resolved: "bg-emerald-500",
};

const STATUS_SELECT: Record<TicketStatus, string> = {
  Open: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  "In Progress": "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  Resolved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
};

/* -------------------------------- Component ------------------------------- */

export default function MaintenanceList({
  tickets: initialTickets = MOCK_TICKETS,
  onStatusChange,
  onAssign,
}: MaintenanceListProps) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(initialTickets);
  const [activeFilter, setActiveFilter] = useState<TicketFilter>("All");
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<TicketFilter, number> = {
      All: tickets.length,
      Open: 0,
      "In Progress": 0,
      Resolved: 0,
    };
    for (const t of tickets) map[t.status] += 1;
    return map;
  }, [tickets]);

  const filtered = useMemo(() => {
    if (activeFilter === "All") return tickets;
    return tickets.filter((t) => t.status === activeFilter);
  }, [tickets, activeFilter]);

  const updateStatus = (ticketId: string, status: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
    );
    onStatusChange?.(ticketId, status);
  };

  const assignStaff = (ticketId: string, staffName: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, assignedTo: staffName } : t))
    );
    setAssignOpenId(null);
    onAssign?.(ticketId, staffName);
  };

  return (
    <div className="space-y-5">
      {/* Filter buttons */}
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
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {filter}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {counts[filter]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <EmptyState
          filter={activeFilter}
          onClear={() => setActiveFilter("All")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {filtered.map((ticket) => {
            const category = CATEGORY_STYLES[ticket.category];
            const CategoryIcon = category.icon;
            const assignOpen = assignOpenId === ticket.id;
            return (
              <li
                key={ticket.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow"
              >
                {/* Title row + category */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">
                    {ticket.title}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                      category.badge
                    )}
                  >
                    <CategoryIcon size={12} aria-hidden />
                    {ticket.category}
                  </span>
                </div>

                {ticket.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
                    {ticket.description}
                  </p>
                )}

                {/* Reported by + timestamp */}
                <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-slate-500">
                  <span className="font-medium text-slate-700">
                    {ticket.reportedBy}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Room {ticket.roomNumber}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden />
                    {ticket.reportedAgo}
                  </span>
                </p>

                {/* Assignee hint */}
                {ticket.assignedTo && (
                  <p className="mt-1 text-xs text-slate-500">
                    Assigned to{" "}
                    <span className="font-medium text-slate-700">
                      {ticket.assignedTo}
                    </span>
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {/* Status dropdown */}
                  <label className="relative inline-flex items-center">
                    <span className="sr-only">
                      Update status for {ticket.title}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute left-2.5 h-2 w-2 rounded-full",
                        STATUS_DOT[ticket.status]
                      )}
                    />
                    <select
                      value={ticket.status}
                      onChange={(e) =>
                        updateStatus(ticket.id, e.target.value as TicketStatus)
                      }
                      className={cn(
                        "cursor-pointer appearance-none rounded-lg border py-1.5 pl-7 pr-8 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                        STATUS_SELECT[ticket.status]
                      )}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      aria-hidden
                      className="pointer-events-none absolute right-2.5 opacity-60"
                    />
                  </label>

                  {/* Assign staff */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setAssignOpenId(assignOpen ? null : ticket.id)
                      }
                      aria-haspopup="listbox"
                      aria-expanded={assignOpen}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        ticket.assignedTo
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      )}
                    >
                      <UserPlus size={14} aria-hidden />
                      {ticket.assignedTo ? "Reassign" : "Assign Staff"}
                    </button>

                    {assignOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setAssignOpenId(null)}
                        />
                        <ul
                          role="listbox"
                          aria-label="Assign staff member"
                          className="absolute bottom-full z-20 mb-2 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                        >
                          {MOCK_STAFF.map((staff) => (
                            <li key={staff}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={ticket.assignedTo === staff}
                                onClick={() => assignStaff(ticket.id, staff)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-slate-50",
                                  ticket.assignedTo === staff
                                    ? "font-semibold text-slate-900"
                                    : "text-slate-600"
                                )}
                              >
                                {staff}
                                {ticket.assignedTo === staff && (
                                  <CheckCircle2
                                    size={14}
                                    className="text-emerald-600"
                                    aria-hidden
                                  />
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- Empty state ------------------------------ */

function EmptyState({
  filter,
  onClear,
}: {
  filter: TicketFilter;
  onClear: () => void;
}) {
  const isFiltered = filter !== "All";
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        {isFiltered ? <Wrench size={24} /> : <CheckCircle2 size={24} />}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {isFiltered
          ? `No ${filter.toLowerCase()} complaints`
          : "All clear — no complaints"}
      </h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
        {isFiltered
          ? `There are no tickets with “${filter}” status right now. New complaints from tenants will appear here.`
          : "There are no pending complaints. When a tenant reports an issue, it will show up here for you to assign and resolve."}
      </p>
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          View all tickets
        </button>
      )}
    </div>
  );
}
