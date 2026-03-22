import { normalizeLicenseKey } from '@/lib/licenseKey';
import {
  buildAuthResponse,
  handleSessionLifecycleAction,
} from '@/lib/authValidationFlow';
import { validateBodySchema } from '@/lib/validation';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = validateBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        buildAuthResponse(false, parsed.error.issues[0]?.message || 'Invalid request body'),
        { status: 400 }
      );
    }

    const { licenseKey, hwidHash, sessionId, sessionToken } = parsed.data;
    if (!sessionId || !sessionToken) {
      return NextResponse.json(
        buildAuthResponse(false, 'sessionId and sessionToken are required'),
        { status: 400 }
      );
    }

    const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
    if (!normalizedLicenseKey) {
      return NextResponse.json(buildAuthResponse(false, 'Invalid license format'), { status: 400 });
    }

    const result = await handleSessionLifecycleAction({
      req,
      normalizedLicenseKey,
      hwidHash,
      sessionId,
      sessionToken,
      action: 'release',
    });

    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (error) {
    console.error('Session release route error:', error);
    return NextResponse.json(buildAuthResponse(false, 'Server error'), { status: 500 });
  }
}

