"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { getCurrentUserOrg } from "@/actions/authActions";
import { updateNoticePeriodDays } from "@/actions/noticeActions";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900";

export default function NoticePeriodForm() {
  const [days, setDays] = useState("30");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getCurrentUserOrg().then((org) => {
      if (!cancelled && org) {
        setDays(String(org.noticePeriodDays));
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateNoticePeriodDays(days);
      setMessage(
        result.success
          ? { kind: "success", text: "Notice period saved." }
          : { kind: "error", text: result.error },
      );
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold">House Rules</h2>
      <p className="mt-1 text-sm text-slate-500">
        Move-out rules applied when serving notice to tenants.
      </p>

      <div className="mt-6 max-w-md">
        <label
          htmlFor="notice-period-days"
          className="block text-sm font-medium text-slate-700"
        >
          Notice Period Requirement (Days)
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            id="notice-period-days"
            type="number"
            min={0}
            max={365}
            value={days}
            disabled={!loaded}
            onChange={(e) => setDays(e.target.value)}
            placeholder="30"
            className={cn(inputClass, "max-w-[140px] tabular-nums")}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!loaded || isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Tenants must serve this many days of notice before vacating. Used to
          compute the expected vacate date automatically.
        </p>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm",
              message.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {message.kind === "success" && <CheckCircle2 size={14} />}
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
