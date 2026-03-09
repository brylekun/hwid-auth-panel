import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { basicAuthChallengeHeaders, isAdminBasicAuthValid } from '@/lib/adminAuth';
import { createLicenseBodySchema } from '@/lib/validation';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    if (!isAdminBasicAuthValid(req.headers)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401, headers: basicAuthChallengeHeaders() }
      );
    }

    const body = await req.json();
    const parsed = createLicenseBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { licenseKey, maxDevices, expiresAt } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from('licenses')
      .insert({
        license_key: licenseKey,
        status: 'active',
        max_devices: maxDevices,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'License created',
      license: data,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
