const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3002', 10);

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000';
const SERVICE_SECRET = process.env.SERVICE_SECRET || '';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// =====================
// Authentication Helper
// =====================
/**
 * Validate a user by forwarding their session token to auth_srvc /api/users/me.
 * Returns { id, name, email } on success, null on failure.
 */
async function authenticateToken(sessionToken) {
  if (!sessionToken) return null;
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/users/me`, {
      headers: {
        'Cookie': `next-auth.session-token=${sessionToken}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // auth_srvc returns the user object (or { data: user })
    const user = data.data || data;
    if (user && (user.id || user.userId)) {
      return {
        id: String(user.id || user.userId),
        name: user.name || user.username || 'Player',
        email: user.email || '',
      };
    }
    return null;
  } catch (err) {
    console.error('Auth validation failed:', err.message);
    return null;
  }
}

/**
 * Check if a request carries a valid SERVICE_SECRET (for DQN bots / inter-service).
 */
function isServiceAuth(secret) {
  return SERVICE_SECRET && secret === SERVICE_SECRET;
}

globalThis.__authHelpers = { authenticateToken, isServiceAuth, AUTH_SERVICE_URL, SERVICE_SECRET };

// =====================
// Game Constants
// =====================
const ARENA_W = 800;
const ARENA_H = 600;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const PLAYER_RADIUS = 15;
const BULLET_RADIUS = 3;
const MAX_HP = 3;
const SHOOT_COOLDOWN = 15; // ticks (~0.75s)
const TICK_RATE = 20;
const RESPAWN_TICKS = 40; // 2 seconds

// =====================
// Game State (shared with API routes via globalThis)
// =====================
const state = {
  players: {},
  bullets: [],
  tickCount: 0,
};

globalThis.__gameState = state;
globalThis.__gameConstants = {
  ARENA_W, ARENA_H, PLAYER_SPEED, BULLET_SPEED,
  PLAYER_RADIUS, BULLET_RADIUS, MAX_HP, SHOOT_COOLDOWN, TICK_RATE,
};

// =====================
// Game Functions
// =====================
function spawnPosition() {
  return {
    x: Math.random() * (ARENA_W - 80) + 40,
    y: Math.random() * (ARENA_H - 80) + 40,
  };
}

function createPlayer(id, isBot = false) {
  const pos = spawnPosition();
  return {
    id,
    x: pos.x,
    y: pos.y,
    dx: 0,
    dy: 0,
    facingAngle: -Math.PI / 2, // face up initially
    hp: MAX_HP,
    score: 0,
    shootCooldown: 0,
    respawnTimer: 0,
    isBot,
    color: isBot ? '#ff4444' : `hsl(${Math.random() * 360}, 80%, 60%)`,
  };
}

function shootBullet(playerId) {
  const p = state.players[playerId];
  if (!p || p.hp <= 0 || p.shootCooldown > 0) return false;

  p.shootCooldown = SHOOT_COOLDOWN;
  state.bullets.push({
    x: p.x + Math.cos(p.facingAngle) * (PLAYER_RADIUS + 5),
    y: p.y + Math.sin(p.facingAngle) * (PLAYER_RADIUS + 5),
    vx: Math.cos(p.facingAngle) * BULLET_SPEED,
    vy: Math.sin(p.facingAngle) * BULLET_SPEED,
    ownerId: playerId,
  });
  return true;
}

function gameTick() {
  state.tickCount++;
  const playerIds = Object.keys(state.players);

  for (const id of playerIds) {
    const p = state.players[id];

    // Handle respawn timer
    if (p.respawnTimer > 0) {
      p.respawnTimer--;
      if (p.respawnTimer === 0) {
        const pos = spawnPosition();
        p.x = pos.x;
        p.y = pos.y;
        p.hp = MAX_HP;
        p.dx = 0;
        p.dy = 0;
      }
      continue;
    }

    if (p.hp <= 0) continue;

    // Movement
    if (p.dx !== 0 || p.dy !== 0) {
      const mag = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
      const nx = p.dx / mag;
      const ny = p.dy / mag;
      p.x += nx * PLAYER_SPEED;
      p.y += ny * PLAYER_SPEED;
      p.facingAngle = Math.atan2(ny, nx);
    }

    // Clamp to arena bounds
    p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_W - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_H - PLAYER_RADIUS, p.y));

    if (p.shootCooldown > 0) p.shootCooldown--;
  }

  // Update bullets & check collisions
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    // Remove out-of-bounds bullets
    if (b.x < -10 || b.x > ARENA_W + 10 || b.y < -10 || b.y > ARENA_H + 10) {
      state.bullets.splice(i, 1);
      continue;
    }

    // Check collision with players
    for (const id of playerIds) {
      const p = state.players[id];
      if (p.id === b.ownerId || p.hp <= 0 || p.respawnTimer > 0) continue;

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < (PLAYER_RADIUS + BULLET_RADIUS) ** 2) {
        p.hp--;
        state.bullets.splice(i, 1);

        const shooter = state.players[b.ownerId];
        if (shooter) {
          shooter.score += 1;
          if (p.hp <= 0) {
            shooter.score += 5; // kill bonus
            p.respawnTimer = RESPAWN_TICKS;
          }
        }
        break;
      }
    }
  }
}

