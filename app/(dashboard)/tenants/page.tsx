import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getViewMode } from "@/lib/viewMode.server";
import TenantsView, { type TenantRow } from "./TenantsView";

function formatMoveIn(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TenantsPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const mode = await getViewMode();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [dbTenants, monthInvoices] = await Promise.all([
    prisma.tenant.findMany({
      where: { organizationId: org.id },
      include: {
        bed: {
          include: {
            room: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { organizationId: org.id, month, year },
      select: { tenantId: true, status: true, totalAmount: true },
    }),
  ]);

  const invoiceByTenant = new Map(
    monthInvoices.map((inv) => [inv.tenantId, inv]),
  );

  const tenants: TenantRow[] = dbTenants.map((t) => {
    const invoice = invoiceByTenant.get(t.id);
    const roomRent = t.bed ? Number(t.bed.room.baseRent) : 0;
    return {
      id: t.id,
      name: t.fullName,
      email: t.email ?? "",
      phone: t.phone,
      room: t.bed ? t.bed.room.roomNumber : "—",
      bed: t.bed ? `Bed ${t.bed.bedNumber}` : "Vacated",
      moveIn: formatMoveIn(t.checkInDate),
      rentPaid: invoice?.status === "PAID",
      dueAmount: invoice ? Number(invoice.totalAmount) : roomRent,
      kycVerified: t.idProofUrl !== null,
      notice: t.noticeStatus as "NONE" | "SERVED" | "VACATED",
      expectedVacate: t.expectedVacateDate
        ? formatMoveIn(t.expectedVacateDate)
        : null,
      emergencyContact: t.emergencyContact ?? "—",
    };
  });

  return (
    <TenantsView
      tenants={tenants}
      organizationName={org.name}
      restricted={mode === "staff"}
    />
  );
}
