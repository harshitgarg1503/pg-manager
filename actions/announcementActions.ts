"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export type AnnouncementPriority = "NORMAL" | "URGENT";

const VALID_PRIORITIES: AnnouncementPriority[] = ["NORMAL", "URGENT"];

export interface CreateAnnouncementData {
  title: string;
  message: string;
  priority: AnnouncementPriority;
}

export type AnnouncementActionResult =
  | { success: true; announcementId: string }
  | { success: false; error: string };

/**
 * Broadcast a notice to the signed-in owner's organization.
 */
export async function createAnnouncement(
  data: CreateAnnouncementData
): Promise<AnnouncementActionResult> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return {
        success: false,
        error: "Not authenticated. Please sign in to broadcast.",
      };
    }

    const title = data.title?.trim();
    const message = data.message?.trim();
    const priority = data.priority;

    if (!title) return { success: false, error: "Title is required." };
    if (!message) return { success: false, error: "Message is required." };
    if (!VALID_PRIORITIES.includes(priority))
      return { success: false, error: "Invalid priority." };

    const announcement = await prisma.announcement.create({
      data: {
        organizationId: org.id,
        title,
        message,
        priority,
      },
    });

    revalidatePath("/");

    return { success: true, announcementId: announcement.id };
  } catch (error) {
    console.error("createAnnouncement failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to post announcement.",
    };
  }
}

/**
 * Recent announcements for the signed-in owner's organization,
 * newest first.
 */
export async function getAnnouncements() {
  const org = await getCurrentUserOrg();
  if (!org) return [];
  return prisma.announcement.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete an announcement belonging to the signed-in owner's organization.
 */
export async function deleteAnnouncement(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const announcement = await prisma.announcement.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    });
    if (!announcement) {
      return {
        success: false,
        error: "Announcement was not found for your organization.",
      };
    }

    await prisma.announcement.delete({ where: { id } });

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("deleteAnnouncement failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete announcement.",
    };
  }
}
