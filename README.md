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
```

2. Apply DB hardening migration in Supabase SQL editor:

```sql
-- file: supabase/migrations/20260309_hwid_hardening.sql
-- file: supabase/migrations/20260309_admin_audit_logs.sql
-- file: supabase/migrations/20260309_auth_logs_rate_limit.sql
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

The auth validation route (`/api/auth/validate`) remains public for your desktop/client app.
