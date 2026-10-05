"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { markInvoicePaid } from "@/actions/invoiceActions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type InvoiceDisplayStatus = "Paid" | "Pending" | "Overdue";

export interface InvoiceRow {
  id: string;
  tenantName: string;
  phone: string;
  roomNumber: string;
  bedLabel: string;
  period: string;
  roomRent: number;
  electricityUnits: number;
  totalAmount: number;
  displayStatus: InvoiceDisplayStatus;
}

const STATUS_BADGE: Record<InvoiceDisplayStatus, string> = {
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Overdue: "border-red-200 bg-red-50 text-red-700",
};

/* -------------------------------- Component ------------------------------- */

export default function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkPaid(id: string) {
    setError(null);
    setPayingId(id);
    try {
      const result = await markInvoicePaid(id);
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setPayingId(null);
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <ReceiptText size={24} />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">
          No bills generated yet
        </h3>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
          Use the electricity calculator below to split a room&apos;s bill and
          generate per-tenant invoices. They will appear here for tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-3 font-medium">
                  Tenant
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Room &amp; Bed
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Period
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Rent
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Electricity
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <span className="block font-medium text-slate-900">
                      {inv.tenantName}
                    </span>
                    <span className="block text-xs tabular-nums text-slate-500">
                      {inv.phone}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700">
                      Room {inv.roomNumber} • {inv.bedLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {inv.period}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                    {formatINR(inv.roomRent)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                    {formatINR(inv.totalAmount - inv.roomRent)}
                    <span className="block text-[11px] text-slate-400">
                      {inv.electricityUnits} units
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(inv.totalAmount)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                        STATUS_BADGE[inv.displayStatus],
                      )}
                    >
                      {inv.displayStatus === "Paid" ? (
                        <CheckCircle2 size={13} aria-hidden />
                      ) : inv.displayStatus === "Overdue" ? (
                        <TriangleAlert size={13} aria-hidden />
                      ) : (
                        <Clock size={13} aria-hidden />
                      )}
                      {inv.displayStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {inv.displayStatus !== "Paid" ? (
                      <button
                        type="button"
                        disabled={payingId === inv.id}
                        onClick={() => void handleMarkPaid(inv.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        <BadgeCheck size={14} aria-hidden />
                        {payingId === inv.id ? "Saving…" : "Mark Paid"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
