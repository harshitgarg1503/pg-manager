"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export type TicketStatusInput = "OPEN" | "IN_PROGRESS" | "RESOLVED";

const VALID_STATUSES: TicketStatusInput[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
];

export interface CreateTicketData {
  roomId: string;
  category: string;
  description: string;
}

export type TicketActionResult =
  | { success: true; ticketId: string }
  | { success: false; error: string };

/**
 * All maintenance tickets for the signed-in owner's organization,
 * newest first, with room details and the room's current occupants
 * (tickets record no reporter, so occupants are shown as "raised by").
 */
export async function getMaintenanceTickets() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.maintenanceTicket.findMany({
    where: { organizationId: org.id },
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          beds: {
            select: {
              tenant: {
                select: { fullName: true, phone: true },
              },
            },
            orderBy: { bedNumber: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Log a new complaint for a room in the owner's organization.
 * Always starts as OPEN — status moves forward via updateTicketStatus.
 */
export async function createMaintenanceTicket(
  data: CreateTicketData
): Promise<TicketActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in to raise complaints.",
      };
    }

    const roomId = data.roomId?.trim();
    const category = data.category?.trim();
    const description = data.description?.trim();

    if (!roomId) return { success: false, error: "Room is required." };
    if (!category) return { success: false, error: "Category is required." };
    if (!description)
      return { success: false, error: "Please describe the issue." };

    // Tenant isolation: the room must belong to this owner's org.
    const room = await prisma.room.findFirst({
      where: { id: roomId, organizationId: org.id },
      select: { id: true },
    });
    if (!room) {
      return {
        success: false,
        error: "Selected room was not found for your organization.",
      };
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId: org.id,
        roomId,
        category,
        description,
        status: "OPEN",
      },
    });

    revalidatePath("/maintenance");

    return { success: true, ticketId: ticket.id };
  } catch (error) {
    console.error("createMaintenanceTicket failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to raise complaint.",
    };
  }
}

/**
 * Move a ticket between OPEN → IN_PROGRESS → RESOLVED.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatusInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in.",
      };
    }

    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: "Invalid status." };
    }

    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId: org.id },
      select: { id: true },
    });
    if (!ticket) {
      return {
        success: false,
        error: "Ticket was not found for your organization.",
      };
    }

    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    revalidatePath("/maintenance");

    return { success: true };
  } catch (error) {
    console.error("updateTicketStatus failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update ticket.",
    };
  }
}
