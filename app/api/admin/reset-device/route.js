import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { resetDeviceBodySchema } from '@/lib/validation';
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
    const parsed = resetDeviceBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { deviceId, hwidHash: requestedHwidHash } = parsed.data;
    const adminUsername = await getAdminUsernameFromRequest(req);

    const { data: previous, error: previousError } = await supabaseAdmin
      .from('devices')
      .select('id, license_id, hwid_hash, device_name')
      .eq('id', deviceId)
      .maybeSingle();

    if (previousError || !previous) {
      return NextResponse.json(
        { success: false, message: 'Device not found' },
        { status: 404 }
      );
    }

    const targetHwidHash = requestedHwidHash || previous.hwid_hash;

    const { data: boundDevices, error: boundDevicesError } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('hwid_hash', targetHwidHash);

    if (boundDevicesError) {
      return NextResponse.json(
        { success: false, message: boundDevicesError.message },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('devices')
      .delete()
      .eq('hwid_hash', targetHwidHash);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'reset_device',
      targetType: 'device',
      targetId: previous.id,
      targetValue: targetHwidHash,
      metadata: {
        licenseId: previous.license_id,
        deviceName: previous.device_name,
        removedBindings: Array.isArray(boundDevices) ? boundDevices.length : 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Device reset successfully'
    });

  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
