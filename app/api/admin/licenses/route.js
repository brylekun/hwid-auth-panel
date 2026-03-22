import { getDevices, getLicenses } from '@/lib/dashboardData';
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

    const [licenses, devices] = await Promise.all([getLicenses(), getDevices()]);

    return NextResponse.json({
      success: true,
      licenses,
      devices,
    });
  } catch (error) {
    console.error('Admin license sync route error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

