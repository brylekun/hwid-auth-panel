import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  basicAuthChallengeHeaders,
  isAdminAuthConfigured,
  isAdminBasicAuthValid,
} from './lib/adminAuth';

export function proxy(req: NextRequest) {
  if (!isAdminAuthConfigured()) {
    return new NextResponse('Admin auth not configured. Set ADMIN_PANEL_PASSWORD.', {
      status: 503,
    });
  }

  if (isAdminBasicAuthValid(req.headers)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: basicAuthChallengeHeaders(),
  });
}

export const config = {
  matcher: ['/', '/api/admin/:path*'],
};
