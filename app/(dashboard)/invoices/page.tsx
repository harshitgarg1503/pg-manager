import { redirect } from "next/navigation";
import { BadgeCheck, Clock, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getInvoices } from "@/actions/invoiceActions";
import ElectricityCalculator, {
  type BillingRoom,
} from "@/components/billing/ElectricityCalculator";
import InvoiceList, { type InvoiceRow } from "./InvoiceList";
import { formatINR } from "@/lib/format";

export default async function InvoicesPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const [dbInvoices, dbRooms] = await Promise.all([
    getInvoices(),
    prisma.room.findMany({
      where: { organizationId: org.id },
      include: {
        beds: {
          include: { tenant: true },
          orderBy: { bedNumber: "asc" },
        },
      },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    }),
  ]);

  const isPastPeriod = (month: number, year: number) =>
    year < currentYear || (year === currentYear && month < currentMonth);

  const invoices: InvoiceRow[] = dbInvoices.map((inv) => {
    const paid = inv.status === "PAID";
    const [primaryBed, ...extraBeds] = inv.tenant.beds;
    return {
      id: inv.id,
      tenantName: inv.tenant.fullName,
      phone: inv.tenant.phone,
      roomNumber: primaryBed ? primaryBed.room.roomNumber : "—",
      bedLabel: !primaryBed
        ? "Vacated"
        : extraBeds.length === 0
          ? `Bed ${primaryBed.bedNumber}`
          : `Bed ${[primaryBed, ...extraBeds].map((b) => b.bedNumber).join(", Bed ")} (${inv.tenant.beds.length} Beds)`,
      period: new Date(inv.year, inv.month - 1, 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      roomRent: Number(inv.roomRent),
      electricityUnits: Number(inv.electricityUnits),
      totalAmount: Number(inv.totalAmount),
      displayStatus: paid
        ? "Paid"
        : isPastPeriod(inv.month, inv.year)
          ? "Overdue"
          : "Pending",
    };
  });

  const collected = invoices
    .filter((i) => i.displayStatus === "Paid")
    .reduce((s, i) => s + i.totalAmount, 0);
  const pending = invoices
    .filter((i) => i.displayStatus !== "Paid")
    .reduce((s, i) => s + i.totalAmount, 0);
  const paidCount = invoices.filter((i) => i.displayStatus === "Paid").length;
  const unpaidCount = invoices.length - paidCount;

  const summary = [
    {
      label: "Total Collected",
      sub: `${paidCount} invoices paid · ${monthLabel}`,
      value: formatINR(collected),
      icon: BadgeCheck,
      iconClass: "bg-emerald-100 text-emerald-700",
      valueClass: "text-slate-900",
    },
    {
      label: "Total Pending",
      sub: `${unpaidCount} invoices awaiting payment`,
      value: formatINR(pending),
      icon: Clock,
      iconClass: "bg-amber-100 text-amber-700",
      valueClass: "text-slate-900",
    },
    {
      label: "Unpaid Bills",
      sub: `${formatINR(pending)} needs follow-up`,
      value: String(unpaidCount),
      icon: TriangleAlert,
      iconClass: "bg-red-100 text-red-700",
      valueClass: unpaidCount > 0 ? "text-red-700" : "text-slate-900",
    },
  ];

  const billingRooms: BillingRoom[] = dbRooms
    .map((room) => ({
      id: room.id,
      number: room.roomNumber,
      floor: room.floor,
      type: room.airConditioned ? "AC" : "Non-AC",
      tenants: room.beds.flatMap((bed) =>
        bed.tenant
          ? [
              {
                id: bed.tenant.id,
                name: bed.tenant.fullName,
                bedNo: `Bed ${bed.bedNumber}`,
                baseRent: Number(room.baseRent),
                phone: bed.tenant.phone,
              },
            ]
          : [],
      ),
    }))
    .filter((room) => room.tenants.length > 0);

  const billedTenantIds = dbInvoices
    .filter((inv) => inv.month === currentMonth && inv.year === currentYear)
    .map((inv) => inv.tenantId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Billing &amp; Invoicing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {org.name} — track collections and generate room-wise electricity +
            rent bills.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
          {monthLabel}
        </span>
      </div>

      {/* Collection summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <span className={`rounded-lg p-2 ${item.iconClass}`}>
                  <Icon size={18} />
                </span>
              </div>
              <p
                className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${item.valueClass}`}
              >
                {item.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Invoice records */}
      <section aria-label="Invoice records" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Bills {invoices.length > 0 && `(${invoices.length})`}
        </h2>
        <InvoiceList invoices={invoices} />
      </section>

      {/* Calculator */}
      {billingRooms.length > 0 ? (
        <ElectricityCalculator
          rooms={billingRooms}
          monthLabel={monthLabel}
          billedTenantIds={billedTenantIds}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No occupied rooms yet — onboard tenants from the Rooms page, then
          split and generate bills here.
        </div>
      )}
    </div>
  );
}
