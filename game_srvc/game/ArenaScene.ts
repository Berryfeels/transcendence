import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

// ─── Types ──────────────────────────────────────────────────────────
interface PlayerData {
  id: string;
  x: number;
  y: number;
  facingAngle: number;
  hp: number;
  score: number;
  color: string;
  respawnTimer: number;
  isBot: boolean;
  shootCooldown: number;
}

interface BulletData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
}

interface ServerState {
  players: Record<string, PlayerData>;
  bullets: BulletData[];
}

// ─── Scene ──────────────────────────────────────────────────────────
export default class ArenaScene extends Phaser.Scene {
  // Sockets
  private socket1!: Socket;
  private socket2: Socket | null = null;
  private myId1 = '';
  private myId2 = '';

  // Arena
  private arenaW = 800;
  private arenaH = 600;
  private maxHp = 3;

  // State
  private latestState: ServerState = { players: {}, bullets: [] };
  private isLocal = false;

  // Display objects
  private ships: Map<string, Phaser.GameObjects.Container> = new Map();
  private bulletGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;

  // Input
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyEnter!: Phaser.Input.Keyboard.Key;

  // Callback to return to menu
  private onBack: (() => void) | null = null;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  init(data: { localMultiplayer?: boolean; onBack?: () => void }) {
    this.isLocal = data?.localMultiplayer ?? false;
    this.onBack = data?.onBack ?? null;
  }

