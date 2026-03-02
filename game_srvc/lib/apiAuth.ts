import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

/**
 * Authenticate an API request.
 * 
 * Two modes:
 * 1. SERVICE_SECRET header → for DQN bots / inter-service calls
 * 2. next-auth.session-token cookie → for logged-in users
 * 
 * Returns { authenticated: true, type, identity } or a 401 NextResponse.
 */
export async function requireApiAuth(): Promise<
  | { authenticated: true; type: 'service' | 'user'; identity: string }
  | NextResponse
> {
  const authHelpers = (globalThis as any).__authHelpers;
  const SERVICE_SECRET = authHelpers?.SERVICE_SECRET || process.env.SERVICE_SECRET || '';

  // Check service secret first (DQN bots)
  const headerStore = await headers();
  const serviceSecret = headerStore.get('x-service-secret');
  if (serviceSecret && SERVICE_SECRET && serviceSecret === SERVICE_SECRET) {
    return { authenticated: true, type: 'service', identity: 'service-bot' };
  }

  // Check session token (human users via browser)
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('next-auth.session-token')?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required — provide session cookie or x-service-secret header' },
      { status: 401 },
    );
  }

  // Validate with auth_srvc
  const authenticateToken = authHelpers?.authenticateToken;
  if (!authenticateToken) {
    return NextResponse.json({ error: 'Auth system not initialized' }, { status: 503 });
  }

  const user = await authenticateToken(sessionToken);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired session token' },
      { status: 401 },
    );
  }

  return { authenticated: true, type: 'user', identity: user.id };
}

/**
 * Quick helper: returns a 401 response if not authorized, or the auth result.
 */
export async function guardApiRoute() {
  const result = await requireApiAuth();
  if (result instanceof NextResponse) {
    return { ok: false as const, response: result };
  }
  return { ok: true as const, auth: result };
}
