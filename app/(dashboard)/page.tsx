import { redirect } from "next/navigation";
import { BedDouble, ReceiptText, Users, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getViewMode } from "@/lib/viewMode.server";
import { getAnnouncements } from "@/actions/announcementActions";
import AnnouncementBroadcast from "@/components/dashboard/AnnouncementBroadcast";
import NoticeAlerts, { type NoticeAlert } from "./NoticeAlerts";
import FinancialSummary from "@/components/dashboard/FinancialSummary";
import KitchenHeadcount from "@/components/dashboard/KitchenHeadcount";
import UpcomingAvailability, {
  type ImmediateVacancy,
  type UpcomingVacancy,
} from "@/components/dashboard/UpcomingAvailability";

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

export default async function DashboardPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const viewMode = await getViewMode();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [
    totalBeds,
    occupiedBeds,
    tenantCount,
    openTickets,
    paidThisMonth,
    approvedExpenses,
    pendingInvoices,
    dbAnnouncements,
    servedTenants,
    vacantBeds,
    roomCapacities,
  ] = await Promise.all([
      prisma.bed.count({ where: { organizationId: org.id } }),
      prisma.bed.count({
        where: { organizationId: org.id, status: "OCCUPIED" },
      }),
      prisma.tenant.count({ where: { organizationId: org.id } }),
      prisma.maintenanceTicket.count({
        where: {
          organizationId: org.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: org.id,
          status: "PAID",
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId: org.id,
          status: "APPROVED",
          expenseDate: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        _sum: { totalAmount: true },
      }),
      getAnnouncements(),
      prisma.tenant.findMany({
        where: { organizationId: org.id, noticeStatus: "SERVED" },
        include: {
          bed: { include: { room: true } },
        },
        orderBy: { expectedVacateDate: "asc" },
      }),
      prisma.bed.findMany({
        where: { organizationId: org.id, status: "VACANT" },
        include: { room: true },
        orderBy: [{ room: { roomNumber: "asc" } }, { bedNumber: "asc" }],
      }),
      prisma.room.findMany({
        where: { organizationId: org.id },
        select: { id: true, _count: { select: { beds: true } } },
      }),
    ]);

  const collected = Number(paidThisMonth._sum.totalAmount ?? 0);
  const occupancyPct =
    totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100);

  const totalCollection = collected;
  const totalExpenses = approvedExpenses._sum.amount ?? 0;
  const netProfit = totalCollection - totalExpenses;
  const pendingDues = Number(pendingInvoices._sum.totalAmount ?? 0);

  const dayMs = 24 * 60 * 60 * 1000;
  const capacityByRoom = new Map(
    roomCapacities.map((r) => [r.id, r._count.beds]),
  );

  const upcomingVacancies: UpcomingVacancy[] = servedTenants.flatMap((t) => {
    if (!t.bed) return [];
    return [
      {
        bedId: t.bed.id,
        roomNumber: t.bed.room.roomNumber,
        bedLabel: `Bed ${t.bed.bedNumber}`,
        sharingLabel: sharingLabel(
          capacityByRoom.get(t.bed.room.id) ?? 1,
          t.bed.room.airConditioned,
        ),
        rent: Number(t.bed.room.baseRent),
        tenantFirstName:
          t.fullName.split(" ")[0] || t.fullName,
        expectedDate: t.expectedVacateDate
          ? formatShort(t.expectedVacateDate)
          : "—",
        daysRemaining: t.expectedVacateDate
          ? Math.ceil(
              (t.expectedVacateDate.getTime() - now.getTime()) / dayMs,
            )
          : null,
      },
    ];
  });

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
  const noticeAlerts: NoticeAlert[] = servedTenants.map((t) => ({
    id: t.id,
    name: t.fullName,
    roomNumber: t.bed ? t.bed.room.roomNumber : "—",
    bedLabel: t.bed ? `Bed ${t.bed.bedNumber}` : "No bed",
    noticeServedAt: t.noticeServedAt ? formatShort(t.noticeServedAt) : "—",
    expectedVacateDate: t.expectedVacateDate
      ? formatShort(t.expectedVacateDate)
      : "—",
    daysRemaining: t.expectedVacateDate
      ? Math.ceil((t.expectedVacateDate.getTime() - now.getTime()) / dayMs)
      : null,
  }));

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of {org.name}
        </p>
      </div>

      {viewMode === "owner" && (
        <FinancialSummary
          totalCollection={totalCollection}
          totalExpenses={totalExpenses}
          netProfit={netProfit}
          pendingDues={pendingDues}
        />
      )}

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

      <UpcomingAvailability
        upcomingVacancies={upcomingVacancies}
        immediateVacancies={immediateVacancies}
      />

      <NoticeAlerts alerts={noticeAlerts} />

      <KitchenHeadcount />

      <AnnouncementBroadcast
        announcements={dbAnnouncements.slice(0, 3).map((a) => ({
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
    </div>
  );
}
