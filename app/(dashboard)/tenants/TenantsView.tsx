"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UserMinus,
} from "lucide-react";
import { useTenantOnboarding } from "@/components/tenants/TenantOnboardingProvider";
import { serveNotice } from "@/actions/noticeActions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type NoticeFilter = "all" | "active" | "notice" | "vacated";

export interface TenantRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  room: string;
  bed: string;
  moveIn: string;
  rentPaid: boolean;
  dueAmount: number;
  kycVerified: boolean;
  notice: "NONE" | "SERVED" | "VACATED";
  expectedVacate: string | null;
  emergencyContact: string;
}

const FILTERS: { id: NoticeFilter; label: string }[] = [
  { id: "all", label: "All Tenants" },
  { id: "active", label: "Active" },
  { id: "notice", label: "Notice Period" },
  { id: "vacated", label: "Vacated" },
];

interface TenantsViewProps {
  tenants: TenantRow[];
  organizationName: string;
  /** Staff (warden) view: contact details only, no rent/KYC/notice data. */
  restricted?: boolean;
}

const AVATAR_COLORS = [
  "bg-slate-900 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-purple-600 text-white",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function digitsOnly(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("91") && d.length > 10 ? d : `91${d}`;
}

/* --------------------------------- View ----------------------------------- */

export default function TenantsView({
  tenants,
  organizationName,
  restricted = false,
}: TenantsViewProps) {
  const { openOnboarding } = useTenantOnboarding();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<NoticeFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [servingId, setServingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      all: tenants.length,
      active: tenants.filter((t) => t.notice === "NONE").length,
      notice: tenants.filter((t) => t.notice === "SERVED").length,
      vacated: tenants.filter((t) => t.notice === "VACATED").length,
    };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (activeFilter === "active" && t.notice !== "NONE") return false;
      if (activeFilter === "notice" && t.notice !== "SERVED") return false;
      if (activeFilter === "vacated" && t.notice !== "VACATED") return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        t.room.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q)
      );
    });
  }, [tenants, query, activeFilter]);

  async function handleServeNotice(id: string, name: string) {
    if (
      !window.confirm(
        `Serve notice to ${name}? Their expected vacate date will be set per your notice-period rule.`,
      )
    ) {
      return;
    }
    setNoticeError(null);
    setServingId(id);
    setOpenMenuId(null);
    try {
      const result = await serveNotice(id);
      if (!result.success) {
        setNoticeError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setServingId(null);
    }
  }

  if (restricted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {organizationName} — resident contact directory for staff.
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or room…"
            aria-label="Search tenants"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-slate-500">
              No tenants found. Try a different search term.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Resident
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Room &amp; Bed
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Phone
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Emergency Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t, i) => (
                    <tr
                      key={t.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              AVATAR_COLORS[i % AVATAR_COLORS.length],
                            )}
                          >
                            {initials(t.name)}
                          </span>
                          <span className="truncate font-medium text-slate-900">
                            {t.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700">
                          Room {t.room} • {t.bed}
                        </span>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-slate-600">
                        <a
                          href={`tel:${t.phone.replace(/\s/g, "")}`}
                          className="hover:text-slate-900 hover:underline"
                        >
                          {t.phone}
                        </a>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-slate-600">
                        {t.emergencyContact}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Showing {filtered.length} of {tenants.length} residents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {organizationName} — {tenants.length} active resident
            {tenants.length === 1 ? "" : "s"}, KYC documents, and lease details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openOnboarding()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          <Plus size={16} />
          Add Tenant
        </button>
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or room…"
            aria-label="Search tenants"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter tenants by notice status"
          className="flex flex-wrap gap-2"
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
                    : "border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900",
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
      </div>

      {noticeError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {noticeError}
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search size={20} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              {tenants.length === 0 ? "No tenants yet" : "No tenants found"}
            </h3>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              {tenants.length === 0
                ? "Onboard your first resident from a vacant bed on the Rooms page, or use “Add Tenant” above."
                : "Try a different search term. New onboardings from the “Add Tenant” flow will appear here."}
            </p>
            {tenants.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveFilter("all");
                }}
                className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Resident
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Room &amp; Bed
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Move-in Date
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Rent Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    KYC Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t, i) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50">
                    {/* Resident */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            AVATAR_COLORS[i % AVATAR_COLORS.length],
                          )}
                        >
                          {initials(t.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">
                            {t.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {t.email ? `${t.email} · ` : ""}
                            {t.phone}
                          </span>
                          {t.notice === "SERVED" && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              <BellRing size={11} aria-hidden />
                              On notice
                              {t.expectedVacate
                                ? ` · vacates ${t.expectedVacate}`
                                : ""}
                            </span>
                          )}
                          {t.notice === "VACATED" && (
                            <span className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Vacated
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Room */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700">
                        Room {t.room} • {t.bed}
                      </span>
                    </td>

                    {/* Move-in */}
                    <td className="whitespace-nowrap px-5 py-4 tabular-nums text-slate-600">
                      {t.moveIn}
                    </td>

                    {/* Rent */}
                    <td className="px-5 py-4">
                      {t.rentPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={13} aria-hidden />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          <Clock size={13} aria-hidden />
                          Pending {formatINR(t.dueAmount)}
                        </span>
                      )}
                    </td>

                    {/* KYC */}
                    <td className="px-5 py-4">
                      {t.kycVerified ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700">
                          <BadgeCheck size={16} aria-hidden className="text-blue-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-amber-700">
                          <Clock size={15} aria-hidden />
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`https://wa.me/${digitsOnly(t.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Chat with ${t.name} on WhatsApp`}
                          title="WhatsApp"
                          className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
                        >
                          <MessageCircle size={18} />
                        </a>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`More actions for ${t.name}`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === t.id}
                            onClick={() =>
                              setOpenMenuId(openMenuId === t.id ? null : t.id)
                            }
                            className={cn(
                              "rounded-lg p-2 transition-colors",
                              openMenuId === t.id
                                ? "bg-slate-100 text-slate-900"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                            )}
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {openMenuId === t.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div
                                role="menu"
                                aria-label={`Actions for ${t.name}`}
                                className="absolute right-0 z-20 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              >
                                <MenuItem
                                  icon={Eye}
                                  label="View Details"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <MenuItem
                                  icon={Pencil}
                                  label="Edit"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                {t.notice === "NONE" && (
                                  <MenuItem
                                    icon={UserMinus}
                                    label={
                                      servingId === t.id
                                        ? "Serving notice…"
                                        : "Serve Notice"
                                    }
                                    onClick={() =>
                                      void handleServeNotice(t.id, t.name)
                                    }
                                  />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {tenants.length} residents · New tenants
        onboarded via &ldquo;Add Tenant&rdquo; appear in this directory.
      </p>
    </div>
  );
}

/* ------------------------------- Menu item -------------------------------- */

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );
}
