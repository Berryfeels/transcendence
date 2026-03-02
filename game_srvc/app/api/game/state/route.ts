import { NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/state
 * Returns the current full game state (players + bullets).
 * Requires authentication (session cookie or x-service-secret header).
 */
export async function GET() {
  const guard = await guardApiRoute();
  if (!guard.ok) return guard.response;

  const state = (globalThis as any).__gameState;
  const constants = (globalThis as any).__gameConstants;

  if (!state) {
    return NextResponse.json({ error: 'Game not running' }, { status: 503 });
  }

  return NextResponse.json({
    players: state.players,
    bullets: state.bullets,
    tick: state.tickCount,
    arena: {
      width: constants?.ARENA_W ?? 800,
      height: constants?.ARENA_H ?? 600,
    },
  });
}
