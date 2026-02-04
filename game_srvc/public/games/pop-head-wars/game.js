class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        this.keys = {};
        this.assets = {};
        this.characterList = ['hero', 'enemy', 'enemy2', 'enemy3', 'enemy4'];

        // Game State
        this.gravity = 0.6; // Lower gravity for floatier jumps
        this.friction = 0.8;
        this.cameraX = 0;
        this.gameSpeed = 4; // Faster camera
        this.hueCycle = 0;

        this.platforms = [];
        this.projectiles = [];
        this.particles = [];
        this.enemies = [];
        this.snakes = [];
        this.spikes = [];
        this.clouds = [];
        this.fire = [];

        this.p1 = null;
        this.p2 = null; // Can be null in 1P mode

        this.isPlaying = false;
        this.gameOver = false;
        this.score = 0;

        // Map Gen
        this.mapGenerationX = 0;

        window.addEventListener('resize', () => {
            this.width = this.canvas.width = window.innerWidth;
            this.height = this.canvas.height = window.innerHeight;
            this.initBackground();
        });

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            // Magic Toggles
            if (e.code === 'KeyM' && this.p1) this.p1.toggleMagic();
            if (e.code === 'KeyL' && this.p2) this.p2.toggleMagic();

            // Character Switching
            // P1: 1-4
            if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) && this.p1) {
                const idx = parseInt(e.key) - 1;
                if (idx < this.characterList.length) this.p1.setCharacter(this.characterList[idx]);
            }
            // P2: 5-8
            if (['Digit5', 'Digit6', 'Digit7', 'Digit8'].includes(e.code) && this.p2) {
                const idx = parseInt(e.key) - 5;
                if (idx < this.characterList.length) this.p2.setCharacter(this.characterList[idx]);
            }
        });

        this.initUI();
        this.loadAssets();
        this.initBackground();
    }

    initUI() {
        this.scoreEl = document.getElementById('score');
        this.healthEl = document.getElementById('health');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.finalScoreEl = document.getElementById('final-score');
        this.p1MagicEl = document.getElementById('p1-magic');
        this.p2MagicEl = document.getElementById('p2-magic');

        document.getElementById('start-1p-btn').addEventListener('click', () => this.start(1));
        document.getElementById('start-2p-btn').addEventListener('click', () => this.start(2));

        // Restart buttons also need logic, but for simplicity let's default to whatever was last played or just 1P for now? 
        // Or better, restart logic handling.
        // For simplicity, let's just reload page on restart or go back to menu.
        // Actually, let's make restart use 1P for now or add buttons there too.
        // Easier: Restart button reloads page or goes back to menu.
        document.getElementById('restart-btn').addEventListener('click', () => {
            location.reload();
        });
    }

    loadAssets() {
        const names = ['hero', 'enemy', 'enemy2', 'enemy3', 'enemy4', 'projectile'];
        let loaded = 0;
        names.forEach(name => {
            const img = new Image();
            img.src = `assets/${name}.png`;
            img.onload = () => {
                loaded++;
            };
            this.assets[name] = img;
        });
    }

    initBackground() {
        this.clouds = [];
        for (let i = 0; i < 20; i++) {
            this.clouds.push(new Cloud(this.width, this.height));
        }
        this.fire = [];
        for (let i = 0; i < 50; i++) {
            this.fire.push(new FireParticle(this.width, this.height));
        }
    }

    start(numPlayers) {
        this.isPlaying = true;
        this.gameOver = false;
        this.score = 0;
        this.cameraX = 0;
        this.mapGenerationX = 0;

        this.platforms = [];
        this.projectiles = [];
        this.particles = [];
        this.enemies = [];
        this.snakes = [];
        this.spikes = [];

        this.generateTerrain(this.width * 2);

        this.p1 = new Player(this, 100, 100, 'P1', '#00f3ff');

        if (numPlayers === 2) {
            this.p2 = new Player(this, 200, 100, 'P2', '#ff00ff');
        } else {
            this.p2 = null;
        }

        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.animate();
    }

    endGame() {
        this.isPlaying = false;
        this.gameOver = true;
        this.finalScoreEl.innerText = `SCORE: ${Math.floor(this.score)}`;
        this.gameOverScreen.classList.add('active');
    }

    generateTerrain(distanceToGen) {
        while (this.mapGenerationX < this.cameraX + this.width + distanceToGen) {

            let platformCreated = null;

            if (Math.random() > 0.15) {
                const w = 200 + Math.random() * 400;
                platformCreated = new Platform(this.mapGenerationX, this.height - 50, w, 50, 'ground');
                this.platforms.push(platformCreated);

                if (Math.random() > 0.4) this.spawnEnemyOnPlatform(platformCreated);
                if (Math.random() > 0.7) this.spawnSpikesOnPlatform(platformCreated);
                if (Math.random() > 0.5) {
                    const massW = 50 + Math.random() * 100;
                    const massH = 40 + Math.random() * 60;
                    const massX = platformCreated.x + Math.random() * (platformCreated.width - massW);
                    const massY = platformCreated.y - massH;
                    this.platforms.push(new Platform(massX, massY, massW, massH, 'mass'));
                }
            }

            if (Math.random() > 0.3) {
                const py = this.height - 150 - Math.random() * 300;
                const pw = 100 + Math.random() * 150;
                const color = Math.random() > 0.5 ? '#ffe600' : '#00ff66';
                const floatingPlat = new Platform(this.mapGenerationX + 50, py, pw, 20, 'brick', color);
                this.platforms.push(floatingPlat);

                if (Math.random() > 0.3) this.spawnEnemyOnPlatform(floatingPlat);
                if (Math.random() > 0.6) {
                    this.snakes.push(new Snake(this, floatingPlat.x, floatingPlat.y - 50));
                }
            }

            this.mapGenerationX += 150 + Math.random() * 150;
        }

        this.platforms = this.platforms.filter(p => p.x + p.width > this.cameraX - 100);
        this.enemies = this.enemies.filter(e => e.x > this.cameraX - 100 && e.y < this.height + 200);
        this.snakes = this.snakes.filter(s => s.x > this.cameraX - 100);
        this.spikes = this.spikes.filter(s => s.x > this.cameraX - 100);
    }

    spawnEnemyOnPlatform(platform) {
        const ex = platform.x + platform.width / 2;
        const ey = platform.y - 40;
        this.enemies.push(new Enemy(this, ex, ey));
    }

    spawnSpikesOnPlatform(platform) {
        const sx = platform.x + Math.random() * (platform.width - 40);
        const sy = platform.y - 20;
        this.spikes.push(new Spike(sx, sy));
    }

    update() {
        if (!this.isPlaying) return;

        this.cameraX += this.gameSpeed;
        this.score += 0.1;
        this.hueCycle = (this.hueCycle + 0.2) % 360;

        if (this.mapGenerationX < this.cameraX + this.width + 500) {
            this.generateTerrain(500);
        }

        this.clouds.forEach(c => c.update(this.gameSpeed));
        this.fire.forEach(f => f.update(this.cameraX));

        this.p1.update();
        if (this.p2) this.p2.update();

        this.enemies.forEach(e => e.update());
        this.snakes.forEach(s => s.update());

        this.projectiles.forEach((p, index) => {
            p.update();
            if (p.markedForDeletion) this.projectiles.splice(index, 1);
        });

        if (this.p1.y > this.height) this.p1.respawn();
        if (this.p2 && this.p2.y > this.height) this.p2.respawn();

        this.updateUI();
    }

    draw() {
        this.ctx.fillStyle = `hsl(${this.hueCycle}, 50%, 10%)`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.clouds.forEach(c => c.draw(this.ctx));
        this.fire.forEach(f => f.draw(this.ctx));
        this.ctx.restore();

        this.drawGrid();

        this.ctx.save();
        this.ctx.translate(-this.cameraX, 0);

        this.platforms.forEach(p => p.draw(this.ctx));
        this.spikes.forEach(s => s.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.snakes.forEach(s => s.draw(this.ctx));

        this.p1.draw(this.ctx);
        if (this.p2) this.p2.draw(this.ctx);

        this.projectiles.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = `hsla(${this.hueCycle + 180}, 100%, 50%, 0.2)`;
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        const offsetX = this.cameraX % gridSize;

        for (let x = -offsetX; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    animate() {
        if (!this.isPlaying && !this.gameOver) return;
        this.update();
        this.draw();
        if (this.isPlaying) requestAnimationFrame(() => this.animate());
    }

    updateUI() {
        this.scoreEl.innerText = `DIST: ${Math.floor(this.score)}m`;
        this.healthEl.innerText = `P1: ${this.p1.lives} | P2: ${this.p2 ? this.p2.lives : 'OFF'}`;

        this.p1MagicEl.innerText = `P1 MAGIC: ${this.p1.scale > 1.0 ? 'ACTIVE !!!' : 'READY (PRESS M)'}`;
        this.p2MagicEl.innerText = this.p2 ? `P2 MAGIC: ${this.p2.scale > 1.0 ? 'ACTIVE !!!' : 'READY (PRESS L)'}` : '';
    }
}

class TrippySegment {
    constructor(x, y, radius, hueOffset) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.hueOffset = hueOffset;
    }
}

class Snake {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.startX = x;
        this.width = 40;
        this.height = 40;
        this.length = 8;
        this.segments = [];
        for (let i = 0; i < this.length; i++) {
            this.segments.push(new TrippySegment(x - i * 10, y, 10 + i, i * 20));
        }
        this.angle = 0;
        this.speed = 2;
        this.dead = false;
    }

    update() {
        if (this.dead) return;

        this.angle += 0.1;
        this.x -= this.speed;
        this.y = this.segments[0].y + Math.sin(this.angle) * 2;

        this.segments[0].x = this.x;
        this.segments[0].y = this.y;

        for (let i = 1; i < this.segments.length; i++) {
            const leader = this.segments[i - 1];
            const follower = this.segments[i];

            const dx = leader.x - follower.x;
            const dy = leader.y - follower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
                const angle = Math.atan2(dy, dx);
                follower.x = leader.x - Math.cos(angle) * 10;
                follower.y = leader.y - Math.sin(angle) * 10;
            }
        }

        if (this.x < this.game.cameraX - 200) this.dead = true;
    }

    draw(ctx) {
        if (this.dead) return;
        this.segments.forEach((seg, index) => {
            ctx.save();
            ctx.fillStyle = `hsl(${(this.game.hueCycle * 5 + seg.hueOffset) % 360}, 100%, 50%)`;
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    getHitbox() {
        return { x: this.x - 10, y: this.y - 10, width: 20, height: 20 };
    }
}

class Cloud {
    constructor(canvasWidth, canvasHeight) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * (canvasHeight / 2);
        this.width = 100 + Math.random() * 200;
        this.height = 40 + Math.random() * 60;
        this.speed = 0.2 + Math.random() * 0.5;
        this.canvasWidth = canvasWidth;
    }
    update(gameSpeed) {
        this.x -= this.speed;
        if (this.x + this.width < 0) {
            this.x = this.canvasWidth;
            this.y = Math.random() * (window.innerHeight / 2);
        }
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.height / 2, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(this.x + this.width / 2, this.y - this.height / 2, this.height, Math.PI * 1, Math.PI * 2);
        ctx.arc(this.x + this.width, this.y, this.height / 2, Math.PI * 1.5, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill();
    }
}

class FireParticle {
    constructor(w, h) {
        this.reset(w, h);
    }
    reset(w, h) {
        this.x = Math.random() * w;
        this.y = h + Math.random() * 100;
        this.speedY = 2 + Math.random() * 3;
        this.size = 5 + Math.random() * 15;
        this.canvasHeight = h;
        this.canvasWidth = w;
        this.life = 1.0;
    }
    update(cameraX) {
        this.y -= this.speedY;
        this.life -= 0.01;
        this.x -= 1;
        if (this.y < 0 || this.life <= 0) {
            this.reset(this.canvasWidth, this.canvasHeight);
        }
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${this.life * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Player {
    constructor(game, x, y, id, color) {
        this.game = game;
        this.baseRadius = 20;
        this.baseWidth = 40;
        this.baseHeight = 40;

        this.scale = 1.0;
        this.characterKey = 'hero'; // Default char

        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.speed = 7;
        this.jumpForce = -22;
        this.grounded = false;
        this.id = id;
        this.color = color;
        this.lives = 3;
        this.facingRight = true;
        this.invulnerable = 0;
    }

    setCharacter(key) {
        this.characterKey = key;
    }

    get width() { return this.baseWidth * this.scale; }
    get height() { return this.baseHeight * this.scale; }
    get radius() { return this.baseRadius * this.scale; }

    toggleMagic() {
        const oldHeight = this.height;
        this.scale = (this.scale === 1.0) ? 2.0 : 1.0;
        const newHeight = this.height;
        // Maintain bottom position so we don't clip through ground
        this.y += (oldHeight - newHeight);
    }

    update() {
        if (this.id === 'P1') {
            if (this.game.keys['KeyA']) { this.vx = -this.speed; this.facingRight = false; }
            else if (this.game.keys['KeyD']) { this.vx = this.speed; this.facingRight = true; }
            else { this.vx = 0; }
            if (this.game.keys['KeyW'] && this.grounded) { this.vy = this.jumpForce; this.grounded = false; }
            if (this.game.keys['Space']) { this.shoot(); this.game.keys['Space'] = false; }
        }
        else if (this.id === 'P2') {
            if (this.game.keys['ArrowLeft']) { this.vx = -this.speed; this.facingRight = false; }
            else if (this.game.keys['ArrowRight']) { this.vx = this.speed; this.facingRight = true; }
            else { this.vx = 0; }
            if (this.game.keys['ArrowUp'] && this.grounded) { this.vy = this.jumpForce; this.grounded = false; }
            if (this.game.keys['Enter'] || this.game.keys['ShiftRight']) { this.shoot(); this.game.keys['Enter'] = false; this.game.keys['ShiftRight'] = false; }
        }

        this.vy += this.game.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < this.game.cameraX) {
            this.x = this.game.cameraX;
        }

        this.grounded = false;
        this.game.platforms.forEach(platform => {
            if (this.checkCollision(this, platform)) {
                if (this.vy > 0 && this.y + this.height - this.vy <= platform.y) {
                    this.grounded = true;
                    this.vy = 0;
                    this.y = platform.y - this.height;
                }
                else if (this.vy < 0 && this.y - this.vy >= platform.y + platform.height) {
                    this.vy = 0;
                    this.y = platform.y + platform.height;
                }
            }
        });

        if (this.invulnerable > 0) this.invulnerable--;

        // Enemies
        this.game.enemies.forEach((enemy, index) => {
            if (!enemy.dead && this.checkCollision(this, enemy)) {
                if (this.vy > 0 && this.y + this.height < enemy.y + enemy.height * 0.8) {
                    enemy.die();
                    this.vy = -8;
                } else {
                    this.takeDamage();
                }
            }
        });

        // Snakes
        this.game.snakes.forEach((snake, index) => {
            const hit = snake.getHitbox();
            if (!snake.dead && this.checkCollision(this, hit)) {
                if (this.scale > 1.0) {
                    snake.dead = true;
                } else {
                    this.takeDamage();
                }
            }
        });

        this.game.spikes.forEach(spike => {
            if (this.x < spike.x + spike.width &&
                this.x + this.width > spike.x &&
                this.y < spike.y + spike.height &&
                this.y + this.height > spike.y) {
                this.takeDamage();
            }
        });
    }

    takeDamage() {
        if (this.invulnerable > 0) return;
        this.lives--;
        this.invulnerable = 60;
        this.vy = -10;
        if (this.lives <= 0) {
            this.respawn();
        }
    }

    draw(ctx) {
        if (this.invulnerable > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

        ctx.save();
        const centerX = this.x + this.radius;
        const centerY = this.y + this.radius;

        ctx.beginPath();
        ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
        ctx.clip();

        // Use selected character asset
        const sprite = this.game.assets[this.characterKey];
        if (sprite) {
            if (this.id === 'P2') ctx.filter = 'hue-rotate(60deg)';
            if (!this.facingRight) {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
            }
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();

        ctx.save();
        ctx.shadowBlur = 10 * this.scale;
        ctx.shadowColor = this.color;

        if (this.scale > 1.0) {
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 20;
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2 * this.scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    shoot() {
        const size = this.scale > 1.0 ? 30 : 10;
        const p = new Projectile(this.game, this.x + this.width / 2, this.y + this.height / 2, this.facingRight ? 10 : -10, this.color);
        p.width = size;
        p.height = size;
        this.game.projectiles.push(p);
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    respawn() {
        this.lives--;
        if (this.lives > 0) {
            this.x = this.game.cameraX + 200;
            this.y = 0;
            this.vy = 0;
            this.invulnerable = 120;
            this.scale = 1.0;
        } else {
            this.x = -9999;
        }
        if (this.game.p1.lives <= 0 && (!this.game.p2 || this.game.p2.lives <= 0)) {
            this.game.endGame();
        }
    }
}

class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.width = 40;
        this.height = 40;
        this.radius = 20;
        this.x = x;
        this.y = y;
        this.vx = 2;
        this.vy = 0;
        this.dead = false;
        this.facingRight = true;
    }

    update() {
        if (this.dead) return;

        this.x += this.vx;

        this.vy += this.game.gravity;
        this.y += this.vy;

        this.game.platforms.forEach(p => {
            if (this.x + this.width > p.x && this.x < p.x + p.width &&
                this.y + this.height >= p.y && this.y + this.height <= p.y + this.vy + 5) {
                this.y = p.y - this.height;
                this.vy = 0;

                if (this.x < p.x || this.x + this.width > p.x + p.width) {
                    this.vx *= -1;
                    this.facingRight = !this.facingRight;
                    if (this.x < p.x) this.x = p.x;
                    if (this.x + this.width > p.x + p.width) this.x = p.x + p.width - this.width;
                }
            }
        });

        if (this.y > this.game.height) {
            this.dead = true;
        }
    }

    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        const centerX = this.x + this.radius;
        const centerY = this.y + this.radius;

        ctx.beginPath();
        ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
        ctx.clip();

        if (this.game.assets.enemy) {
            if (!this.facingRight) {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(this.game.assets.enemy, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(this.game.assets.enemy, this.x, this.y, this.width, this.height);
            }
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    die() {
        this.dead = true;
        this.game.score += 50;
    }
}

class Spike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 20;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff0000';

        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.moveTo(this.x + 10, this.y);
        ctx.lineTo(this.x + 20, this.y + this.height);

        ctx.moveTo(this.x + 20, this.y + this.height);
        ctx.lineTo(this.x + 30, this.y);
        ctx.lineTo(this.x + 40, this.y + this.height);

        ctx.fill();
        ctx.restore();
    }
}

class Platform {
    constructor(x, y, width, height, type, color = '#00ff66') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.color = color;
    }

    draw(ctx) {
        ctx.save();

        if (this.type === 'ground' || this.type === 'mass') {
            const glowColor = this.type === 'mass' ? '#ff00ff' : '#00faff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = glowColor;
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = `rgba(${this.type === 'mass' ? '255,0,255' : '0, 250, 255'}, 0.1)`;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(game, x, y, vx, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 6;
        this.vx = vx;
        this.color = color;
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.vx;
        if (this.x > this.game.cameraX + this.game.width || this.x < this.game.cameraX) {
            this.markedForDeletion = true;
        }

        this.game.enemies.forEach(e => {
            if (!this.markedForDeletion && !e.dead &&
                this.x < e.x + e.width && this.x + this.width > e.x &&
                this.y < e.y + e.height && this.y + this.height > e.y) {
                e.die();
                this.markedForDeletion = true;
            }
        });

        this.game.snakes.forEach(s => {
            const hit = s.getHitbox();
            if (!this.markedForDeletion && !s.dead &&
                this.x < hit.x + hit.width && this.x + this.width > hit.x &&
                this.y < hit.y + hit.height && this.y + this.height > hit.y) {
                s.dead = true;
                this.markedForDeletion = true;
            }
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = 'white';
        if (this.width > 20) {
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

window.onload = function () {
    new Game();
};
