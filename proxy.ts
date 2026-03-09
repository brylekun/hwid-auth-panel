import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { basicAuthChallengeHeaders, isAdminBasicAuthValid } from './lib/adminAuth';

export function proxy(req: NextRequest) {
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
