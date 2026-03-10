import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from './lib/adminSession';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next();
  }

  if (!isAdminAuthConfigured()) {
    if (pathname.startsWith('/api/admin/')) {
      return NextResponse.json(
        { success: false, message: 'Admin auth not configured' },
        { status: 503 }
      );
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(loginUrl);
  }

  if (await isAdminSessionFromRequest(req)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/licenses/:path*', '/devices/:path*', '/web-loaders/:path*', '/api/admin/:path*'],
};
