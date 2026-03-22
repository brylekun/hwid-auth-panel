import { getAdminAuditLogs, getAuthLogs } from '@/lib/dashboardData';
import { isAdminAuthConfigured, isAdminSessionFromRequest } from '@/lib/adminSession';
import { NextResponse } from 'next/server';

export async function GET(req) {
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

    const [logs, adminAuditLogs] = await Promise.all([getAuthLogs(), getAdminAuditLogs()]);

    return NextResponse.json({
      success: true,
      logs,
      adminAuditLogs,
    });
  } catch (error) {
    console.error('Admin logs sync route error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

