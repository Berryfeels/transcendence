import { NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Shared tracking object (same instance as reset route within the same process)
const botTracking: Record<string, { prevScore: number; prevHp: number }> = {};
(globalThis as any).__botTracking = (globalThis as any).__botTracking || botTracking;

function getTracking(): Record<string, { prevScore: number; prevHp: number }> {
  return (globalThis as any).__botTracking;
}

/**
 * Decode action integer into movement + shoot.
 *
 * Action space (10 discrete actions):
 *   0: idle            1: idle + shoot
 *   2: up              3: up + shoot
 *   4: down            5: down + shoot
 *   6: left            7: left + shoot
 *   8: right           9: right + shoot
 */
function decodeAction(action: number): { dx: number; dy: number; shoot: boolean } {
  const shoot = action % 2 === 1;
  const move = Math.floor(action / 2);
  const directions: [number, number][] = [
    [0, 0],   // 0: idle
    [0, -1],  // 1: up
    [0, 1],   // 2: down
    [-1, 0],  // 3: left
    [1, 0],   // 4: right
  ];
  const [dx, dy] = directions[move] ?? [0, 0];
  return { dx, dy, shoot };
}

/**
 * POST /api/game/step
 * Apply an action for a bot, wait one tick, return new observation + reward.
 *
 * Request body:
 *   { "botId": string, "action": 0-9 }
 *
 * Response:
 *   { "observation": number[12], "reward": number, "done": boolean, "info": { ... } }
 *
 * Reward structure:
 *   +1.0  per hit dealt
 *   +5.0  per kill
 *   -1.0  per hit taken
 *   -5.0  on death
 *   -0.01 per step (encourages efficiency)
 */
export async function POST(req: Request) {
  const guard = await guardApiRoute();
  if (!guard.ok) return guard.response;

  const state = (globalThis as any).__gameState;
  const fns = (globalThis as any).__gameFns;
  const constants = (globalThis as any).__gameConstants;
  const tracking = getTracking();

  if (!state || !fns || !constants) {
    return NextResponse.json({ error: 'Game not running' }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { botId, action } = body;

  if (!botId || typeof action !== 'number' || action < 0 || action > 9) {
    return NextResponse.json(
      { error: 'Required: botId (string), action (0-9)' },
      { status: 400 },
    );
  }

  const player = state.players[botId];
  if (!player) {
    return NextResponse.json({ error: 'Bot not found — call /api/game/reset first' }, { status: 404 });
  }

  // Apply action
  const { dx, dy, shoot } = decodeAction(action);
  player.dx = dx;
  player.dy = dy;
  if (shoot) fns.shootBullet(botId);

  // Wait one server tick so the action is processed
  const tickMs = Math.ceil(1000 / constants.TICK_RATE) + 5;
  await new Promise((resolve) => setTimeout(resolve, tickMs));

  // Compute reward
  const prev = tracking[botId] || { prevScore: 0, prevHp: constants.MAX_HP };
  const scoreDelta = player.score - prev.prevScore;
  const hpDelta = player.hp - prev.prevHp;

  let reward = -0.01; // step penalty
  reward += scoreDelta * 1.0; // score gain (hits = +1, kills = +5 from server)
  if (hpDelta < 0) reward += hpDelta * 1.0; // damage taken (-1 per hp lost)
  if (player.hp <= 0) reward -= 5.0; // death penalty

  // Update tracking
  tracking[botId] = { prevScore: player.score, prevHp: player.hp };

  // Check done
  const done = player.hp <= 0;

  // Get observation
  const observation = fns.getObservation(botId);

  return NextResponse.json({
    observation,
    reward,
    done,
    info: {
      hp: player.hp,
      score: player.score,
      tick: state.tickCount,
    },
  });
}

/**
 * DELETE /api/game/step?botId=xxx
 * Remove a bot from the game.
 */
export async function DELETE(req: Request) {
  const guard = await guardApiRoute();
  if (!guard.ok) return guard.response;

  const state = (globalThis as any).__gameState;
  if (!state) {
    return NextResponse.json({ error: 'Game not running' }, { status: 503 });
  }

  const url = new URL(req.url);
  const botId = url.searchParams.get('botId');

  if (!botId || !state.players[botId]) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  delete state.players[botId];
  state.bullets = state.bullets.filter((b: any) => b.ownerId !== botId);

  const tracking = getTracking();
  delete tracking[botId];

  return NextResponse.json({ success: true, message: `Bot ${botId} removed` });
}
