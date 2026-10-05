'use server';

import { revalidatePath } from 'next/cache';
import type { Tenant } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUserOrg } from '@/actions/authActions';

export interface CreateTenantData {
  fullName: string;
  phone: string;
  email?: string;
  bedId?: string;
  emergencyContact?: string;
}

export type CreateTenantResult =
  | { success: true; tenant: Tenant }
  | { success: false; error: string };

/**
 * Save a real tenant to the database (Supabase/Postgres via Prisma).
 *
 * - Resolves the signed-in owner's Organization via getCurrentUserOrg().
 * - Inserts the Tenant linked to that organization.
 * - If a bedId is given, links the tenant to the bed and flips it to OCCUPIED
 *   atomically (race-safe: only VACANT -> OCCUPIED counts as success).
 * - Revalidates /tenants and / so the UI refreshes instantly.
 */
export async function createTenant(data: CreateTenantData): Promise<CreateTenantResult> {
  try {
    const fullName = data.fullName?.trim();
    const phone = data.phone?.trim();
    const email = data.email?.trim() ? data.email.trim() : null;
    const bedId = data.bedId?.trim() ? data.bedId.trim() : undefined;
    const emergencyContact = data.emergencyContact?.trim()
      ? data.emergencyContact.trim()
      : null;

    if (!fullName) return { success: false, error: 'Full name is required.' };
    if (!phone) return { success: false, error: 'Phone number is required.' };

    // NOTE: Tenant.bedId is required + unique in the Prisma schema, so a bed
    // must be selected. There is no valid "tenant without a bed" insert.
    if (!bedId)
      return { success: false, error: 'Please select a bed to assign this tenant.' };

    const organization = await getCurrentUserOrg();
    if (!organization) {
      return {
        success: false,
        error: 'Not authenticated. Please sign in to add tenants.',
      };
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findUnique({ where: { id: bedId } });
      if (!bed)
        throw new Error(
          `Bed not found (id: "${bedId}"). Save real rooms/beds to the database first, or pass a valid bedId.`
        );
      if (bed.organizationId !== organization.id)
        throw new Error('Selected bed belongs to a different organization.');
      if (bed.status !== 'VACANT')
        throw new Error('Selected bed is no longer vacant. Please pick another bed.');

      const created = await tx.tenant.create({
        data: {
          organizationId: organization.id,
          bedId,
          fullName,
          phone,
          email,
          emergencyContact,
        },
      });

      // Race-safe flip: only VACANT -> OCCUPIED counts as success.
      const updated = await tx.bed.updateMany({
        where: { id: bedId, status: 'VACANT' },
        data: { status: 'OCCUPIED' },
      });
      if (updated.count === 0)
        throw new Error('Selected bed was just booked. Please pick another bed.');

      return created;
    });

    revalidatePath('/tenants');
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
