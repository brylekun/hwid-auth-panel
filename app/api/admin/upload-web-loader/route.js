import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminUsernameFromRequest,
  isAdminAuthConfigured,
  isAdminSessionFromRequest,
} from '@/lib/adminSession';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';
import { normalizeLoaderSlug } from '@/lib/webLoaderSlug';
import { NextResponse } from 'next/server';

const DEFAULT_BUCKET = 'web-loader-files';
const DEFAULT_PREFIX = 'web-loaders';
const DEFAULT_MAX_UPLOAD_MB = 4;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

function parseMaxUploadBytes() {
  const raw = Number(process.env.WEB_LOADER_MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;
  }

  return Math.floor(raw * 1024 * 1024);
}

function parseSignedUrlTtlSeconds() {
  const raw = Number(process.env.WEB_LOADER_SIGNED_URL_TTL_SECONDS ?? DEFAULT_SIGNED_URL_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  return Math.floor(raw);
}

function normalizePrefix(rawPrefix) {
  const cleaned = String(rawPrefix || DEFAULT_PREFIX)
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');

  return cleaned || DEFAULT_PREFIX;
}

function normalizeFileName(fileName) {
  const safe = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '');

  const withoutExt = safe.replace(/\.dll$/i, '');
  return `${withoutExt || 'loader'}.dll`;
}

async function ensureBucket(bucketName, shouldBePublic) {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const existingBucket = (buckets || []).find(
    (bucket) => bucket.id === bucketName || bucket.name === bucketName
  );

  if (!existingBucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: shouldBePublic,
    });

    if (createError) {
      throw new Error(`Failed to create storage bucket: ${createError.message}`);
    }
    return;
  }

  if (shouldBePublic && !existingBucket.public) {
    const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
      public: true,
    });

    if (updateError) {
      throw new Error(`Failed to set storage bucket public: ${updateError.message}`);
    }
  }
}

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

    const formData = await req.formData();
    const uploaded = formData.get('file');

    if (!uploaded || typeof uploaded === 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing file field' },
        { status: 400 }
      );
    }

    const fileName = String(uploaded.name || '');
    if (!fileName.toLowerCase().endsWith('.dll')) {
      return NextResponse.json(
        { success: false, message: 'Only .dll files are allowed' },
        { status: 400 }
      );
    }

    const maxUploadBytes = parseMaxUploadBytes();
    if (uploaded.size <= 0) {
      return NextResponse.json(
        { success: false, message: 'DLL file is empty' },
        { status: 400 }
      );
    }

    if (uploaded.size > maxUploadBytes) {
      const maxMb = Math.floor(maxUploadBytes / (1024 * 1024));
      return NextResponse.json(
        { success: false, message: `DLL is too large. Max ${maxMb} MB` },
        { status: 400 }
      );
    }

    const adminUsername = await getAdminUsernameFromRequest(req);
    const bucketName = process.env.WEB_LOADER_STORAGE_BUCKET || DEFAULT_BUCKET;
    const prefix = normalizePrefix(process.env.WEB_LOADER_STORAGE_PREFIX);
    const shouldBePublic = (process.env.WEB_LOADER_STORAGE_PUBLIC || 'true').toLowerCase() !== 'false';

    await ensureBucket(bucketName, shouldBePublic);

    const slugField = formData.get('loaderSlug');
    const normalizedSlug =
      typeof slugField === 'string' ? normalizeLoaderSlug(slugField) || 'unassigned' : 'unassigned';

    const isoDate = new Date().toISOString().slice(0, 10);
    const storagePath = `${prefix}/${normalizedSlug}/${isoDate}/${crypto.randomUUID()}-${normalizeFileName(fileName)}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, uploaded, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/octet-stream',
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, message: uploadError.message },
        { status: 400 }
      );
    }

    let downloadUrl = '';
    if (shouldBePublic) {
      const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);
      downloadUrl = urlData?.publicUrl || '';
    } else {
      const ttlSeconds = parseSignedUrlTtlSeconds();
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUrl(storagePath, ttlSeconds);
      if (signedError) {
        return NextResponse.json(
          { success: false, message: signedError.message },
          { status: 400 }
        );
      }

      downloadUrl = signedData?.signedUrl || '';
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    await writeAdminAuditLog({
      adminUsername,
      actionType: 'upload_web_loader_file',
      targetType: 'web_loader_file',
      targetValue: storagePath,
      metadata: {
        bucket: bucketName,
        path: storagePath,
        fileName,
        fileSize: uploaded.size,
        loaderSlug: normalizedSlug,
        downloadUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'DLL uploaded',
      downloadUrl,
      filePath: storagePath,
      bucket: bucketName,
    });
  } catch (error) {
    console.error('Upload web loader file error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
