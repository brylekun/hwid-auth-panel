import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  basicAuthChallengeHeaders,
  isAdminAuthConfigured,
  isAdminBasicAuthValid,
} from '@/lib/adminAuth';
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

    if (!isAdminBasicAuthValid(req.headers)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401, headers: basicAuthChallengeHeaders() }
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

    const { deviceId } = parsed.data;

    const { error } = await supabaseAdmin
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

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
