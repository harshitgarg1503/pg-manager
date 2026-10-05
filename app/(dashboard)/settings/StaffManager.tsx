"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Phone, Plus, Trash2, UserPlus, X } from "lucide-react";
import {
  createStaffMember,
  deleteStaffMember,
  getStaffMembers,
  toggleStaffStatus,
  type StaffPermissions,
} from "@/actions/staffActions";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

interface StaffRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  active: boolean;
  canManageMaintenance: boolean;
  canAddExpenses: boolean;
  canViewBeds: boolean;
  canViewTenantsEmergency: boolean;
}

const ROLES = [
  { value: "WARDEN", label: "Warden" },
  { value: "CARETAKER", label: "Caretaker" },
  { value: "MAINTENANCE", label: "Maintenance Staff" },
] as const;

const ROLE_BADGE: Record<string, string> = {
  WARDEN: "bg-slate-900 text-white",
  CARETAKER: "bg-indigo-100 text-indigo-700",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  MANAGER: "bg-emerald-100 text-emerald-700",
};

function roleLabel(role: string): string {
  const found = ROLES.find((r) => r.value === role);
  if (found) return found.label;
  return role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ");
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function permissionSummary(s: StaffRow): string {
  const parts: string[] = [];
  if (s.canAddExpenses) parts.push("Expenses");
  if (s.canManageMaintenance) parts.push("Repairs");
  if (s.canViewBeds) parts.push("Beds");
  if (s.canViewTenantsEmergency) parts.push("Emergency contacts");
  return parts.length > 0 ? parts.join(" · ") : "No permissions";
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

/* -------------------------------- Component ------------------------------- */

export default function StaffManager() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [permExpenses, setPermExpenses] = useState(true);
  const [permRepairs, setPermRepairs] = useState(true);
  const [permBeds, setPermBeds] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [createdCreds, setCreatedCreds] = useState<{
    name: string;
    loginEmail: string;
    tempPassword: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStaffMembers().then(
      (rows) => {
        if (!cancelled) setStaff(rows);
      },
      () => {
        if (!cancelled) setError("Couldn't load staff. Please retry.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const permissions: StaffPermissions = {
        canAddExpenses: permExpenses,
        canManageMaintenance: permRepairs,
        canViewBeds: permBeds,
        canViewTenantsEmergency: permBeds,
      };
      const result = await createStaffMember({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        role: String(formData.get("role") ?? ""),
        password: String(formData.get("password") ?? ""),
        permissions,
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setCreatedCreds({
          name: String(formData.get("name") ?? "").trim(),
          loginEmail: result.loginEmail,
          tempPassword: result.tempPassword,
        });
        setPermExpenses(true);
        setPermRepairs(true);
        setPermBeds(true);
        setStaff(await getStaffMembers());
        router.refresh();
      }
    });
  }

  async function handleToggle(id: string, active: boolean) {
    setError(null);
    setBusyId(id);
    try {
      const result = await toggleStaffStatus(id, active);
      if (!result.success) {
        setError(result.error);
      } else {
        setStaff(await getStaffMembers());
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(`Remove ${name} from staff? This cannot be undone.`)
    ) {
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      const result = await deleteStaffMember(id);
      if (!result.success) {
        setError(result.error);
      } else {
        setStaff(await getStaffMembers());
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Staff &amp; Roles</h2>
          <p className="mt-1 text-sm text-slate-500">
            People who manage daily operations at your property.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCreatedCreds(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Staff Member
        </button>
      </div>

      {error && !modalOpen && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        {staff === null ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {[0, 1].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-4 px-4 py-3.5">
                <span className="h-10 w-10 rounded-full bg-slate-100" />
                <span className="flex-1">
                  <span className="block h-4 w-32 rounded bg-slate-100" />
                  <span className="mt-1.5 block h-3 w-24 rounded bg-slate-100" />
                </span>
              </li>
            ))}
          </ul>
        ) : staff.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No staff members yet — add your warden or caretaker to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {staff.map((member) => (
              <li
                key={member.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50",
                  !member.active && "opacity-60",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {initials(member.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {member.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        ROLE_BADGE[member.role] ??
                          "bg-slate-100 text-slate-600",
                      )}
                    >
                      {roleLabel(member.role)}
                    </span>
                    {!member.active && (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                        Inactive
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone size={12} />
                    {member.phone}
                    {member.email && ` · ${member.email}`}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {permissionSummary(member)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={member.active}
                    aria-label={`${member.active ? "Deactivate" : "Activate"} ${member.name}`}
                    title={member.active ? "Deactivate" : "Activate"}
                    disabled={busyId === member.id}
                    onClick={() => void handleToggle(member.id, !member.active)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors disabled:cursor-wait disabled:opacity-60",
                      member.active ? "bg-emerald-500" : "bg-slate-300",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                        member.active ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${member.name}`}
                    title="Remove"
                    disabled={busyId === member.id}
                    onClick={() => void handleDelete(member.id, member.name)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add staff modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add a staff member"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            aria-hidden
            onClick={() => {
              setModalOpen(false);
              setCreatedCreds(null);
            }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            {createdCreds ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      <CheckCircle2 size={18} />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">
                        Staff created!
                      </h3>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        Provide these login credentials to your staff.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setCreatedCreds(null);
                    }}
                    aria-label="Close"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X size={18} />
                  </button>
                </div>
                <dl className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Staff name
                    </dt>
                    <dd className="text-sm font-semibold text-slate-900">
                      {createdCreds.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Login ID
                    </dt>
                    <dd className="select-all break-all font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {createdCreds.loginEmail}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Password
                    </dt>
                    <dd className="select-all break-all font-mono text-sm font-semibold text-slate-900">
                      {createdCreds.tempPassword}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Share these once — the password is not stored and
                  can&apos;t be shown again. They sign in on the same login
                  page with this Login ID.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setCreatedCreds(null);
                  }}
                  className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
              <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-900 p-2 text-white">
                  <UserPlus size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">
                    Add staff member
                  </h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    They operate under your organization.
                  </p>
                </div>
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
                  htmlFor="staff-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="staff-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Ramesh Kumar"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="staff-phone"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Phone Number
                  </label>
                  <input
                    id="staff-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="98200 12345"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-password"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Set Password
                  </label>
                  <input
                    id="staff-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Shown once — share it with the staff member at login time.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="staff-role"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Role
                </label>
                <select id="staff-role" name="role" required className={inputClass}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-slate-700">
                  Permissions
                </legend>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={permExpenses}
                      onChange={(e) => setPermExpenses(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    Can add expenses for approval
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={permRepairs}
                      onChange={(e) => setPermRepairs(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    Can manage repair tickets
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={permBeds}
                      onChange={(e) => setPermBeds(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    Can view beds &amp; emergency contacts
                  </label>
                </div>
              </fieldset>

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
                  {isPending ? "Adding…" : "Add Staff"}
                </button>
              </div>
            </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
