import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeLicenseKey } from '@/lib/licenseKey';
import { buildAuthResponse, validateLicenseAccess } from '@/lib/authValidationFlow';
import { validateBodySchema } from '@/lib/validation';
import { normalizeLoaderSlug } from '@/lib/webLoaderSlug';
import { NextResponse } from 'next/server';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

async function getRouteSlug(context) {
  const maybeParams = context?.params;
  if (!maybeParams) {
    return null;
  }

  const params = typeof maybeParams?.then === 'function' ? await maybeParams : maybeParams;
  return typeof params?.slug === 'string' ? params.slug : null;
}

function resolveSignedTtlSeconds(loaderTtlSeconds) {
  const envTtl = Number(process.env.WEB_LOADER_AUTH_SIGNED_URL_TTL_SECONDS ?? DEFAULT_SIGNED_URL_TTL_SECONDS);
  const raw = Number.isFinite(loaderTtlSeconds) && loaderTtlSeconds > 0 ? loaderTtlSeconds : envTtl;
  return Math.min(3600, Math.max(60, Math.floor(raw)));
}

async function resolveDownloadUrl(loader) {
  if (!loader.storage_bucket || !loader.storage_path) {
    return {
      downloadUrl: loader.download_url,
      isSignedUrl: false,
      signedUrlExpiresInSeconds: null,
      error: null,
    };
  }

  const signedTtlSeconds = resolveSignedTtlSeconds(loader.signed_url_ttl_seconds);

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(loader.storage_bucket)
    .createSignedUrl(loader.storage_path, signedTtlSeconds);

  if (signedError || !signedData?.signedUrl) {
    console.error('Failed to create signed web loader URL:', signedError);
    return {
      downloadUrl: '',
      isSignedUrl: false,
      signedUrlExpiresInSeconds: null,
      error: signedError?.message || 'Failed to create signed URL',
    };
  }

  return {
    downloadUrl: signedData.signedUrl,
    isSignedUrl: true,
    signedUrlExpiresInSeconds: signedTtlSeconds,
    error: null,
  };
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
      .select('id, name, slug, download_url, storage_bucket, storage_path, signed_url_ttl_seconds, expected_sha256, status')
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

    const { licenseKey, hwidHash, deviceName, sessionId, sessionToken } = parsed.data;
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
      sessionId,
      sessionToken,
    });

    if (!authResult.success) {
      return NextResponse.json(authResult.body, {
        status: authResult.status,
        headers: authResult.headers,
      });
    }

    const resolvedDownload = await resolveDownloadUrl(loader);
    if (resolvedDownload.error) {
      return NextResponse.json(
        buildAuthResponse(false, 'Unable to issue fresh download URL'),
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ...authResult.body,
        message: 'Loader authorized',
        loader: {
          id: loader.id,
          name: loader.name,
          slug: loader.slug,
          downloadUrl: resolvedDownload.downloadUrl,
          isSignedUrl: resolvedDownload.isSignedUrl,
          signedUrlExpiresInSeconds: resolvedDownload.signedUrlExpiresInSeconds,
          expectedSha256: loader.expected_sha256 || null,
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
