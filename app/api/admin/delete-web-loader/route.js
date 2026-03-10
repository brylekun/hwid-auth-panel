import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { deleteWebLoaderBodySchema } from '@/lib/validation';
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
    const parsed = deleteWebLoaderBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { loaderId } = parsed.data;
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

    const { error } = await supabaseAdmin
      .from('web_loaders')
      .delete()
      .eq('id', loaderId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'delete_web_loader',
      targetType: 'web_loader',
      targetId: previous.id,
      targetValue: previous.slug,
      metadata: {
        name: previous.name,
        status: previous.status,
        downloadUrl: previous.download_url,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Web loader deleted',
    });
  } catch (error) {
    console.error('Delete web loader error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
