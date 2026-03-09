import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { licenseKey, hwidHash, deviceName } = body;

    if (!licenseKey || !hwidHash) {
      return NextResponse.json(
        { success: false, message: 'Missing licenseKey or hwidHash' },
        { status: 400 }
      );
    }

    const { data: license, error: licenseError } = await supabaseAdmin
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey)
      .maybeSingle();

    if (licenseError || !license) {
      await supabaseAdmin.from('auth_logs').insert({
        license_key: licenseKey,
        hwid_hash: hwidHash,
        result: 'denied',
        reason: 'license_not_found'
      });

      return NextResponse.json(
        { success: false, message: 'Invalid license' },
        { status: 401 }
      );
    }

    if (license.status !== 'active') {
      await supabaseAdmin.from('auth_logs').insert({
        license_key: licenseKey,
        hwid_hash: hwidHash,
        result: 'denied',
        reason: 'license_inactive'
      });

      return NextResponse.json(
        { success: false, message: 'License inactive' },
        { status: 403 }
      );
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await supabaseAdmin.from('auth_logs').insert({
        license_key: licenseKey,
        hwid_hash: hwidHash,
        result: 'denied',
        reason: 'license_expired'
      });

      return NextResponse.json(
        { success: false, message: 'License expired' },
        { status: 403 }
      );
    }

    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('license_id', license.id);

    if (devicesError) {
      return NextResponse.json(
        { success: false, message: 'Database error' },
        { status: 500 }
      );
    }

    const matchedDevice = devices.find(device => device.hwid_hash === hwidHash);

    if (matchedDevice) {
      await supabaseAdmin
        .from('devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', matchedDevice.id);

      await supabaseAdmin.from('auth_logs').insert({
        license_key: licenseKey,
        hwid_hash: hwidHash,
        result: 'approved',
        reason: 'known_device'
      });

      return NextResponse.json({
        success: true,
        message: 'Authorized'
      });
    }

    if (devices.length >= license.max_devices) {
      await supabaseAdmin.from('auth_logs').insert({
        license_key: licenseKey,
        hwid_hash: hwidHash,
        result: 'denied',
        reason: 'device_limit_reached'
      });

      return NextResponse.json(
        { success: false, message: 'Device limit reached' },
        { status: 403 }
      );
    }

    await supabaseAdmin.from('devices').insert({
      license_id: license.id,
      hwid_hash: hwidHash,
      device_name: deviceName || 'Unknown device'
    });

    await supabaseAdmin.from('auth_logs').insert({
      license_key: licenseKey,
      hwid_hash: hwidHash,
      result: 'approved',
      reason: 'new_device_bound'
    });

    return NextResponse.json({
      success: true,
      message: 'Authorized and bound'
    });
  } catch (error) {
    console.error('Validation route error:', error);

    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}