import AdminLoginForm from '../components/AdminLoginForm';

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const hasConfigError = resolvedSearchParams.error === 'config';

  return (
    <main style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '10px' }}>Admin Login</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Sign in to access your HWID admin panel.
      </p>
      {hasConfigError ? (
        <p style={{ color: '#ff9a9a' }}>
          Admin auth is not configured. Set <code>ADMIN_PANEL_PASSWORD</code> in environment variables.
        </p>
      ) : null}
      <AdminLoginForm />
    </main>
  );
}
