"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCog } from "lucide-react";
import { setViewMode } from "@/actions/viewModeActions";
import { VIEW_MODE_EVENT, readViewMode, type ViewMode } from "@/lib/viewMode";
import { cn } from "@/lib/utils";

/**
 * Owner ↔ Warden view toggle. Persists to a cookie (server components honor
 * it on refresh) and notifies the sidebar instantly via a window event.
 */
export default function ViewModeSwitcher() {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>(() => readViewMode());
  const [saving, setSaving] = useState(false);

  async function switchTo(next: ViewMode) {
    if (next === mode || saving) return;
    setSaving(true);
    try {
      await setViewMode(next);
      setMode(next);
      window.dispatchEvent(new CustomEvent(VIEW_MODE_EVENT, { detail: next }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="View as owner or staff"
      className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
    >
      {(
        [
          { id: "owner", label: "Owner", icon: ShieldCheck },
          { id: "staff", label: "Warden", icon: UserCog },
        ] as const
      ).map((opt) => {
        const Icon = opt.icon;
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            disabled={saving}
            onClick={() => void switchTo(opt.id)}
            title={`View as ${opt.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait",
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Icon size={14} />
            <span className="hidden md:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
