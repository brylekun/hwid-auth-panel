import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { licenseKey, maxDevices, expiresAt } = body;

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, message: 'licenseKey is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('licenses')
      .insert({
        license_key: licenseKey,
        status: 'active',
        max_devices: Number(maxDevices || 1),
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
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}