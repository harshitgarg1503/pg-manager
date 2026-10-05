import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import RoomsView from "./RoomsView";
import type { Room as MatrixRoom } from "@/components/rooms/RoomOccupancyMatrix";

export default async function RoomsPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const [dbRooms, properties] = await Promise.all([
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
    prisma.property.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rooms: MatrixRoom[] = dbRooms.map((room) => ({
    id: room.id,
    number: room.roomNumber,
    floor: room.floor,
    type: room.airConditioned ? "AC" : "Non-AC",
    beds: (room.beds ?? []).map((bed) => ({
      id: bed.id,
      label: `Bed ${bed.bedNumber}`,
      status:
        String(bed.status).toUpperCase() === "VACANT" ? "vacant" : "occupied",
      tenant: bed.tenant
        ? {
            firstName: bed.tenant.fullName.split(" ")[0] || bed.tenant.fullName,
            phone: bed.tenant.phone,
          }
        : undefined,
    })),
  }));

  return (
    <RoomsView
      rooms={rooms}
      properties={properties}
      organizationName={org.name}
    />
  );
}
