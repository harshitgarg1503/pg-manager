'use server';

import { revalidatePath } from 'next/cache';
import type { Tenant } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUserOrg } from '@/actions/authActions';

export interface CreateTenantData {
  fullName: string;
  phone: string;
  email?: string;
  /** One or more vacant bed ids to assign (a tenant may hold several beds). */
  bedIds?: string[];
  /** @deprecated Use bedIds. Accepted as a single-bed shorthand. */
  bedId?: string;
  /** Agreed total monthly rent (after any discount). Recorded on the tenant. */
  monthlyRent?: number | string;
  emergencyContact?: string;
}

export type CreateTenantResult =
  | { success: true; tenant: Tenant }
  | { success: false; error: string };

/**
 * Save a real tenant to the database (Supabase/Postgres via Prisma).
 *
 * - Resolves the signed-in owner's Organization via getCurrentUserOrg().
 * - Inserts the Tenant linked to that organization (recording the agreed
 *   monthly rent when specified).
 * - Assigns every requested bed to the tenant and flips them to OCCUPIED
 *   atomically (race-safe: all beds must still be VACANT + unassigned).
 * - Revalidates /tenants, /rooms and / so the UI refreshes instantly.
 */
export async function createTenant(data: CreateTenantData): Promise<CreateTenantResult> {
  try {
    const fullName = data.fullName?.trim();
    const phone = data.phone?.trim();
    const email = data.email?.trim() ? data.email.trim() : null;
    const bedIds = [
      ...(Array.isArray(data.bedIds) ? data.bedIds : []),
      ...(data.bedId?.trim() ? [data.bedId.trim()] : []),
    ]
      .map((b) => b.trim())
      .filter(Boolean);
    const uniqueBedIds = [...new Set(bedIds)];
    const emergencyContact = data.emergencyContact?.trim()
      ? data.emergencyContact.trim()
      : null;
    const monthlyRentRaw =
      data.monthlyRent === undefined || data.monthlyRent === null || data.monthlyRent === ""
        ? NaN
        : typeof data.monthlyRent === "string"
          ? parseFloat(data.monthlyRent)
          : data.monthlyRent;
    const monthlyRent =
      Number.isFinite(monthlyRentRaw) && monthlyRentRaw >= 0
        ? Math.round(monthlyRentRaw * 100) / 100
        : null;

    if (!fullName) return { success: false, error: 'Full name is required.' };
    if (!phone) return { success: false, error: 'Phone number is required.' };

    if (uniqueBedIds.length === 0)
      return { success: false, error: 'Please select at least one bed to assign this tenant.' };

    const organization = await getCurrentUserOrg();
    if (!organization) {
      return {
        success: false,
        error: 'Not authenticated. Please sign in to add tenants.',
      };
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const beds = await tx.bed.findMany({
        where: { id: { in: uniqueBedIds } },
      });
      if (beds.length !== uniqueBedIds.length) {
        const found = new Set(beds.map((b) => b.id));
        const missing = uniqueBedIds.find((id) => !found.has(id));
        throw new Error(
          `Bed not found (id: "${missing}"). Save real rooms/beds to the database first, or pass valid bedIds.`
        );
      }
      for (const bed of beds) {
        if (bed.organizationId !== organization.id)
          throw new Error('Selected bed belongs to a different organization.');
        if (bed.status !== 'VACANT' || bed.tenantId)
          throw new Error('One of the selected beds is no longer vacant. Please pick other beds.');
      }

      const created = await tx.tenant.create({
        data: {
          organizationId: organization.id,
          fullName,
          phone,
          email,
          monthlyRent,
          emergencyContact,
        },
      });

      // Race-safe flip: all beds must still be VACANT + unassigned.
      const updated = await tx.bed.updateMany({
        where: { id: { in: uniqueBedIds }, status: 'VACANT', tenantId: null },
        data: { status: 'OCCUPIED', tenantId: created.id },
      });
      if (updated.count !== uniqueBedIds.length)
        throw new Error('One of the selected beds was just booked. Please pick other beds.');

      return created;
    });

    revalidatePath('/tenants');
    revalidatePath('/rooms');
    revalidatePath('/');

    return { success: true, tenant };
  } catch (error) {
    console.error('createTenant failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add tenant.',
    };
  }
}
