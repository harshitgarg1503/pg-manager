"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  type AnnouncementPriority,
} from "@/actions/announcementActions";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  postedAt: string;
}

/* -------------------------------- Component ------------------------------- */

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

export default function AnnouncementBroadcast({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [priority, setPriority] = useState<AnnouncementPriority>("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recent = announcements.slice(0, 3);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAnnouncement({
        title: String(formData.get("title") ?? ""),
        message: String(formData.get("message") ?? ""),
        priority,
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setModalOpen(false);
        setPriority("NORMAL");
        router.refresh();
      }
    });
  }

  async function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteAnnouncement(id);
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      aria-label="Announcements"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-900 p-2 text-white">
            <Megaphone size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Announcements
            </h2>
            <p className="text-xs text-slate-500">
              Broadcast notices to your tenants.
            </p>
          </div>
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
          Broadcast Announcement
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

      {/* Last 3 announcements */}
      <div className="mt-4">
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No announcements yet — broadcast your first notice to keep tenants
            informed.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {recent.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {a.title}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        a.priority === "URGENT"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {a.priority === "URGENT" && (
                        <TriangleAlert size={11} aria-hidden />
                      )}
                      {a.priority === "URGENT" ? "Urgent" : "Normal"}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-500">
                    {a.message}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-slate-400">
                    {a.postedAt}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingId === a.id}
                  onClick={() => void handleDelete(a.id)}
                  aria-label={`Delete announcement: ${a.title}`}
                  title="Delete"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Broadcast modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Broadcast an announcement"
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
                  Broadcast announcement
                </h3>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Visible to everyone in your organization.
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

            <form action={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="announcement-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>
                <input
                  id="announcement-title"
                  name="title"
                  type="text"
                  required
                  placeholder="Water Supply Interruption Tomorrow"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="announcement-message"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Message
                </label>
                <textarea
                  id="announcement-message"
                  name="message"
                  required
                  rows={4}
                  placeholder="Water supply will be unavailable from 10 AM to 2 PM due to tank cleaning. Please store water in advance."
                  className={inputClass}
                />
              </div>

              <div>
                <span
                  id="announcement-priority-label"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Priority
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="announcement-priority-label"
                  className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1"
                >
                  {(
                    [
                      { value: "NORMAL", label: "Normal" },
                      { value: "URGENT", label: "Urgent / Important" },
                    ] as const
                  ).map((opt) => {
                    const selected = priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPriority(opt.value)}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          selected
                            ? opt.value === "URGENT"
                              ? "bg-red-600 text-white shadow-sm"
                              : "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white hover:text-slate-900",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
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
                  {isPending ? "Broadcasting…" : "Broadcast"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
