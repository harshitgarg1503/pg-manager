import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BedDouble, ReceiptText, Users, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getViewMode } from "@/lib/viewMode.server";
import { getAnnouncements } from "@/actions/announcementActions";
import { getUpcomingMealForecast } from "@/actions/mealActions";
import AnnouncementBroadcast from "@/components/dashboard/AnnouncementBroadcast";
import NoticeAlerts, { type NoticeAlert } from "./NoticeAlerts";
import FinancialSummary from "@/components/dashboard/FinancialSummary";
import KitchenHeadcount from "@/components/dashboard/KitchenHeadcount";
import UpcomingAvailability, {
  type ImmediateVacancy,
  type UpcomingVacancy,
} from "@/components/dashboard/UpcomingAvailability";
import {
  AnnouncementsSkeleton,
  AvailabilitySkeleton,
  FinancialSummarySkeleton,
  KitchenHeadcountSkeleton,
  StatCardsSkeleton,
} from "@/components/dashboard/DashboardSkeletons";

/* --------------------------------- Helpers -------------------------------- */

function formatShort(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sharingLabel(capacity: number, airConditioned: boolean): string {
  const sharing =
    capacity === 1
      ? "Single Sharing"
      : capacity === 2
        ? "Double Sharing"
        : capacity === 3
          ? "Triple Sharing"
          : capacity === 4
            ? "Quad Sharing"
            : `${capacity}-Sharing`;
  return `${sharing} • ${airConditioned ? "AC" : "Non-AC"}`;
}

/* ------------------------- Streamed data sections ------------------------- */
/**
 * Each section is an async Server Component wrapped in <Suspense> on the
 * page. Queries inside a section run in parallel, and sections run in
 * parallel with EACH OTHER — the shell renders immediately and every card
 * streams in as its own round-trip resolves.
 */

/** Top KPI cards: occupancy, tenants, rent collected, open tickets. */
async function StatsSection({ orgId, now }: { orgId: string; now: Date }) {
  const [totalBeds, occupiedBeds, tenantCount, openTickets, paidThisMonth] =
    await Promise.all([
      prisma.bed.count({ where: { organizationId: orgId } }),
      prisma.bed.count({
        where: { organizationId: orgId, status: "OCCUPIED" },
      }),
      prisma.tenant.count({ where: { organizationId: orgId } }),
      prisma.maintenanceTicket.count({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          status: "PAID",
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
        _sum: { totalAmount: true },
      }),
    ]);

  const collected = Number(paidThisMonth._sum.totalAmount ?? 0);
  const occupancyPct =
    totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100);

  const stats = [
    {
      label: "Occupancy",
      value: `${occupiedBeds} / ${totalBeds}`,
      sub: `${occupancyPct}% occupied`,
      icon: BedDouble,
    },
    {
      label: "Tenants",
      value: String(tenantCount),
      sub: "active tenants",
      icon: Users,
    },
    {
      label: "Rent collected",
      value: `₹${collected >= 100000 ? `${(collected / 100000).toFixed(1)}L` : collected.toLocaleString("en-IN")}`,
      sub: now.toLocaleString("en-IN", { month: "long" }),
      icon: ReceiptText,
    },
    {
      label: "Open tickets",
      value: String(openTickets),
      sub: "needs attention",
      icon: Wrench,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Owner-only monthly financials: collections, expenses, net profit. */
async function FinancialSummarySection({ orgId }: { orgId: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [paidThisMonth, approvedExpenses, pendingInvoices] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          status: "PAID",
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId: orgId,
          status: "APPROVED",
          expenseDate: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        _sum: { totalAmount: true },
      }),
    ]);

  const totalCollection = Number(paidThisMonth._sum.totalAmount ?? 0);
  const totalExpenses = approvedExpenses._sum.amount ?? 0;
  const pendingDues = Number(pendingInvoices._sum.totalAmount ?? 0);

  return (
    <FinancialSummary
      totalCollection={totalCollection}
      totalExpenses={totalExpenses}
      netProfit={totalCollection - totalExpenses}
      pendingDues={pendingDues}
    />
  );
}

/**
 * Vacancies + notice alerts. Both widgets read the SAME served-tenant and
 * bed-capacity rows, so one section fetches them once and shares the data
 * (previously one shared query set, kept as a single boundary).
 */
