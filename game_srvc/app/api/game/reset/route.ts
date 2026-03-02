import { NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Per-bot tracking for reward computation (shared via globalThis across routes)
if (!(globalThis as any).__botTracking) {
  (globalThis as any).__botTracking = {};
}
function getTracking(): Record<string, { prevScore: number; prevHp: number }> {
  return (globalThis as any).__botTracking;
}

/**
 * POST /api/game/reset
 * Creates a new bot player and returns the initial observation.
 *
 * Request body (optional):
 *   { "botId": "existing-bot-id" }   ← re-use an existing bot
 *
 * Response:
 *   { "botId": string, "observation": number[12], "info": { ... } }
 *
 * Observation vector (12 floats, all roughly 0-1):
 *   [0]  myX              normalized x position
 *   [1]  myY              normalized y position
 *   [2]  myHp             hp / maxHp
 *   [3]  facingCos        cos(facingAngle)
 *   [4]  facingSin        sin(facingAngle)
 *   [5]  oppX             nearest opponent normalized x
 *   [6]  oppY             nearest opponent normalized y
 *   [7]  oppHp            nearest opponent hp / maxHp
 *   [8]  bulletRelX       nearest enemy bullet relative x (normalized)
 *   [9]  bulletRelY       nearest enemy bullet relative y (normalized)
 *   [10] cooldownRatio    shootCooldown / maxCooldown
 *   [11] oppDistance       distance to nearest opponent (normalized)
 */
export async function POST(req: Request) {
  const guard = await guardApiRoute();
  if (!guard.ok) return guard.response;

  const state = (globalThis as any).__gameState;
  const fns = (globalThis as any).__gameFns;

  if (!state || !fns) {
    return NextResponse.json({ error: 'Game not running' }, { status: 503 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  let botId = body?.botId;

  // Re-use existing bot or create new one
  if (botId && state.players[botId]) {
    // Reset the existing bot — respawn it
    const p = state.players[botId];
    const { ARENA_W, ARENA_H, MAX_HP } = (globalThis as any).__gameConstants;
    p.x = Math.random() * (ARENA_W - 80) + 40;
    p.y = Math.random() * (ARENA_H - 80) + 40;
    p.hp = MAX_HP;
    p.score = 0;
    p.dx = 0;
    p.dy = 0;
    p.shootCooldown = 0;
    p.respawnTimer = 0;
  } else {
    // Create new bot
    botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const player = fns.createPlayer(botId, true);
    state.players[botId] = player;
  }

  // Init tracking
  const tracking = getTracking();
  tracking[botId] = {
    prevScore: state.players[botId].score,
    prevHp: state.players[botId].hp,
  };

  const observation = fns.getObservation(botId);

  return NextResponse.json({
    botId,
    observation,
    info: {
      arenaWidth: (globalThis as any).__gameConstants.ARENA_W,
      arenaHeight: (globalThis as any).__gameConstants.ARENA_H,
      maxHp: (globalThis as any).__gameConstants.MAX_HP,
      actionSpace: 10,
      observationSize: 12,
      actionMapping: {
        0: 'idle',
        1: 'idle+shoot',
        2: 'up',
        3: 'up+shoot',
        4: 'down',
        5: 'down+shoot',
        6: 'left',
        7: 'left+shoot',
        8: 'right',
        9: 'right+shoot',
      },
    },
  });
}
