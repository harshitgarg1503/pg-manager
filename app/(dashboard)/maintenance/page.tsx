import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getMaintenanceTickets } from "@/actions/maintenanceActions";
import MaintenanceView, { type TicketRow } from "./MaintenanceView";

function formatReportedAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABEL = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
} as const;

export default async function MaintenancePage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const dbTickets = await getMaintenanceTickets();

  const tickets: TicketRow[] = dbTickets.map((t) => {
    const occupants = (t.room.beds ?? []).flatMap((b) =>
      b.tenant
        ? [{ fullName: b.tenant.fullName, phone: b.tenant.phone }]
        : [],
    );
    return {
      id: t.id,
      title: `${t.category} issue · Room ${t.room.roomNumber}`,
      description: t.description,
      category: t.category,
      roomNumber: t.room.roomNumber,
      occupants,
      reportedAgo: formatReportedAgo(t.createdAt),
      status: STATUS_LABEL[t.status] ?? "Open",
    };
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resolvedThisMonth = await prisma.maintenanceTicket.count({
    where: {
      organizationId: org.id,
      status: "RESOLVED",
      updatedAt: { gte: monthStart },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Maintenance &amp; Complaints</h1>
        <p className="mt-1 text-sm text-slate-500">
          {org.name} — resolve open issues and track them to closure.
        </p>
      </div>

      <MaintenanceView
        tickets={tickets}
        resolvedThisMonth={resolvedThisMonth}
      />
    </div>
  );
}