function getObservation(playerId) {
  const p = state.players[playerId];
  if (!p) return null;

  // Find nearest alive opponent
  let nearestOpp = null;
  let nearestDist = Infinity;
  for (const id of Object.keys(state.players)) {
    if (id === playerId) continue;
    const opp = state.players[id];
    if (opp.hp <= 0) continue;
    const d = Math.sqrt((opp.x - p.x) ** 2 + (opp.y - p.y) ** 2);
    if (d < nearestDist) { nearestDist = d; nearestOpp = opp; }
  }

  // Find nearest enemy bullet
  let nearestBullet = null;
  let nearestBulletDist = Infinity;
  for (const b of state.bullets) {
    if (b.ownerId === playerId) continue;
    const d = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
    if (d < nearestBulletDist) { nearestBulletDist = d; nearestBullet = b; }
  }

  const diag = Math.sqrt(ARENA_W ** 2 + ARENA_H ** 2);

  // 12-dimensional normalized observation vector
  return [
    p.x / ARENA_W,                                                // 0: my x
    p.y / ARENA_H,                                                // 1: my y
    p.hp / MAX_HP,                                                // 2: my hp
    Math.cos(p.facingAngle),                                      // 3: facing x
    Math.sin(p.facingAngle),                                      // 4: facing y
    nearestOpp ? nearestOpp.x / ARENA_W : 0.5,                   // 5: opponent x
    nearestOpp ? nearestOpp.y / ARENA_H : 0.5,                   // 6: opponent y
    nearestOpp ? nearestOpp.hp / MAX_HP : 0,                     // 7: opponent hp
    nearestBullet ? (nearestBullet.x - p.x) / diag + 0.5 : 0.5, // 8: bullet relative x
    nearestBullet ? (nearestBullet.y - p.y) / diag + 0.5 : 0.5, // 9: bullet relative y
    p.shootCooldown / SHOOT_COOLDOWN,                             // 10: cooldown ratio
    Math.min(nearestDist / diag, 1),                              // 11: opponent distance
  ];
}

globalThis.__gameFns = { createPlayer, shootBullet, getObservation, gameTick };

// =====================
// Next.js + Socket.IO Server
// =====================
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  });

  globalThis.__io = io;

  // ── Socket.IO authentication middleware ──
  io.use(async (socket, next) => {
    try {
      // Option 1: Token passed in handshake auth
      const token = socket.handshake.auth?.token;
      // Option 2: Token from cookie header
      const cookieHeader = socket.handshake.headers?.cookie || '';
      const cookieToken = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('next-auth.session-token='))
        ?.split('=')[1];

      const sessionToken = token || cookieToken;

      if (!sessionToken) {
        return next(new Error('Authentication required — no session token'));
      }

      const user = await authenticateToken(sessionToken);
      if (!user) {
        return next(new Error('Authentication failed — invalid or expired token'));
      }

      // Attach user info to socket for use in handlers
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`Player connected: ${socket.id} (user: ${user.name}, id: ${user.id})`);
    const player = createPlayer(socket.id);
    player.userId = user.id;
    player.userName = user.name;
    state.players[socket.id] = player;

    socket.emit('init', {
      id: socket.id,
      arena: { width: ARENA_W, height: ARENA_H },
      maxHp: MAX_HP,
      user: { id: user.id, name: user.name },
    });

    socket.broadcast.emit('playerJoined', { id: socket.id, color: player.color, name: user.name });

    socket.on('input', (data) => {
      const p = state.players[socket.id];
      if (!p || p.hp <= 0) return;
      if (data.dx !== undefined) p.dx = Math.max(-1, Math.min(1, data.dx));
      if (data.dy !== undefined) p.dy = Math.max(-1, Math.min(1, data.dy));
      if (data.shoot) shootBullet(socket.id);
    });

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      delete state.players[socket.id];
      state.bullets = state.bullets.filter((b) => b.ownerId !== socket.id);
      io.emit('playerLeft', socket.id);
    });
  });

  // Main game loop at fixed tick rate
  setInterval(() => {
    gameTick();
    io.emit('state', {
      players: state.players,
      bullets: state.bullets,
    });
  }, 1000 / TICK_RATE);

  server.listen(port, hostname, () => {
    console.log(`> Game service ready on http://${hostname}:${port}`);
  });
});
