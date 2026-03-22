import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthConfigured, isAdminSessionFromRequest } from '@/lib/adminSession';
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

    const { count, error: countError } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true })
      .not('id', 'is', null);

    if (countError) {
      return NextResponse.json(
        { success: false, message: countError.message || 'Failed to count admin audit logs' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('admin_audit_logs')
      .delete()
      .not('id', 'is', null);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to clear admin audit logs' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${count || 0} admin audit logs`,
      clearedCount: count || 0,
    });
  } catch (error) {
    console.error('Clear admin audit logs error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

