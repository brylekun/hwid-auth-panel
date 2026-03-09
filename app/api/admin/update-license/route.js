import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { normalizeLicenseKey } from '@/lib/licenseKey';
import { updateLicenseBodySchema } from '@/lib/validation';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Admin auth not configured' },
        { status: 503 }
      );
    }

    if (!(await isAdminSessionFromRequest(req))) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = updateLicenseBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { licenseId, licenseKey, status, expiresAt } = parsed.data;
    const adminUsername = await getAdminUsernameFromRequest(req);

    const { data: previous, error: previousError } = await supabaseAdmin
      .from('licenses')
      .select('id, license_key, status, expires_at')
      .eq('id', licenseId)
      .maybeSingle();

    if (previousError || !previous) {
      return NextResponse.json(
        { success: false, message: 'License not found' },
        { status: 404 }
      );
    }

    const payload = {};

    if (licenseKey) {
      const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
      if (!normalizedLicenseKey) {
        return NextResponse.json(
          { success: false, message: 'licenseKey must be 20 alphanumeric chars (format XXXXX-XXXXX-XXXXX-XXXXX)' },
          { status: 400 }
        );
      }

      payload.license_key = normalizedLicenseKey;
    }

    if (status) {
      payload.status = status;
    }

    if (expiresAt !== undefined) {
      payload.expires_at = expiresAt;
    }

    const { data, error } = await supabaseAdmin
      .from('licenses')
      .update(payload)
      .eq('id', licenseId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    const actionType = status && previous.status !== status
      ? status === 'inactive'
        ? 'ban_license'
        : 'activate_license'
      : 'edit_license';

    await writeAdminAuditLog({
      adminUsername,
      actionType,
      targetType: 'license',
      targetId: data.id,
      targetValue: data.license_key,
      metadata: {
        previous: {
          licenseKey: previous.license_key,
          status: previous.status,
          expiresAt: previous.expires_at,
        },
        next: {
          licenseKey: data.license_key,
          status: data.status,
          expiresAt: data.expires_at,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'License updated',
      license: data,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
