// Runtime env validation only — never throw at build time for public config.
// Server-only secrets are read lazily inside route handlers.
export function getConvexUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function getClerkPublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? null;
}

export function requireServerEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required server env: ${name}`);
  return v;
}