  create() {
    // ── Starfield background ──
    this.drawStarfield();

    // ── Arena border ──
    const border = this.add.graphics().setDepth(1);
    border.lineStyle(1, 0x1a2a40, 0.6);
    border.strokeRect(0, 0, this.arenaW, this.arenaH);

    // ── Bullet layer ──
    this.bulletGfx = this.add.graphics().setDepth(5);

    // ── HUD ──
    this.hudText = this.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8ac4ff',
      backgroundColor: '#00000099',
      padding: { x: 6, y: 4 },
    }).setDepth(100).setScrollFactor(0);

    // ── Controls hint ──
    const hint = this.isLocal
      ? 'P1: WASD + Space  |  P2: Arrows + Enter  |  ESC: menu'
      : 'WASD: move  |  Space: shoot  |  ESC: menu';
    this.add.text(this.arenaW / 2, this.arenaH - 12, hint, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#223344',
    }).setOrigin(0.5).setDepth(50);

    // ── Keyboard ──
    const kb = this.input.keyboard!;
    this.keyW = kb.addKey('W');
    this.keyA = kb.addKey('A');
    this.keyS = kb.addKey('S');
    this.keyD = kb.addKey('D');
    this.keySpace = kb.addKey('SPACE');
    this.keyEsc = kb.addKey('ESC');
    this.cursors = kb.createCursorKeys();
    this.keyEnter = kb.addKey('ENTER');

    // ── Sockets ──
    this.connectSockets();
  }

  // ─── Networking ───────────────────────────────────────────────────
  private connectSockets() {
    const url = window.location.origin;

    // Read session token from cookie to pass to Socket.IO handshake
    const token = this.getSessionToken();
    const socketOpts = {
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      auth: token ? { token } : undefined,
    };

    this.socket1 = io(url, socketOpts);
    this.socket1.on('init', (d: any) => {
      this.myId1 = d.id;
      this.arenaW = d.arena.width;
      this.arenaH = d.arena.height;
      this.maxHp = d.maxHp;
    });
    this.socket1.on('state', (d: ServerState) => { this.latestState = d; });
    this.socket1.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err.message);
    });

    if (this.isLocal) {
      this.socket2 = io(url, socketOpts);
      this.socket2.on('init', (d: any) => { this.myId2 = d.id; });
      this.socket2.on('connect_error', (err: Error) => {
        console.error('Socket2 connection error:', err.message);
      });
    }
  }

  private getSessionToken(): string | null {
    try {
      const cookies = document.cookie.split(';');
      for (const c of cookies) {
        const [name, value] = c.trim().split('=');
        if (name === 'next-auth.session-token') return value;
      }
    } catch {}
    return null;
  }

  // ─── Game loop ────────────────────────────────────────────────────
  update() {
    // ESC → back to menu
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.shutdown();
      if (this.onBack) this.onBack();
      return;
    }

    this.sendInput();
    this.renderPlayers();
    this.renderBullets();
    this.renderHud();
  }

  // ─── Input ────────────────────────────────────────────────────────
  private sendInput() {
    // P1: WASD + Space
    let dx1 = 0, dy1 = 0;
    if (this.keyA.isDown) dx1 -= 1;
    if (this.keyD.isDown) dx1 += 1;
    if (this.keyW.isDown) dy1 -= 1;
    if (this.keyS.isDown) dy1 += 1;
    this.socket1.volatile.emit('input', {
      dx: dx1, dy: dy1, shoot: this.keySpace.isDown,
    });

    // P2: Arrows + Enter
    if (this.socket2) {
      let dx2 = 0, dy2 = 0;
      if (this.cursors.left.isDown) dx2 -= 1;
      if (this.cursors.right.isDown) dx2 += 1;
      if (this.cursors.up.isDown) dy2 -= 1;
      if (this.cursors.down.isDown) dy2 += 1;
      this.socket2.volatile.emit('input', {
        dx: dx2, dy: dy2, shoot: this.keyEnter.isDown,
      });
    }
  }

  // ─── Rendering: Players ───────────────────────────────────────────
  private renderPlayers() {
    const alive = new Set(Object.keys(this.latestState.players));

    // Remove disconnected
    for (const [id, c] of this.ships) {
      if (!alive.has(id)) {
        c.destroy();
        this.ships.delete(id);
      }
    }

    // Update / create
    for (const [id, p] of Object.entries(this.latestState.players)) {
      let ship = this.ships.get(id);
      if (!ship) {
        ship = this.buildShip(p);
        this.ships.set(id, ship);
      }
      ship.setPosition(p.x, p.y);
      ship.setRotation(p.facingAngle);
      ship.setAlpha(p.respawnTimer > 0 || p.hp <= 0 ? 0.2 : 1);

      // Own-ship indicator ring
      const ring = ship.getByName('ring') as Phaser.GameObjects.Graphics;
      if (ring) {
        ring.setVisible(id === this.myId1 || id === this.myId2);
      }

      // HP bar
      const hpBar = ship.getByName('hpBar') as Phaser.GameObjects.Graphics;
      if (hpBar) {
        hpBar.clear();
        const ratio = Math.max(0, p.hp / this.maxHp);
        const c = ratio > 0.6 ? 0x00ff44 : ratio > 0.3 ? 0xffaa00 : 0xff2200;
        hpBar.fillStyle(c, 0.9);
        hpBar.fillRect(-16, -24, 32 * ratio, 3);
      }
    }
  }

  private buildShip(p: PlayerData): Phaser.GameObjects.Container {
    const container = this.add.container(p.x, p.y).setDepth(10);
    const color = this.hexToNumber(p.color);

    // Selection ring
    const ring = this.add.graphics();
    ring.lineStyle(1, 0xffffff, 0.35);
    ring.strokeCircle(0, 0, 22);
    ring.setName('ring');
    ring.setVisible(false);
    container.add(ring);

    // Ship hull
    const body = this.add.graphics();
    body.fillStyle(color, 0.85);
    body.beginPath();
    body.moveTo(20, 0);
    body.lineTo(-10, -12);
    body.lineTo(-5, 0);
    body.lineTo(-10, 12);
    body.closePath();
    body.fillPath();

    // Outline
    body.lineStyle(1, 0xffffff, 0.4);
    body.beginPath();
    body.moveTo(20, 0);
    body.lineTo(-10, -12);
    body.lineTo(-5, 0);
    body.lineTo(-10, 12);
    body.closePath();
    body.strokePath();

    // Engine glow
    body.fillStyle(0xff6600, 0.7);
    body.fillCircle(-9, 0, 3);
    body.fillStyle(0xffaa00, 0.35);
    body.fillCircle(-13, 0, 5);
    container.add(body);

    // HP bar background
    const hpBg = this.add.graphics();
    hpBg.fillStyle(0x000000, 0.5);
    hpBg.fillRect(-16, -24, 32, 3);
    container.add(hpBg);

    // HP bar fill
    const hpBar = this.add.graphics();
    hpBar.setName('hpBar');
    container.add(hpBar);

    return container;
  }

  // ─── Rendering: Bullets ───────────────────────────────────────────
  private renderBullets() {
    this.bulletGfx.clear();
    for (const b of this.latestState.bullets) {
      const owner = this.latestState.players[b.ownerId];
      const color = owner ? this.hexToNumber(owner.color) : 0xffffff;

      // Glow
      this.bulletGfx.fillStyle(color, 0.2);
      this.bulletGfx.fillCircle(b.x, b.y, 7);
      // Core
      this.bulletGfx.fillStyle(0xffffff, 0.9);
      this.bulletGfx.fillCircle(b.x, b.y, 2.5);
    }
  }

  // ─── Rendering: HUD ──────────────────────────────────────────────
  private renderHud() {
    const lines: string[] = [];
    const p1 = this.latestState.players[this.myId1];
    if (p1) lines.push(`P1  HP:${p1.hp}/${this.maxHp}  Score:${p1.score}`);

    if (this.isLocal) {
      const p2 = this.latestState.players[this.myId2];
      if (p2) lines.push(`P2  HP:${p2.hp}/${this.maxHp}  Score:${p2.score}`);
    }

    lines.push(`Players: ${Object.keys(this.latestState.players).length}`);
    this.hudText.setText(lines.join('\n'));
  }

  // ─── Starfield ────────────────────────────────────────────────────
  private drawStarfield() {
    const gfx = this.add.graphics().setDepth(0);
    gfx.fillStyle(0x060810);
    gfx.fillRect(-50, -50, this.arenaW + 100, this.arenaH + 100);

    const rng = new Phaser.Math.RandomDataGenerator(['space-arena']);
    for (let i = 0; i < 180; i++) {
      const x = rng.between(0, this.arenaW);
      const y = rng.between(0, this.arenaH);
      const b = rng.frac();
      gfx.fillStyle(0xffffff, 0.1 + b * 0.5);
      gfx.fillCircle(x, y, 0.4 + b * 1.4);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  private hexToNumber(hex: string): number {
    try {
      return Phaser.Display.Color.HexStringToColor(hex || '#44aaff').color;
    } catch {
      return 0x44aaff;
    }
  }

  shutdown() {
    this.socket1?.disconnect();
    this.socket2?.disconnect();
    for (const c of this.ships.values()) c.destroy();
    this.ships.clear();
  }
}
