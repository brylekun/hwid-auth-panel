import { normalizeLicenseKey } from '@/lib/licenseKey';
import { buildAuthResponse, validateLicenseAccess } from '@/lib/authValidationFlow';
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

    const { licenseKey, hwidHash, deviceName } = parsed.data;
    const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
    if (!normalizedLicenseKey) {
      return NextResponse.json(
        buildAuthResponse(false, 'Invalid license format'),
        { status: 400 }
      );
    }

    const result = await validateLicenseAccess({
      req,
      normalizedLicenseKey,
      hwidHash,
      deviceName,
    });

    return NextResponse.json(
      result.body,
      {
        status: result.status,
        headers: result.headers,
      }
    );
  } catch (error) {
    console.error('Validation route error:', error);

    return NextResponse.json(
      buildAuthResponse(false, 'Server error'),
      { status: 500 }
    );
  }
}
