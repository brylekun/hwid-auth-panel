HWID panel built with Next.js, hosted on Vercel, and backed by Supabase.

## Getting Started

1. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
ADMIN_PANEL_USERNAME=admin
ADMIN_PANEL_PASSWORD=change-me
ADMIN_SESSION_SECRET=optional-extra-secret
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX_PER_IP=60
AUTH_RATE_LIMIT_MAX_PER_LICENSE=20
AUTH_SINGLE_SESSION_ENFORCED=true
AUTH_SINGLE_SESSION_TTL_SECONDS=1800
AUTH_SESSION_SECRET=change-me-long-random-secret
AUTH_SINGLE_SESSION_ALLOW_LEGACY_SAME_HWID=true
WEB_LOADER_STORAGE_BUCKET=web-loader-files
WEB_LOADER_STORAGE_PREFIX=web-loaders
WEB_LOADER_STORAGE_PUBLIC=false
WEB_LOADER_SIGNED_URL_TTL_SECONDS=300
WEB_LOADER_AUTH_SIGNED_URL_TTL_SECONDS=300
WEB_LOADER_UPLOAD_PREVIEW_TTL_SECONDS=600
WEB_LOADER_MAX_UPLOAD_MB=4
```

2. Apply DB hardening migration in Supabase SQL editor:

```sql
-- file: supabase/migrations/20260309_hwid_hardening.sql
-- file: supabase/migrations/20260309_admin_audit_logs.sql
-- file: supabase/migrations/20260309_auth_logs_rate_limit.sql
-- file: supabase/migrations/20260309_devices_status_active.sql
-- file: supabase/migrations/20260310_web_loaders.sql
-- file: supabase/migrations/20260310_web_loader_signed_urls.sql
-- file: supabase/migrations/20260310_web_loader_expected_sha256.sql
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in on `/login`. Admin APIs are protected by an HttpOnly session cookie.

## Deploy on Vercel

Set the same environment variables in Vercel project settings before deploying.

Public client routes:
- `/api/auth/validate` (license + HWID validation)
- `/api/auth/web-loader/[slug]` (license + HWID validation and returns loader download URL)

Single-session lock:
- When `AUTH_SINGLE_SESSION_ENFORCED=true`, each license key allows only one active auth session window at a time.
- Active window length is controlled by `AUTH_SINGLE_SESSION_TTL_SECONDS` (default `1800`).
- During an active window, another auth attempt for the same key is denied with `409` and `Retry-After` header.
- To continue the same session, clients must send `sessionId` and `sessionToken` from the previous success response.
- Success responses from `/api/auth/validate` and `/api/auth/web-loader/[slug]` now include `sessionId`, `sessionToken`, and `sessionExpiresInSeconds`.
- Compatibility: `AUTH_SINGLE_SESSION_ALLOW_LEGACY_SAME_HWID=true` lets non-handshake clients continue only from the same HWID while still blocking other HWIDs.

Admin routes:
- `/api/admin/upload-web-loader` (session-protected DLL upload to Supabase Storage, returns `downloadUrl`)

Notes for DLL uploads:
- This route accepts `.dll` files only.
- Default max upload size is `4 MB` (`WEB_LOADER_MAX_UPLOAD_MB`) to stay within common serverless request limits.
- Uploaded files are stored in `WEB_LOADER_STORAGE_BUCKET` and URL-filled directly in the web loader form.
- Uploaded storage references are saved in `web_loaders.storage_bucket` + `web_loaders.storage_path`.
- Upload computes and returns `expectedSha256` (SHA-256 of the uploaded DLL), stored in `web_loaders.expected_sha256`.
- `/api/auth/web-loader/[slug]` now generates a fresh short-lived signed URL on every successful auth request.
- `/api/auth/web-loader/[slug]` response includes `loader.expectedSha256` for client-side DLL integrity verification.
- Signed URL TTL is controlled by `WEB_LOADER_AUTH_SIGNED_URL_TTL_SECONDS` (or per-loader `signed_url_ttl_seconds`).
- The dashboard `Download URL` field for storage-backed loaders is a stored fallback URL; actual delivery URL is generated fresh by `/api/auth/web-loader/[slug]`.
