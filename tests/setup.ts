process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/cambridgeyle_test";
process.env.GOOGLE_OIDC_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OIDC_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OIDC_ISSUER ??= "https://accounts.google.com";
process.env.GOOGLE_OIDC_REDIRECT_URI ??= "http://localhost:3000/api/auth/google/callback";
process.env.ADMIN_EMAILS ??= "admin@example.test";
