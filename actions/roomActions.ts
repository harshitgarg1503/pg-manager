"use server";

import { revalidatePath } from "next/cache";
import type { Room } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";
import { getActiveBranch } from "@/actions/branchActions";
import { BED_COST_RUPEES } from "@/lib/billing";
import type { RoomOption } from "@/components/tenants/TenantOnboardingDrawer";

export interface CreateRoomData {
  /**
   * Optional explicit branch. When omitted, the room is linked to the
   * currently active branch (active_branch_id cookie).
   */
  propertyId?: string;
  roomNumber: string;
  floor?: number;
  baseRent: number | string;
  airConditioned?: boolean;
  /** Number of beds to create in the room (Bed A, B, C…). Max 8. */
  bedCount: number | string;
}

const MAX_BEDS_PER_ROOM = 8;

function bedLetter(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

export type CreateRoomResult =
  | { success: true; room: Room }
  | { success: false; error: string };

/**
 * Create a room scoped to the signed-in owner's organization.
 * organizationId is always derived from `getCurrentUserOrg()` — never trusted
 * from client input and never falls back to a hardcoded org.
 *
 * Pay-per-bed: creating N beds costs N × ₹30, deducted from the org wallet
 * in the SAME transaction as the room + beds (all-or-nothing). Insufficient
 * balance rejects the whole operation with a recharge prompt.
 */
export async function createRoom(
  data: CreateRoomData
): Promise<CreateRoomResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in to manage rooms.",
      };
    }

    const roomNumber = data.roomNumber?.trim();
    const floor = data.floor ?? 0;
    const baseRent =
      typeof data.baseRent === "string"
        ? parseFloat(data.baseRent)
        : data.baseRent;
    const bedCount =
      typeof data.bedCount === "string"
        ? parseInt(data.bedCount, 10)
        : data.bedCount;

    // Branch context: explicit property wins, otherwise the active branch.
    let propertyId = data.propertyId?.trim();
    if (!propertyId) {
      const activeBranch = await getActiveBranch();
      if (!activeBranch) {
        return {
          success: false,
          error: "No branch found. Please add a branch first.",
        };
      }
      propertyId = activeBranch.id;
    }
    if (!roomNumber)
      return { success: false, error: "Room number is required." };
    if (!Number.isFinite(baseRent) || baseRent < 0)
      return { success: false, error: "Base rent must be a valid amount." };
    if (!Number.isInteger(bedCount) || bedCount < 1 || bedCount > MAX_BEDS_PER_ROOM)
      return {
        success: false,
        error: `Number of beds must be between 1 and ${MAX_BEDS_PER_ROOM}.`,
      };

    // Verify the property belongs to this owner's org (tenant isolation).
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: org.id },
      select: { id: true },
    });
    if (!property) {
      return {
        success: false,
        error: "Selected property was not found for your organization.",
      };
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const cost = round2(bedCount * BED_COST_RUPEES);

    const room = await prisma.$transaction(async (tx) => {
      // Re-read the balance inside the transaction so concurrent room
      // creations can't both spend the same rupees.
      const wallet = await tx.organization.findUnique({
        where: { id: org.id },
        select: { walletBalance: true },
      });
      if (!wallet) throw new Error("Organization not found.");
      if (wallet.walletBalance < cost) {
        throw new Error(
          `Insufficient wallet balance. Creating ${bedCount} beds requires ₹${cost}. Your current balance is ₹${wallet.walletBalance}. Please recharge.`
        );
      }
      const balanceAfter = round2(wallet.walletBalance - cost);
      await tx.organization.update({
        where: { id: org.id },
        data: { walletBalance: balanceAfter },
      });
      await tx.walletTransaction.create({
        data: {
          organizationId: org.id,
          amount: -cost,
          type: "BED_DEDUCTION",
          description: `Added ${bedCount} beds in Room ${roomNumber} (-₹${cost})`,
          balanceAfter,
        },
      });

      const created = await tx.room.create({
        data: {
          organizationId: org.id,
          propertyId,
          roomNumber,
          floor,
          baseRent,
          airConditioned: data.airConditioned ?? false,
        },
      });

      // Every room gets its beds up front — all VACANT so they render as
      // clickable "+ Vacant" chips on the room card immediately.
      await tx.bed.createMany({
        data: Array.from({ length: bedCount }, (_, i) => ({
          organizationId: org.id,
          roomId: created.id,
          bedNumber: bedLetter(i),
          status: "VACANT" as const,
        })),
      });

      return created;
    });

    revalidatePath("/rooms");

    return { success: true, room };
  } catch (error) {
    console.error("createRoom failed:", error);
    // Prisma unique violation: same room number in this property.
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        (error as { code?: string }).code === "P2002")
    ) {
      return {
        success: false,
        error: "A room with this number already exists in the property.",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create room.",
    };
  }
}

/**
 * Rooms of the currently active branch, with beds + tenants.
 * Branch context keeps the rooms view aligned with the switcher.
 */
export async function getOrgRooms() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  const activeBranch = await getActiveBranch();
  if (!activeBranch) return [];
  return prisma.room.findMany({
    where: { organizationId: org.id, propertyId: activeBranch.id },
    include: {
      beds: {
        include: { tenant: true },
        orderBy: { bedNumber: "asc" },
      },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
}

/**
 * Room + bed options for the Tenant Onboarding drawer, shaped exactly like
 * its `RoomOption[]` contract (rent serialized to number). Scoped to the
 * active branch so bookings happen in the branch you're viewing. Returns []
 * when signed out so the drawer never falls back to mock rooms for owners.
 */
export async function getRoomOptions(): Promise<RoomOption[]> {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  const activeBranch = await getActiveBranch();
  if (!activeBranch) return [];
  const dbRooms = await prisma.room.findMany({
    where: { organizationId: org.id, propertyId: activeBranch.id },
    include: {
      beds: { orderBy: { bedNumber: "asc" } },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
  return dbRooms.map((room) => ({
    id: room.id,
    number: room.roomNumber,
    floor: room.floor,
    type: room.airConditioned ? "AC" : "Non-AC",
    defaultRent: Number(room.baseRent),
    beds: (room.beds ?? []).map((bed) => ({
      id: bed.id,
      label: `Bed ${bed.bedNumber}`,
      status:
        String(bed.status).toUpperCase() === "VACANT" ? "vacant" : "occupied",
    })),
  }));
}

/** List properties for the current owner's organization (for room forms). */
export async function getOrgProperties() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.property.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });
}
