import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { updateWebLoaderBodySchema } from '@/lib/validation';
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
    const parsed = updateWebLoaderBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { loaderId, name, loaderSlug, downloadUrl, status } = parsed.data;
    const adminUsername = await getAdminUsernameFromRequest(req);

    const { data: previous, error: previousError } = await supabaseAdmin
      .from('web_loaders')
      .select('id, name, slug, download_url, status')
      .eq('id', loaderId)
      .maybeSingle();

    if (previousError || !previous) {
      return NextResponse.json(
        { success: false, message: 'Web loader not found' },
        { status: 404 }
      );
    }

    const payload = {};

    if (name) {
      payload.name = name;
    }

    if (loaderSlug) {
      const normalizedSlug = normalizeLoaderSlug(loaderSlug);
      if (!normalizedSlug) {
        return NextResponse.json(
          { success: false, message: 'loaderSlug may only contain letters, numbers, - and _' },
          { status: 400 }
        );
      }
      payload.slug = normalizedSlug;
    }

    if (downloadUrl) {
      payload.download_url = downloadUrl;
    }

    if (status) {
      payload.status = status;
    }

    const { data, error } = await supabaseAdmin
      .from('web_loaders')
      .update(payload)
      .eq('id', loaderId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    const actionType = status && previous.status !== status
      ? status === 'inactive'
        ? 'deactivate_web_loader'
        : 'activate_web_loader'
      : 'edit_web_loader';

    await writeAdminAuditLog({
      adminUsername,
      actionType,
      targetType: 'web_loader',
      targetId: data.id,
      targetValue: data.slug,
      metadata: {
        previous: {
          name: previous.name,
          slug: previous.slug,
          status: previous.status,
          downloadUrl: previous.download_url,
        },
        next: {
          name: data.name,
          slug: data.slug,
          status: data.status,
          downloadUrl: data.download_url,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Web loader updated',
      webLoader: data,
    });
  } catch (error) {
    console.error('Update web loader error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
