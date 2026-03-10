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
WEB_LOADER_STORAGE_BUCKET=web-loader-files
WEB_LOADER_STORAGE_PREFIX=web-loaders
WEB_LOADER_STORAGE_PUBLIC=true
WEB_LOADER_SIGNED_URL_TTL_SECONDS=2592000
WEB_LOADER_MAX_UPLOAD_MB=4
```

2. Apply DB hardening migration in Supabase SQL editor:

```sql
-- file: supabase/migrations/20260309_hwid_hardening.sql
-- file: supabase/migrations/20260309_admin_audit_logs.sql
-- file: supabase/migrations/20260309_auth_logs_rate_limit.sql
-- file: supabase/migrations/20260309_devices_status_active.sql
-- file: supabase/migrations/20260310_web_loaders.sql
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

Admin routes:
- `/api/admin/upload-web-loader` (session-protected DLL upload to Supabase Storage, returns `downloadUrl`)

Notes for DLL uploads:
- This route accepts `.dll` files only.
- Default max upload size is `4 MB` (`WEB_LOADER_MAX_UPLOAD_MB`) to stay within common serverless request limits.
- Uploaded files are stored in `WEB_LOADER_STORAGE_BUCKET` and URL-filled directly in the web loader form.
- If `WEB_LOADER_STORAGE_PUBLIC=false`, route returns a signed download URL using `WEB_LOADER_SIGNED_URL_TTL_SECONDS`.
