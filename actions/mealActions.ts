"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrg } from "@/actions/authActions";

export type MealKey = "breakfast" | "lunch" | "dinner";

const VALID_MEALS: MealKey[] = ["breakfast", "lunch", "dinner"];

export interface TrackedTenant {
  id: string;
  name: string;
  roomNumber: string;
  bedLabel: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface SkippedTenant {
  id: string;
  name: string;
  roomNumber: string;
  bedLabel: string;
  skippedMeals: ("Breakfast" | "Lunch" | "Dinner")[];
}

export interface DailyMealCounts {
  dateKey: string;
  totalTenants: number;
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  tenants: TrackedTenant[];
  skippedList: SkippedTenant[];
}

export interface ForecastDay extends DailyMealCounts {
  /** Tenants skipping all three meals that day ("away"). */
  awayCount: number;
}

/**
 * Parse a "YYYY-MM-DD" day key in server-local time. String keys (not Date
 * objects) cross the client/server boundary without timezone skew, so reads
 * and writes always land on the same calendar day.
 */
function parseDay(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MEAL_LABEL: Record<MealKey, "Breakfast" | "Lunch" | "Dinner"> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function emptyCounts(dateKey: string): DailyMealCounts {
  return {
    dateKey,
    totalTenants: 0,
    breakfastCount: 0,
    lunchCount: 0,
    dinnerCount: 0,
    tenants: [],
    skippedList: [],
  };
}

/**
 * Tenants that occupy at least one bed, with their beds for display. The
 * roster is identical for every forecast day, so it is fetched ONCE and
 * reused (previously it was re-queried per day).
 */
function fetchTrackedTenants(orgId: string) {
  return prisma.tenant.findMany({
    where: { organizationId: orgId, beds: { some: {} } },
    select: {
      id: true,
      fullName: true,
      beds: {
        select: {
          bedNumber: true,
          room: { select: { roomNumber: true } },
        },
        orderBy: { bedNumber: "asc" },
      },
    },
    orderBy: { fullName: "asc" },
  });
}

interface TrackedTenantRow {
  id: string;
  fullName: string;
  beds: { bedNumber: string; room: { roomNumber: string } }[];
}

interface AttendanceRow {
  tenantId: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

/**
 * Pure tally: shapes one day's counts from an in-memory roster + attendance
 * rows. No I/O — shared by the single-day and 4-day forecast paths so the
 * per-day work never re-hits the database.
 */
function shapeDay(
  tenants: TrackedTenantRow[],
  records: AttendanceRow[],
  dateKey: string
): DailyMealCounts {
  const byTenant = new Map(records.map((r) => [r.tenantId, r]));

  let breakfastCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;
  const tracked: TrackedTenant[] = [];
  const skippedList: SkippedTenant[] = [];

  for (const t of tenants) {
    const primaryBed = t.beds[0];
    if (!primaryBed) continue;
    const roomNumber = primaryBed.room.roomNumber;
    const bedLabel =
      t.beds.length > 1
        ? `Bed ${primaryBed.bedNumber} +${t.beds.length - 1} more`
        : `Bed ${primaryBed.bedNumber}`;
    const r = byTenant.get(t.id);
    const eating = {
      breakfast: r ? r.breakfast : true,
      lunch: r ? r.lunch : true,
      dinner: r ? r.dinner : true,
    };
    if (eating.breakfast) breakfastCount += 1;
    if (eating.lunch) lunchCount += 1;
    if (eating.dinner) dinnerCount += 1;

    tracked.push({
      id: t.id,
      name: t.fullName,
      roomNumber,
      bedLabel,
      ...eating,
    });

    const skippedMeals = (Object.keys(eating) as MealKey[])
      .filter((k) => !eating[k])
      .map((k) => MEAL_LABEL[k]);
    if (skippedMeals.length > 0) {
      skippedList.push({
        id: t.id,
        name: t.fullName,
        roomNumber,
        bedLabel,
        skippedMeals,
      });
    }
  }

  return {
    dateKey,
    totalTenants: tracked.length,
    breakfastCount,
    lunchCount,
    dinnerCount,
    tenants: tracked,
    skippedList,
  };
}

/**
 * Headcount for one mess day. Tenants without a record count as eating all
 * three meals (columns default true). Only occupying tenants (holding at
 * least one bed) are counted; the first bed is shown as representative.
 */
export async function getDailyMealCounts(
  dateKey: string
): Promise<DailyMealCounts> {
  const day = parseDay(dateKey);
  if (!day) return emptyCounts(dateKey);

  const org = await getCurrentUserOrg();
  if (!org) return emptyCounts(dateKey);

  const [tenants, records] = await Promise.all([
    fetchTrackedTenants(org.id),
    prisma.mealAttendance.findMany({
      where: { organizationId: org.id, date: day },
      select: { tenantId: true, breakfast: true, lunch: true, dinner: true },
    }),
  ]);

  return shapeDay(tenants, records, dateKey);
}

/**
 * 4-day forecast: today plus the next three days, each counted exactly like
 * getDailyMealCounts, with an away-count (all three meals skipped) per day.
 *
 * Exactly two queries regardless of window size: one roster fetch + one
 * attendance fetch using an `in` date filter (was 2 queries × 4 days).
 */
export async function getUpcomingMealForecast(): Promise<ForecastDay[]> {
  const org = await getCurrentUserOrg();
  if (!org) return [];

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const days = [0, 1, 2, 3].map((offset) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return d;
  });

  const [tenants, records] = await Promise.all([
    fetchTrackedTenants(org.id),
    prisma.mealAttendance.findMany({
      where: { organizationId: org.id, date: { in: days } },
      select: {
        tenantId: true,
        date: true,
        breakfast: true,
        lunch: true,
        dinner: true,
      },
    }),
  ]);

  return days.map((day) => {
    const dateKey = toDateKey(day);
    const shaped = shapeDay(
      tenants,
      records.filter((r) => toDateKey(r.date) === dateKey),
      dateKey
    );
    return {
      ...shaped,
      awayCount: shaped.tenants.filter(
        (t) => !t.breakfast && !t.lunch && !t.dinner
      ).length,
    };
  });
}

/**
 * Record one tenant's choice for one meal on one day (e.g. phoned-in
 * opt-outs taken by the warden). Creates the day row on first write.
 */
export async function setMealAttendance(
  tenantId: string,
  dateKey: string,
  meal: MealKey,
  eating: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const day = parseDay(dateKey);
    if (!day) return { success: false, error: "Invalid date." };
    if (!VALID_MEALS.includes(meal))
      return { success: false, error: "Invalid meal." };

    const org = await getCurrentUserOrg();
    if (!org) {
      return { success: false, error: "Not authenticated. Please sign in." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId: org.id, beds: { some: {} } },
      select: { id: true },
    });
    if (!tenant) {
      return {
        success: false,
        error: "Tenant was not found for your organization.",
      };
    }

    await prisma.mealAttendance.upsert({
      where: { tenantId_date: { tenantId, date: day } },
      update: { [meal]: eating },
      create: {
        organizationId: org.id,
        tenantId,
        date: day,
        [meal]: eating,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("setMealAttendance failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save.",
    };
  }
}
