import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { deviceId } = await req.json();

    if (!deviceId) {
      return NextResponse.json(
        { success: false, message: 'deviceId required' },
        { status: 400 }
      );
    }

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