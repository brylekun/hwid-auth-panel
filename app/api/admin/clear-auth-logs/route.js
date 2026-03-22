import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
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

    const adminUsername = await getAdminUsernameFromRequest(req);

    const { count, error: countError } = await supabaseAdmin
      .from('auth_logs')
      .select('id', { count: 'exact', head: true })
      .not('id', 'is', null);

    if (countError) {
      return NextResponse.json(
        { success: false, message: countError.message || 'Failed to count auth logs' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('auth_logs')
      .delete()
      .not('id', 'is', null);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to clear auth logs' },
        { status: 400 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'clear_auth_logs',
      targetType: 'system',
      targetValue: 'auth_logs',
      metadata: {
        clearedCount: count || 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${count || 0} auth logs`,
      clearedCount: count || 0,
    });
  } catch (error) {
    console.error('Clear auth logs error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