async function AvailabilitySection({
  orgId,
  now,
}: {
  orgId: string;
  now: Date;
}) {
  const [servedTenants, vacantBeds, roomCapacities] = await Promise.all([
    prisma.tenant.findMany({
      where: { organizationId: orgId, noticeStatus: "SERVED" },
      include: {
        beds: { include: { room: true }, orderBy: { bedNumber: "asc" } },
      },
      orderBy: { expectedVacateDate: "asc" },
    }),
    prisma.bed.findMany({
      where: { organizationId: orgId, status: "VACANT" },
      include: { room: true },
      orderBy: [{ room: { roomNumber: "asc" } }, { bedNumber: "asc" }],
    }),
    prisma.room.findMany({
      where: { organizationId: orgId },
      select: { id: true, _count: { select: { beds: true } } },
    }),
  ]);

  const dayMs = 24 * 60 * 60 * 1000;
  const capacityByRoom = new Map(
    roomCapacities.map((r) => [r.id, r._count.beds]),
  );

  // One row per freeing bed: a tenant holding several beds frees them all.
  const upcomingVacancies: UpcomingVacancy[] = servedTenants.flatMap((t) =>
    t.beds.map((bed) => ({
      bedId: bed.id,
      roomNumber: bed.room.roomNumber,
      bedLabel: `Bed ${bed.bedNumber}`,
      sharingLabel: sharingLabel(
        capacityByRoom.get(bed.room.id) ?? 1,
        bed.room.airConditioned,
      ),
      rent: Number(bed.room.baseRent),
      tenantFirstName: t.fullName.split(" ")[0] || t.fullName,
      expectedDate: t.expectedVacateDate
        ? formatShort(t.expectedVacateDate)
        : "—",
      daysRemaining: t.expectedVacateDate
        ? Math.ceil(
            (t.expectedVacateDate.getTime() - now.getTime()) / dayMs,
          )
        : null,
    })),
  );

  const immediateVacancies: ImmediateVacancy[] = vacantBeds.map((b) => ({
    bedId: b.id,
    roomNumber: b.room.roomNumber,
    bedLabel: `Bed ${b.bedNumber}`,
    sharingLabel: sharingLabel(
      capacityByRoom.get(b.room.id) ?? 1,
      b.room.airConditioned,
    ),
    rent: Number(b.room.baseRent),
  }));

  const noticeAlerts: NoticeAlert[] = servedTenants.map((t) => {
    const [primaryBed, ...extraBeds] = t.beds;
    return {
      id: t.id,
      name: t.fullName,
      roomNumber: primaryBed ? primaryBed.room.roomNumber : "—",
      bedLabel: !primaryBed
        ? "No bed"
        : extraBeds.length === 0
          ? `Bed ${primaryBed.bedNumber}`
          : `Bed ${primaryBed.bedNumber} +${extraBeds.length} more`,
      noticeServedAt: t.noticeServedAt ? formatShort(t.noticeServedAt) : "—",
      expectedVacateDate: t.expectedVacateDate
        ? formatShort(t.expectedVacateDate)
        : "—",
      daysRemaining: t.expectedVacateDate
        ? Math.ceil((t.expectedVacateDate.getTime() - now.getTime()) / dayMs)
        : null,
    };
  });

  return (
    <>
      <UpcomingAvailability
        upcomingVacancies={upcomingVacancies}
        immediateVacancies={immediateVacancies}
      />
      <NoticeAlerts alerts={noticeAlerts} />
    </>
  );
}

/** Kitchen headcount, prefetched server-side and hydrated into the widget. */
async function KitchenHeadcountSection() {
  const forecast = await getUpcomingMealForecast();
  return <KitchenHeadcount initialForecast={forecast} />;
}

/** Latest announcements. */
async function AnnouncementSection() {
  const announcements = await getAnnouncements();
  return (
    <AnnouncementBroadcast
      announcements={announcements.slice(0, 3).map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        priority: a.priority as "NORMAL" | "URGENT",
        postedAt: a.createdAt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      }))}
    />
  );
}

/* --------------------------------- Page ---------------------------------- */

export default async function DashboardPage() {
  // Auth + view-mode are independent cookie reads — resolve together.
  const [userId, viewMode] = await Promise.all([
    getAuthUserId(),
    getViewMode(),
  ]);
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of {org.name}
        </p>
      </div>

      {viewMode === "owner" && (
        <Suspense fallback={<FinancialSummarySkeleton />}>
          <FinancialSummarySection orgId={org.id} />
        </Suspense>
      )}

      <Suspense fallback={<StatCardsSkeleton />}>
        <StatsSection orgId={org.id} now={now} />
      </Suspense>

      <Suspense fallback={<AvailabilitySkeleton />}>
        <AvailabilitySection orgId={org.id} now={now} />
      </Suspense>

      <Suspense fallback={<KitchenHeadcountSkeleton />}>
        <KitchenHeadcountSection />
      </Suspense>

      <Suspense fallback={<AnnouncementsSkeleton />}>
        <AnnouncementSection />
      </Suspense>
    </div>
  );
}
