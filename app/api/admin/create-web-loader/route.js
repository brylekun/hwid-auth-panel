import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { createWebLoaderBodySchema } from '@/lib/validation';
import { normalizeLoaderSlug } from '@/lib/webLoaderSlug';
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

    const body = await req.json();
    const parsed = createWebLoaderBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      name,
      loaderSlug,
      downloadUrl,
      storageBucket,
      storagePath,
      signedUrlTtlSeconds,
      expectedSha256,
      status,
    } = parsed.data;
    const normalizedSlug = normalizeLoaderSlug(loaderSlug);
    if (!normalizedSlug) {
      return NextResponse.json(
        { success: false, message: 'loaderSlug may only contain letters, numbers, - and _' },
        { status: 400 }
      );
    }

    const adminUsername = await getAdminUsernameFromRequest(req);

    const { data, error } = await supabaseAdmin
      .from('web_loaders')
      .insert({
        name,
        slug: normalizedSlug,
        download_url: downloadUrl,
        storage_bucket: storageBucket || null,
        storage_path: storagePath || null,
        signed_url_ttl_seconds: signedUrlTtlSeconds || 300,
        expected_sha256: expectedSha256 || null,
        status: status || 'active',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'create_web_loader',
      targetType: 'web_loader',
      targetId: data.id,
      targetValue: data.slug,
      metadata: {
        name: data.name,
        status: data.status,
        downloadUrl: data.download_url,
        storageBucket: data.storage_bucket,
        storagePath: data.storage_path,
        signedUrlTtlSeconds: data.signed_url_ttl_seconds,
        expectedSha256: data.expected_sha256,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Web loader created',
      webLoader: data,
    });
  } catch (error) {
    console.error('Create web loader error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
