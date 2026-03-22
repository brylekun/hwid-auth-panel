import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { resetLicenseSessionBodySchema } from '@/lib/validation';
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
    const parsed = resetLicenseSessionBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { licenseId } = parsed.data;
    const adminUsername = await getAdminUsernameFromRequest(req);

    const { data: license, error: licenseError } = await supabaseAdmin
      .from('licenses')
      .select('id, license_key, status, expires_at')
      .eq('id', licenseId)
      .maybeSingle();

    if (licenseError || !license) {
      return NextResponse.json(
        { success: false, message: 'License not found' },
        { status: 404 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'reset_license_session',
      targetType: 'license',
      targetId: license.id,
      targetValue: license.license_key,
      metadata: {
        status: license.status,
        expiresAt: license.expires_at,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'License session reset',
    });
  } catch (error) {
    console.error('Reset license session error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
