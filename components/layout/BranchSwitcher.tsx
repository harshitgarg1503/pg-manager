"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus, X } from "lucide-react";
import {
  createBranch,
  getBranches,
  switchBranch,
  type BranchInfo,
} from "@/actions/branchActions";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

export default function BranchSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    try {
      const data = await getBranches();
      setBranches(data.branches);
      setActiveId(data.activeBranchId);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getBranches().then(
      (data) => {
        if (cancelled) return;
        setBranches(data.branches);
        setActiveId(data.activeBranchId);
        setLoaded(true);
      },
      () => {
        if (!cancelled) setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const active = branches.find((b) => b.id === activeId) ?? branches[0] ?? null;

  async function handleSwitch(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await switchBranch(id);
      if (!result.success) {
        setError(result.error);
      } else {
        setActiveId(id);
        setOpen(false);
        onNavigate?.();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createBranch({
        name: String(formData.get("name") ?? ""),
        address: String(formData.get("address") ?? ""),
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setModalOpen(false);
        await refresh();
        onNavigate?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="relative p-4 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch branch"
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Building2 size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {loaded ? (active?.name ?? "No branch") : "Loading…"}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {loaded
              ? `${branches.length} branch${branches.length === 1 ? "" : "es"}`
              : "Fetching branches"}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {error && !modalOpen && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Select a branch"
            className="absolute inset-x-4 top-full z-20 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            {branches.map((branch) => {
              const selected = branch.id === activeId;
              return (
                <li key={branch.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    onClick={() => void handleSwitch(branch.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-wait"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">
                        {branch.name}
                      </span>
                    </span>
                    {selected && (
                      <Check size={16} className="shrink-0 text-slate-900" aria-label="Active branch" />
                    )}
                  </button>
                </li>
              );
            })}
            <li aria-hidden className="mx-2 my-1 border-t border-slate-100" />
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setModalOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                <Plus size={16} className="shrink-0" />
                Add New Branch
              </button>
            </li>
          </ul>
        </>
      )}

      {/* Add branch modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add a new branch"
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
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  Add new branch
                </h3>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Rooms created afterwards go to the active branch.
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
                  htmlFor="branch-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Branch Name
                </label>
                <input
                  id="branch-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Koramangala Branch"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="branch-address"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Complete Address{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="branch-address"
                  name="address"
                  rows={3}
                  placeholder="Plot / street / area / city / pincode"
                  className={`${inputClass} resize-none`}
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
                  {isPending ? "Adding…" : "Add Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
