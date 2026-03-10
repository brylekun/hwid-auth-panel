import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeLicenseKey } from '@/lib/licenseKey';
import { buildAuthResponse, validateLicenseAccess } from '@/lib/authValidationFlow';
import { validateBodySchema } from '@/lib/validation';
import { normalizeLoaderSlug } from '@/lib/webLoaderSlug';
import { NextResponse } from 'next/server';

async function getRouteSlug(context) {
  const maybeParams = context?.params;
  if (!maybeParams) {
    return null;
  }

  const params = typeof maybeParams?.then === 'function' ? await maybeParams : maybeParams;
  return typeof params?.slug === 'string' ? params.slug : null;
}

export async function POST(req, context) {
  try {
    const rawSlug = await getRouteSlug(context);
    const slug = normalizeLoaderSlug(rawSlug);

    if (!slug) {
      return NextResponse.json(
        buildAuthResponse(false, 'Invalid loader slug'),
        { status: 400 }
      );
    }

    const { data: loader, error: loaderError } = await supabaseAdmin
      .from('web_loaders')
      .select('id, name, slug, download_url, status')
      .eq('slug', slug)
      .maybeSingle();

    if (loaderError) {
      console.error('Failed to load web loader:', loaderError);
      return NextResponse.json(
        buildAuthResponse(false, 'Server error'),
        { status: 500 }
      );
    }

    if (!loader) {
      return NextResponse.json(
        buildAuthResponse(false, 'Loader not found'),
        { status: 404 }
      );
    }

    if (loader.status !== 'active') {
      return NextResponse.json(
        buildAuthResponse(false, 'Loader inactive'),
        { status: 403 }
      );
    }

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

    const authResult = await validateLicenseAccess({
      req,
      normalizedLicenseKey,
      hwidHash,
      deviceName,
    });

    if (!authResult.success) {
      return NextResponse.json(authResult.body, {
        status: authResult.status,
        headers: authResult.headers,
      });
    }

    return NextResponse.json(
      {
        ...authResult.body,
        message: 'Loader authorized',
        loader: {
          id: loader.id,
          name: loader.name,
          slug: loader.slug,
          downloadUrl: loader.download_url,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Web loader auth route error:', error);
    return NextResponse.json(
      buildAuthResponse(false, 'Server error'),
      { status: 500 }
    );
  }
}
