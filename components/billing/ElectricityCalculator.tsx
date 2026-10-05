"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Building2,
  Calculator,
  Check,
  Gauge,
  IndianRupee,
  MessageCircle,
  RotateCcw,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { generateInvoice } from "@/actions/invoiceActions";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";

/* ---------------------------------- Types --------------------------------- */

export interface BillingTenant {
  id: string;
  name: string;
  bedNo: string;
  baseRent: number;
  phone?: string;
}

export interface BillingRoom {
  id: string;
  number: string;
  floor: number;
  type: string;
  tenants: BillingTenant[];
}

interface ElectricityCalculatorProps {
  rooms?: BillingRoom[];
  initialRoomId?: string;
  monthLabel?: string;
  initialRate?: number | string;
  /** Tenant ids that already have a bill for the displayed month. */
  billedTenantIds?: string[];
}

/* --------------------------------- Helpers -------------------------------- */

const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export { formatINR };

function toNumber(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-base font-medium tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 transition-shadow";

const labelClass = "mb-1.5 block text-[13px] font-medium text-slate-700";

/* -------------------------------- Component ------------------------------- */

export default function ElectricityCalculator({
  rooms = [],
  initialRoomId,
  monthLabel = "September 2026",
  initialRate = "10",
  billedTenantIds = [],
}: ElectricityCalculatorProps) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [prevReading, setPrevReading] = useState("0");
  const [currReading, setCurrReading] = useState("0");
  const [rate, setRate] = useState(String(initialRate));
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [newlyBilled, setNewlyBilled] = useState<Set<string>>(new Set());
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const tenants = useMemo(() => room?.tenants ?? [], [room]);

  const calc = useMemo(() => {
    const prev = toNumber(prevReading);
    const curr = toNumber(currReading);
    const perUnit = toNumber(rate);
    const valid = curr >= prev && prev >= 0 && perUnit >= 0;
    const units = valid ? curr - prev : 0;
    const totalCost = units * perUnit;
    const headCount = tenants.length;
    const perHead = headCount > 0 ? totalCost / headCount : 0;
    return { prev, curr, perUnit, valid, units, totalCost, headCount, perHead };
  }, [prevReading, currReading, rate, tenants.length]);

  const rows = useMemo(
    () =>
      tenants.map((t) => ({
        ...t,
        electricityShare: calc.perHead,
        totalDue: t.baseRent + calc.perHead,
      })),
    [tenants, calc.perHead]
  );

  const totalCollectable = useMemo(
    () => rows.reduce((sum, r) => sum + r.totalDue, 0),
    [rows]
  );

  const handleRoomChange = (nextId: string) => {
    setRoomId(nextId);
    // Fresh readings per room — never reuse another room's meter values.
    setPrevReading("0");
    setCurrReading("0");
    setSentIds(new Set());
    setGenError(null);
  };

  const handleReset = () => {
    setPrevReading("0");
    setCurrReading("0");
    setRate(String(initialRate));
    setSentIds(new Set());
    setGenError(null);
  };

  const isBilled = (tenantId: string) =>
    newlyBilled.has(tenantId) || billedTenantIds.includes(tenantId);

  const handleGenerate = (tenant: BillingTenant) => {
    setGenError(null);
    setGeneratingId(tenant.id);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const unitsShare =
      calc.headCount > 0 ? round2(calc.units / calc.headCount) : 0;
    startTransition(async () => {
      const result = await generateInvoice({
        tenantId: tenant.id,
        roomRent: tenant.baseRent,
        prevMeterReading: round2(calc.prev),
        currMeterReading: round2(calc.curr),
        electricityUnits: unitsShare,
        electricityAmount: round2(calc.perHead),
        totalAmount: round2(tenant.baseRent + calc.perHead),
      });
      if (!result.success) {
        setGenError(result.error);
      } else {
        setNewlyBilled((prev) => new Set(prev).add(tenant.id));
        router.refresh();
      }
      setGeneratingId(null);
    });
  };

  const handleWhatsApp = (tenant: BillingTenant) => {
    const share = calc.perHead;
    const total = tenant.baseRent + share;
    const lines = [
      `Hi ${tenant.name}! Here is your Room ${room?.number ?? ""} bill for ${monthLabel}:`,
      ``,
      `Meter: ${num.format(calc.prev)} → ${num.format(calc.curr)} (${num.format(calc.units)} units)`,
      `Rate: ${formatINR(calc.perUnit)}/unit`,
      `Base Rent (${tenant.bedNo}): ${formatINR(tenant.baseRent)}`,
      `Electricity Share (1/${calc.headCount}): ${formatINR(share)}`,
      `Total Due: ${formatINR(total)}`,
      ``,
      `Please pay at your earliest. Thank you!`,
    ];
    const text = encodeURIComponent(lines.join("\n"));
    const digits = (tenant.phone ?? "").replace(/\D/g, "");
    const url = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSentIds((prev) => new Set(prev).add(tenant.id));
  };

  if (rooms.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No occupied rooms yet — onboard tenants from the Rooms page, then
        split and generate bills here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inputs + summary card */}
      <section
        aria-label="Electricity calculator"
        className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
              <Calculator size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Electricity Calculator
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {room ? (
                  <>
                    Room {room.number} · {room.type} · {calc.headCount} active{" "}
                    {calc.headCount === 1 ? "tenant" : "tenants"} · {monthLabel}
                  </>
                ) : (
                  monthLabel
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>

        {/* Input grid */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ec-room" className={labelClass}>
              Room
            </label>
            <div className="relative">
              <Building2
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                id="ec-room"
                value={roomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                className={cn(inputClass, "appearance-none pr-10")}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} · {r.type} · Floor {r.floor} ({r.tenants.length}{" "}
                    {r.tenants.length === 1 ? "tenant" : "tenants"})
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
              >
                ▼
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="ec-prev" className={labelClass}>
              Previous meter reading
            </label>
            <div className="relative">
              <Gauge
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="ec-prev"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="e.g. 1240"
                value={prevReading}
                onChange={(e) => setPrevReading(e.target.value)}
                className={inputClass}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                units
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="ec-curr" className={labelClass}>
              Current meter reading
            </label>
            <div className="relative">
              <Gauge
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="ec-curr"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="e.g. 1360"
                value={currReading}
                onChange={(e) => setCurrReading(e.target.value)}
                aria-invalid={!calc.valid}
                className={cn(
                  inputClass,
                  !calc.valid && "border-red-300 focus:border-red-500 focus:ring-red-500/15"
                )}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                units
              </span>
            </div>
            {!calc.valid && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                <TriangleAlert size={14} className="shrink-0" />
                Current reading can&apos;t be less than previous reading.
              </p>
            )}
          </div>

          <div className="sm:col-span-2 sm:max-w-xs">
            <label htmlFor="ec-rate" className={labelClass}>
              Rate per unit (₹)
            </label>
            <div className="relative">
              <IndianRupee
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="ec-rate"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                placeholder="e.g. 10"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={inputClass}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                ₹/unit
              </span>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div
          aria-live="polite"
          className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100 sm:grid-cols-3"
        >
          <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200/70">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Zap size={14} className="text-amber-500" />
              Units consumed
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {num.format(calc.units)}
              <span className="ml-1 text-sm font-medium text-slate-400">units</span>
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200/70">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <IndianRupee size={14} className="text-slate-400" />
              Total electricity cost
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatINR(calc.totalCost)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200/70">
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Users size={14} />
              Per-tenant split · 1/{calc.headCount || "–"}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-emerald-700">
              {calc.headCount > 0 ? formatINR(calc.perHead) : "–"}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs tabular-nums text-slate-500">
          {num.format(calc.curr)} − {num.format(calc.prev)} ={" "}
          <span className="font-semibold text-slate-900">{num.format(calc.units)} units</span>
          {" × "}
          {formatINR(calc.perUnit)} ÷ {calc.headCount}{" "}
          {calc.headCount === 1 ? "tenant" : "tenants"}
        </p>
      </section>

      {/* Tenant breakdown table */}
      <section
        aria-label="Tenant breakdown"
        className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tenant breakdown{room ? ` · Room ${room.number}` : ""}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {rows.length} {rows.length === 1 ? "tenant" : "tenants"} · Total collectable{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {formatINR(totalCollectable)}
              </span>
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium tabular-nums text-slate-600">
            {num.format(calc.units)} units · {formatINR(calc.perUnit)}/unit
          </span>
        </div>

        {genError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {genError}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No active tenants in this room yet — select another room.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-6 py-3 font-medium">Tenant Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Bed No</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Base Rent</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Electricity Share</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total Due</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>Bill
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => {
                  const sent = sentIds.has(t.id);
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white"
                          >
                            {initials(t.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{t.name}</span>
                            {t.phone && (
                              <span className="block text-xs tabular-nums text-slate-400">{t.phone}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                          <BedDouble size={13} className="text-slate-400" />
                          {t.bedNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                        {formatINR(t.baseRent)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                        {formatINR(t.electricityShare)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-base font-semibold tabular-nums text-slate-900">
                        {formatINR(t.totalDue)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isBilled(t.id) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700">
                              <Check size={15} />
                              Billed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerate(t)}
                              disabled={
                                generatingId === t.id ||
                                isPending ||
                                !calc.valid ||
                                calc.headCount === 0
                              }
                              title={`Generate ${monthLabel} bill for ${t.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {generatingId === t.id ? "Generating…" : "Generate Bill"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(t)}
                            title={sent ? `Resend WhatsApp bill to ${t.name}` : `Generate and send WhatsApp bill to ${t.name}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1",
                              sent
                                ? "border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            )}
                          >
                            {sent ? <Check size={15} /> : <MessageCircle size={15} />}
                            {sent ? "Resend" : "WhatsApp"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/70 text-sm">
                  <td colSpan={2} className="px-6 py-3.5 font-medium text-slate-600">
                    Total ({rows.length} {rows.length === 1 ? "tenant" : "tenants"})
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-600">
                    {formatINR(rows.reduce((s, r) => s + r.baseRent, 0))}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-600">
                    {formatINR(calc.totalCost)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-base font-semibold tabular-nums text-slate-900">
                    {formatINR(totalCollectable)}
                  </td>
                  <td className="px-6 py-3.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
