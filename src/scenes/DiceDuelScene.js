import Phaser from 'phaser';
import { DIE_TYPES } from '../data/dice.js';
import {
  W, H, SURFACE_TOP, SURFACE_BOTTOM, DIE_SIZE, WALL_T,
  DIE_FRICTION, DIE_FRICTION_AIR, DIE_BOUNCE, SETTLE_VEL, MAX_THROW_SPEED,
} from '../constants.js';
import { UPGRADE_MAP, UPGRADE_DESCRIPTIONS } from '../data/upgrades.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const P1_THROW_Y      = 545;
const P2_THROW_Y      = SURFACE_TOP + 50;
const THROW_ORIGIN_X  = W / 2;
const BUMPER_R        = 22;
const BUMPER_KICK     = 9;
const SURFACE_MID     = (SURFACE_TOP + SURFACE_BOTTOM) / 2;
const PLAYER_HP       = 30;
const WINS_NEEDED     = 3;

const MIN_REROLL_VEL  = 1.5;
const QUEUE_CARD_H    = 72;
const QUEUE_CARD_GAP  = 8;
const QUEUE_START_Y   = SURFACE_TOP + 40;
const QUEUE_CARD_X    = 33;

// ─── Scene ───────────────────────────────────────────────────────────────────

export default class DiceDuelScene extends Phaser.Scene {
  constructor() { super({ key: 'DiceDuelScene' }); }

  // ─── INIT ─────────────────────────────────────────────────────────────────

  init(data) {
    this._p1Config  = data.p1Config    ? JSON.parse(JSON.stringify(data.p1Config))  : [];
    this._p2Config  = data.p2Config    ? JSON.parse(JSON.stringify(data.p2Config))  : [];
    // updatedConfig is set when returning from UpgradeScene for the loser
    if (data.updatedConfig) {
      if (data._upgradeOwner === 'p1') this._p1Config = JSON.parse(JSON.stringify(data.updatedConfig));
      else                             this._p2Config = JSON.parse(JSON.stringify(data.updatedConfig));
    }
    this._p1Hp      = data.p1Hp       ?? PLAYER_HP;
    this._p2Hp      = data.p2Hp       ?? PLAYER_HP;
    this._p1Wins    = data.p1Wins     ?? 0;
    this._p2Wins    = data.p2Wins     ?? 0;
    this._gameNum   = data.gameNum    ?? 1;
    this._firstPlayer = data.firstPlayer ?? 'p1';
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  create() {
    this.phase           = 0; // 0=placement, 1=throwing, 2=resolving, 3=done
    this.allDice         = [];
    this._p1Dice         = [];
    this._p2Dice         = [];
    this._p1Block        = 0;
    this._p2Block        = 0;
    this._p1Poison       = 0;
    this._p2Poison       = 0;
    this._cleanBonus     = 0;
    this._mines          = [];
    this.aimActive       = false;
    this._aimStartX      = 0;
    this._aimStartY      = 0;
    this.aimGfx          = this.add.graphics().setDepth(30);
    this._effectQueue    = [];
    this._queueCards     = [];
    this._queueActive    = false;
    this._throwLocked    = false;
    this._currentTurn    = this._firstPlayer;
    this._p1Thrown       = 0;
    this._p2Thrown       = 0;
    this._roundThrown    = 0;
    this._turnBanner     = null;

    this._p1BumperBody   = null;
    this._p2BumperBody   = null;
    this._p1BumperGfx    = null;
    this._p2BumperGfx    = null;
    this._p1BumperX      = W / 2;
    this._p1BumperY      = SURFACE_BOTTOM - 60;
    this._p2BumperX      = W / 2;
    this._p2BumperY      = SURFACE_TOP   + 60;

    this._p1HpTxt        = null;
    this._p2HpTxt        = null;
    this._p1HpBar        = null;
    this._p2HpBar        = null;
    this._statusTxt      = null;

    this._makeTextures();
    this._buildBackground();
    this._buildWalls();
    this._buildHPBars();
    this._buildMatchUI();
    this._buildStatusText();
    this._setupCollisions();
    this._setupPointer();

    this.time.delayedCall(300, () => this._startPlacement());
  }

  // ─── TEXTURES ─────────────────────────────────────────────────────────────

  _makeTextures() {
    const make = (key, fill, stroke, sz) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(fill);   g.fillRoundedRect(1, 1, sz-2, sz-2, 6);
      g.lineStyle(2, stroke); g.strokeRoundedRect(1, 1, sz-2, sz-2, 6);
      g.generateTexture(key, sz, sz); g.destroy();
    };
    make('pdie', 0xd4a820, 0x6b4400, DIE_SIZE);
    make('edie', 0x8b1a1a, 0x3d0808, DIE_SIZE);
  }

  // ─── LAYOUT ───────────────────────────────────────────────────────────────

  _buildBackground() {
    this.add.rectangle(W/2, (SURFACE_TOP)/2, W, SURFACE_TOP, 0x0e1a20);
    this.add.rectangle(W/2, SURFACE_BOTTOM + (H-SURFACE_BOTTOM)/2, W, H-SURFACE_BOTTOM, 0x1a0e0e);
    this.add.rectangle(W/2, (SURFACE_TOP+SURFACE_BOTTOM)/2, W, SURFACE_BOTTOM-SURFACE_TOP, 0x13192e);
    // center divider line
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a3a5a, 0.5);
    g.strokeRect(0, SURFACE_TOP, W, SURFACE_BOTTOM - SURFACE_TOP);
    g.lineStyle(1, 0x1a3a2a, 0.6);
    g.lineBetween(0, SURFACE_MID, W, SURFACE_MID);
  }

  _buildWalls() {
    const opt = { isStatic: true, label: 'wall', friction: 0, frictionStatic: 0, restitution: 0.925,
                  collisionFilter: { category: 0x0020, mask: 0xFFFFFFFF } };
    const cy  = (SURFACE_TOP + SURFACE_BOTTOM) / 2;
    const sh  = SURFACE_BOTTOM - SURFACE_TOP + WALL_T * 2;
    this.matter.add.rectangle(-WALL_T/2,    cy, WALL_T, sh, opt);
    this.matter.add.rectangle(W+WALL_T/2,   cy, WALL_T, sh, opt);
    this.matter.add.rectangle(W/2, SURFACE_TOP    - WALL_T/2, W + WALL_T*2, WALL_T, opt);
    this.matter.add.rectangle(W/2, SURFACE_BOTTOM + WALL_T/2, W + WALL_T*2, WALL_T, opt);
  }

  _buildHPBars() {
    // P2 HP — top strip (rotated 180° visually for P2 perspective)
    const topY = SURFACE_TOP / 2;
    this.add.text(W/2, topY - 14, 'PLAYER 2', {
      fontSize: '11px', color: '#8b1a1a', letterSpacing: 2,
    }).setOrigin(0.5);
    this._p2HpTxt = this.add.text(W/2, topY + 4, `${this._p2Hp} / ${PLAYER_HP}`, {
      fontSize: '18px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._p2HpBarBg = this.add.rectangle(W/2, topY + 20, 160, 6, 0x3d0808);
    this._p2HpBarFg = this.add.rectangle(W/2 - 80 + 80*(this._p2Hp/PLAYER_HP), topY + 20, 160*(this._p2Hp/PLAYER_HP), 6, 0xc0392b).setOrigin(0, 0.5);
    this._p2HpBarFg.setX(W/2 - 80);

    // P1 HP — bottom strip
    const botY = SURFACE_BOTTOM + (H - SURFACE_BOTTOM) / 2;
    this.add.text(W/2, botY - 14, 'PLAYER 1', {
      fontSize: '11px', color: '#6b4400', letterSpacing: 2,
    }).setOrigin(0.5);
    this._p1HpTxt = this.add.text(W/2, botY + 4, `${this._p1Hp} / ${PLAYER_HP}`, {
      fontSize: '18px', color: '#d4a820', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._p1HpBarBg = this.add.rectangle(W/2, botY + 20, 160, 6, 0x3d2a00);
    this._p1HpBarFg = this.add.rectangle(W/2 - 80, botY + 20, 160*(this._p1Hp/PLAYER_HP), 6, 0xd4a820).setOrigin(0, 0.5);
  }

  _buildMatchUI() {
    const cx = W / 2;
    this._matchTxt = this.add.text(cx, SURFACE_MID, '', {
      fontSize: '13px', color: '#2a3848', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);
    this._refreshMatchUI();
  }

  _refreshMatchUI() {
    const p1Dots = '● '.repeat(this._p1Wins) + '○ '.repeat(WINS_NEEDED - this._p1Wins);
    const p2Dots = '● '.repeat(this._p2Wins) + '○ '.repeat(WINS_NEEDED - this._p2Wins);
    this._matchTxt?.setText(`P2 ${p2Dots.trim()}   GAME ${this._gameNum}   ${p1Dots.trim()} P1`);
  }

  _buildStatusText() {
    this._statusTxt = this.add.text(W/2, SURFACE_MID - 18, '', {
      fontSize: '14px', color: '#aabbcc', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
  }

  _setStatus(msg) { this._statusTxt?.setText(msg); }

  _refreshHPBars() {
    const p1Pct = Math.max(0, this._p1Hp) / PLAYER_HP;
    const p2Pct = Math.max(0, this._p2Hp) / PLAYER_HP;
    this._p1HpTxt?.setText(`${Math.max(0,this._p1Hp)} / ${PLAYER_HP}`);
    this._p2HpTxt?.setText(`${Math.max(0,this._p2Hp)} / ${PLAYER_HP}`);
    this._p1HpBarFg?.setDisplaySize(160 * p1Pct, 6);
    this._p2HpBarFg?.setDisplaySize(160 * p2Pct, 6);
  }

  // ─── PLACEMENT PHASE ──────────────────────────────────────────────────────

  _startPlacement() {
    this.phase = 0;
    // Draw both bumpers as draggable circles — placement order is opposite of throw order
    // (the first-thrower places their bumper LAST, giving them a strategic view of opponent's placement)
    const secondPlacer = this._firstPlayer;             // first-thrower places second
    const firstPlacer  = this._firstPlayer === 'p1' ? 'p2' : 'p1';

    this._buildBumperGraphics();
    this._beginPlayerPlacement(firstPlacer, () => {
      this._beginPlayerPlacement(secondPlacer, () => {
        this._lockBumpers();
        this._startThrowPhase();
      });
    });
  }

  _buildBumperGraphics() {
    // P1 bumper (bottom half) — gold
    this._p1BumperGfx = this.add.graphics().setDepth(15);
    this._drawBumper(this._p1BumperGfx, 0, 0, 0xd4a820, 0.4, 'P1');

    // P2 bumper (top half) — red
    this._p2BumperGfx = this.add.graphics().setDepth(15);
    this._drawBumper(this._p2BumperGfx, 0, 0, 0x8b1a1a, 0.4, 'P2');

    this._p1BumperGfx.setPosition(this._p1BumperX, this._p1BumperY);
    this._p2BumperGfx.setPosition(this._p2BumperX, this._p2BumperY);
  }

  _drawBumper(gfx, x, y, color, alpha, label) {
    gfx.clear();
    gfx.fillStyle(color, alpha);   gfx.fillCircle(x, y, BUMPER_R);
    gfx.lineStyle(2.5, color, 0.9); gfx.strokeCircle(x, y, BUMPER_R);
  }

  _beginPlayerPlacement(who, onDone) {
    const isP1 = who === 'p1';
    const color = isP1 ? '#d4a820' : '#e74c3c';
    const halfLabel = isP1 ? 'BOTTOM HALF' : 'TOP HALF';

    // Instruction overlay
    const panel = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6).setInteractive();
    panel.add(dim);

    const py = isP1 ? H*0.72 : H*0.28;
    panel.add(this.add.rectangle(W/2, py, W-32, 88, 0x0a0f1a).setStrokeStyle(2, parseInt(color.replace('#',''), 16), 0.9));
    panel.add(this.add.text(W/2, py - 22, `PLAYER ${isP1?1:2}`, { fontSize: '14px', color, fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5));
    panel.add(this.add.text(W/2, py,      `Drag your bumper (${halfLabel})`, { fontSize: '13px', color: '#7a8a9a' }).setOrigin(0.5));
    panel.add(this.add.text(W/2, py + 20, `Then tap the enemy's bumper to confirm`, { fontSize: '12px', color: '#4a5a6a' }).setOrigin(0.5));

    this.time.delayedCall(2000, () => {
      panel.destroy(true);
      this._activatePlacementDrag(who, onDone);
    });
  }

  _activatePlacementDrag(who, onDone) {
    const isP1   = who === 'p1';
    const myGfx  = isP1 ? this._p1BumperGfx : this._p2BumperGfx;
    const oppGfx = isP1 ? this._p2BumperGfx : this._p1BumperGfx;
    const color  = isP1 ? 0xd4a820 : 0x8b1a1a;

    // Show pulsing ring on draggable bumper
    this._drawBumper(myGfx, 0, 0, color, 0.8, isP1 ? 'P1' : 'P2');
    this._pulseGfx = this.tweens.add({ targets: myGfx, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });

    let dragging = false;

    const onDown = (ptr) => {
      const mx = isP1 ? this._p1BumperX : this._p2BumperX;
      const my = isP1 ? this._p1BumperY : this._p2BumperY;
      if (Math.hypot(ptr.x - mx, ptr.y - my) < BUMPER_R + 16) {
        dragging = true;
      }
      // Check if tapping opponent's bumper to confirm
      const ox = isP1 ? this._p2BumperX : this._p1BumperX;
      const oy = isP1 ? this._p2BumperY : this._p1BumperY;
      if (!dragging && Math.hypot(ptr.x - ox, ptr.y - oy) < BUMPER_R + 20) {
        cleanup();
        onDone();
      }
    };

    const onMove = (ptr) => {
      if (!dragging) return;
      const minY = isP1 ? SURFACE_MID + 20  : SURFACE_TOP  + BUMPER_R + 4;
      const maxY = isP1 ? SURFACE_BOTTOM - BUMPER_R - 4 : SURFACE_MID - 20;
      const newX = Phaser.Math.Clamp(ptr.x, BUMPER_R + 4, W - BUMPER_R - 4);
      const newY = Phaser.Math.Clamp(ptr.y, minY, maxY);
      if (isP1) { this._p1BumperX = newX; this._p1BumperY = newY; myGfx.setPosition(newX, newY); }
      else      { this._p2BumperX = newX; this._p2BumperY = newY; myGfx.setPosition(newX, newY); }
    };

    const onUp = (ptr) => {
      if (dragging) { dragging = false; return; }
      // Tap opponent bumper while not dragging = confirm
      const ox = isP1 ? this._p2BumperX : this._p1BumperX;
      const oy = isP1 ? this._p2BumperY : this._p1BumperY;
      if (Math.hypot(ptr.x - ox, ptr.y - oy) < BUMPER_R + 20) {
        cleanup();
        onDone();
      }
    };

    const cleanup = () => {
      this._pulseGfx?.stop();
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
      this.input.off('pointerup',   onUp);
      this._drawBumper(myGfx, 0, 0, color, 0.8, isP1 ? 'P1' : 'P2');
      myGfx.setAlpha(1);
    };

    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup',   onUp);
  }

  _lockBumpers() {
    // Create physics bodies at confirmed positions
    const bOpt = { isStatic: true, friction: 0, frictionStatic: 0, restitution: 1.1 };
    this._p1BumperBody = this.matter.add.circle(this._p1BumperX, this._p1BumperY, BUMPER_R,
      { ...bOpt, label: 'p1bumper' });
    this._p2BumperBody = this.matter.add.circle(this._p2BumperX, this._p2BumperY, BUMPER_R,
      { ...bOpt, label: 'p2bumper' });

    // Redraw locked bumpers as solid
    this._drawBumper(this._p1BumperGfx, 0, 0, 0xd4a820, 0.85, 'P1');
    this._drawBumper(this._p2BumperGfx, 0, 0, 0x8b1a1a, 0.85, 'P2');

    // Add labels
    this.add.text(this._p1BumperX, this._p1BumperY, 'P1', {
      fontSize: '11px', color: '#d4a820', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);
    this.add.text(this._p2BumperX, this._p2BumperY, 'P2', {
      fontSize: '11px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);
  }

  // ─── THROW PHASE ──────────────────────────────────────────────────────────

  _startThrowPhase() {
    this.phase = 1;
    this._p1Thrown = 0;
    this._p2Thrown = 0;
    this._p1Block  = 0;
    this._p2Block  = 0;
    this._p1Poison = 0;
    this._p2Poison = 0;
    this._cleanBonus = 0;
    this._effectQueue = [];
    this._queueCards.forEach(c => c.container?.destroy());
    this._queueCards = [];
    this._queueActive = false;
    this._throwLocked = false;
    this._clearMines();
    this._clearSurface();

    this._buildTray('p1');
    this._buildTray('p2');
    this._showTurnBanner(this._currentTurn);
  }

  _p1TotalDice()   { return this._p1Config.length; }
  _p2TotalDice()   { return this._p2Config.length; }
  _p1DiceLeft()    { return this._p1TotalDice() - this._p1Thrown; }
  _p2DiceLeft()    { return this._p2TotalDice() - this._p2Thrown; }

  _buildTray(who) {
    const isP1    = who === 'p1';
    const config  = isP1 ? this._p1Config : this._p2Config;
    const stripY  = isP1 ? H - 20 : SURFACE_TOP - 20;
    const tray    = isP1 ? '_p1Tray' : '_p2Tray';
    const spacing = 44;
    const startX  = W/2 - ((config.length - 1) * spacing) / 2;

    this[tray] = config.map((dc, i) => {
      const x   = startX + i * spacing;
      const key = isP1 ? 'pdie' : 'edie';
      const img = this.add.image(x, stripY, key).setDepth(5);
      img.setDisplaySize(38, 38);
      const dt  = DIE_TYPES[dc.type];
      const lbl = this.add.text(x, stripY, String(Math.floor(dc.currentFaceIdx/2)+1), {
        fontSize: '15px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(6);
      return { img, lbl, configIdx: i, thrown: false };
    });
  }

  _showTurnBanner(who) {
    if (this._turnBanner) { this._turnBanner.destroy(true); this._turnBanner = null; }

    const isP1  = who === 'p1';
    const label = isP1 ? 'PLAYER 1' : 'PLAYER 2';
    const color = isP1 ? '#d4a820' : '#e74c3c';
    const fc    = isP1 ? 0xd4a820 : 0xe74c3c;
    const py    = isP1 ? H - 56   : SURFACE_TOP + 56;

    const banner = this._turnBanner = this.add.container(0, 0).setDepth(40).setAlpha(0);

    banner.add(this.add.rectangle(W/2, py, W, 36, fc, 0.15));
    banner.add(this.add.text(W/2, py, `${label}'S TURN`, {
      fontSize: '16px', color, fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));

    this.tweens.add({ targets: banner, alpha: 1, duration: 200 });
  }

  // ─── TURN ADVANCE ─────────────────────────────────────────────────────────

  _advanceTurn() {
    if (this.phase !== 1) return;
    this._throwLocked = false;
    const next = this._currentTurn === 'p1' ? 'p2' : 'p1';
    const nextLeft = next === 'p1' ? this._p1DiceLeft() : this._p2DiceLeft();
    const curLeft  = this._currentTurn === 'p1' ? this._p1DiceLeft() : this._p2DiceLeft();

    if (nextLeft === 0 && curLeft === 0) {
      // Both out of dice — resolve
      this._startResolvePhase();
      return;
    }
    if (nextLeft === 0) {
      // Other player still has dice — don't switch
      this._showTurnBanner(this._currentTurn);
      return;
    }
    this._currentTurn = next;
    this._showTurnBanner(this._currentTurn);
  }

  // ─── POINTER / INPUT ──────────────────────────────────────────────────────

  _setupPointer() {
    this.input.on('pointerdown', (ptr) => {
      if (this.phase !== 1)  return;
      if (this._throwLocked) return;
      // Gate to correct half of screen
      const isP1Turn = this._currentTurn === 'p1';
      const inMyZone = isP1Turn ? ptr.y > SURFACE_MID : ptr.y < SURFACE_MID;
      if (!inMyZone) return;
      this.aimActive  = true;
      this._aimStartX = ptr.x;
      this._aimStartY = ptr.y;
    });

    this.input.on('pointermove', (ptr) => {
      if (!this.aimActive || this.phase !== 1) return;
      this.aimGfx.clear();
      const dx  = ptr.x - this._aimStartX;
      const dy  = ptr.y - this._aimStartY;
      const len = Math.hypot(dx, dy);
      if (len < 12) return;
      const nx = -dx / len;
      const ny = -dy / len;
      const ox = this._currentTurn === 'p1' ? THROW_ORIGIN_X : THROW_ORIGIN_X;
      const oy = this._currentTurn === 'p1' ? P1_THROW_Y     : P2_THROW_Y;
      this.aimGfx.lineStyle(1.5, 0xffffff, 0.25);
      this.aimGfx.beginPath();
      this.aimGfx.moveTo(ox, oy);
      this.aimGfx.lineTo(ox + nx*80, oy + ny*80);
      this.aimGfx.strokePath();
    });

    this.input.on('pointerup', (ptr) => {
      if (!this.aimActive || this.phase !== 1) { this.aimActive = false; this.aimGfx.clear(); return; }
      this.aimGfx.clear();
      this.aimActive = false;
      if (this._throwLocked) return;

      const dragDx = ptr.x - this._aimStartX;
      const dragDy = ptr.y - this._aimStartY;
      const len    = Math.hypot(dragDx, dragDy);
      if (len < 20) return;

      const spd = Math.min(MAX_THROW_SPEED, Math.max(7, len * 0.14));
      const ox  = THROW_ORIGIN_X;
      const oy  = this._currentTurn === 'p1' ? P1_THROW_Y : P2_THROW_Y;
      this._throwNextDie(this._currentTurn, ox, oy, (-dragDx/len)*spd, (-dragDy/len)*spd);
    });
  }

  _throwNextDie(who, ox, oy, vx, vy) {
    const isP1   = who === 'p1';
    const config = isP1 ? this._p1Config : this._p2Config;
    const thrown = isP1 ? this._p1Thrown : this._p2Thrown;
    if (thrown >= config.length) return;

    const dc  = config[thrown];
    const die = this._spawnDie(dc, ox, oy, vx, vy, who);

    // Mark tray card thrown
    const tray = isP1 ? this._p1Tray : this._p2Tray;
    const card = tray?.[thrown];
    if (card) { card.thrown = true; card.img.setAlpha(0.3); card.lbl.setAlpha(0.3); }

    if (isP1) this._p1Thrown++; else this._p2Thrown++;

    this._throwLocked = true;
    die._rolling = true;

    // Wait for settle
    this._waitForSettle(die, () => {
      if (this.phase !== 1) return;
      this._queueDie(die);
      this._advanceTurn();
    });
  }

  _waitForSettle(dieRef, cb) {
    const check = () => {
      if (!dieRef.img?.active || !dieRef._rolling) { cb(); return; }
      this.time.delayedCall(120, check);
    };
    this.time.delayedCall(400, check);
  }

  // ─── DIE SPAWNING ─────────────────────────────────────────────────────────

  _spawnDie(data, x, y, vx, vy, owner) {
    const isP1 = owner === 'p1';
    const key  = isP1 ? 'pdie' : 'edie';
    const lbl  = isP1 ? 'p1die' : 'p2die';

    const img = this.matter.add.image(x, y, key, undefined, {
      isStatic: false, friction: DIE_FRICTION, frictionAir: DIE_FRICTION_AIR,
      restitution: DIE_BOUNCE, label: lbl, density: 0.004,
      shape: { type: 'circle', radius: DIE_SIZE/2 - 2 },
    });
    img.setVelocity(vx, vy);

    const dt     = DIE_TYPES[data.type];
    const faceNo = Math.floor(data.currentFaceIdx/2) + 1;
    const valTxt = this.add.text(x, y, String(faceNo), {
      fontSize: '18px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    const lblTxt = this.add.text(x, y + 14, dt?.label?.slice(0,3).toUpperCase() ?? '', {
      fontSize: '9px', color: dt?.color ?? '#aaaaaa',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    const dieRef = {
      img, data: { ...data }, valTxt, lblTxt,
      isPlayer: true, mpOwner: owner,
      _rolling: false, _valueBonus: 0, _hadCollision: false,
      _infectHits: 0, _mineFiredThisTurn: false,
    };
    img.setData('dieRef', dieRef);
    this.allDice.push(dieRef);
    if (isP1) this._p1Dice.push(dieRef); else this._p2Dice.push(dieRef);
    return dieRef;
  }

  // ─── DIE UPDATE / SETTLE ──────────────────────────────────────────────────

  update() {
    this.allDice.forEach(d => {
      if (!d.img?.active || !d.img.body) return;
      const vx = d.img.body.velocity.x;
      const vy = d.img.body.velocity.y;
      d.valTxt?.setPosition(d.img.x, d.img.y - 2);
      d.lblTxt?.setPosition(d.img.x, d.img.y + 13);
      if (d.crackGfx?.active) d.crackGfx.setPosition(d.img.x, d.img.y);

      if (d._rolling && Math.hypot(vx, vy) < SETTLE_VEL) {
        const roll  = Phaser.Math.Between(0, d.data.sides - 1);
        d.data.currentFaceIdx = roll * 2;
        const faceNo = roll + 1;
        const dt     = DIE_TYPES[d.data.type];
        d.valTxt?.setText(String(faceNo));
        d.valTxt?.setColor(dt?.color ?? '#ffffff');
        d.lblTxt?.setText(dt?.label?.slice(0,3).toUpperCase() ?? '');
        d.lblTxt?.setColor(dt?.color ?? '#aaaaaa');
        d._rolling = false;
      }
    });
  }

  _rerollDie(dieRef) {
    if (!dieRef._rolling) return;
    const sides = dieRef.data.sides ?? 6;
    const roll  = Phaser.Math.Between(0, sides - 1);
    dieRef.data.currentFaceIdx = roll * 2;
    const dt = DIE_TYPES[dieRef.data.type];
    dieRef.valTxt?.setText(String(roll + 1));
    dieRef.valTxt?.setColor(dt?.color ?? '#ffffff');
    dieRef.lblTxt?.setText(dt?.label?.slice(0,3).toUpperCase() ?? '');
    dieRef.lblTxt?.setColor(dt?.color ?? '#aaaaaa');
  }

  _shatterDie(dieRef) {
    if (!dieRef.img?.active) return;
    const px = dieRef.img.x, py = dieRef.img.y;

    const pendingIdx = this._effectQueue.findIndex(e => e.dieRef === dieRef);
    if (pendingIdx !== -1) {
      this._effectQueue.splice(pendingIdx, 1);
      const orphan = this._queueCards.splice(pendingIdx, 1)[0];
      if (orphan) { orphan.container?.destroy(); this._repositionQueueCards(); }
    }

    const g = this.add.graphics().setDepth(50);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      g.fillStyle(0xd4a820, 0.8);
      g.fillRect(px + Math.cos(ang)*12 - 3, py + Math.sin(ang)*12 - 3, 6, 6);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });

    const idx = this.allDice.indexOf(dieRef);
    if (idx !== -1) this.allDice.splice(idx, 1);
    const iP1 = this._p1Dice.indexOf(dieRef);
    if (iP1 !== -1) this._p1Dice.splice(iP1, 1);
    const iP2 = this._p2Dice.indexOf(dieRef);
    if (iP2 !== -1) this._p2Dice.splice(iP2, 1);

    this.time.delayedCall(60, () => {
      dieRef.img?.destroy();
      dieRef.valTxt?.destroy();
      dieRef.lblTxt?.destroy();
      dieRef.crackGfx?.destroy();
    });
  }

  _clearSurface() {
    const toRemove = [...this.allDice];
    toRemove.forEach(d => {
      d.crackGfx?.destroy();
      d.img?.destroy();
      d.valTxt?.destroy();
      d.lblTxt?.destroy();
    });
    this.allDice = [];
    this._p1Dice = [];
    this._p2Dice = [];
  }

  // ─── COLLISION HANDLING ───────────────────────────────────────────────────

  _setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (this.phase !== 1) return;
      const rerolled = new Set();

      event.pairs.forEach(({ bodyA, bodyB }) => {
        const dA = bodyA.gameObject?.getData('dieRef');
        const dB = bodyB.gameObject?.getData('dieRef');

        // Die-die collisions
        if (dA && dB) {
          this._handleDieDie(dA, dB, bodyA, bodyB, rerolled);
          return;
        }

        // Die-bumper or die-wall
        const dieRef  = dA || dB;
        const dieBody = dA ? bodyA : bodyB;
        const other   = dA ? bodyB : bodyA;
        if (!dieRef) return;

        // Mine
        if (other?.label === 'mine') {
          const mine = this._mines.find(m => m.body === other && !m.triggered && m.armed);
          if (mine) { mine.triggered = true; this._triggerMine(mine); }
          return;
        }

        // Bumper contacts
        const isOppBumper = (dieRef.mpOwner === 'p1' && other.label === 'p2bumper') ||
                            (dieRef.mpOwner === 'p2' && other.label === 'p1bumper');
        const isOwnBumper = (dieRef.mpOwner === 'p1' && other.label === 'p1bumper') ||
                            (dieRef.mpOwner === 'p2' && other.label === 'p2bumper');

        if (isOppBumper || isOwnBumper) {
          dieRef._hadCollision = true;
          const bx = other.label === 'p1bumper' ? this._p1BumperX : this._p2BumperX;
          const by = other.label === 'p1bumper' ? this._p1BumperY : this._p2BumperY;
          this._applyBumperKick(dieBody, bx, by);
          if (!rerolled.has(dieRef)) { rerolled.add(dieRef); this._rerollDie(dieRef); }
          this._flashBumper(other.label === 'p1bumper' ? 'p1' : 'p2');

          if (isOppBumper) {
            // Chip damage to opponent
            const bonus   = this._hasDieUpgrade(dieRef.data, 'bumper') ? 1 : 0;
            const target  = dieRef.mpOwner === 'p1' ? 'p2' : 'p1';
            const chip    = 1 + bonus;
            this._dealDamageTo(target, chip, true);
          }

          // Bumper-specific upgrade effects
          if (this._hasDieUpgrade(dieRef.data, 'mine') && !dieRef._mineFiredThisTurn) {
            dieRef._mineFiredThisTurn = true;
            this._spawnMine(dieRef.img?.x ?? bx, dieRef.img?.y ?? by);
          }
          if (this._hasDieUpgrade(dieRef.data, 'explosive_contact') && isOppBumper) {
            this._explosionAt(bx, by, dieRef);
          }
          if (this._hasDieUpgrade(dieRef.data, 'trigger_materials')) {
            const matBonus = this._getMaterialBonus(dieRef.data);
            if (matBonus > 0) {
              const tgt = dieRef.mpOwner === 'p1' ? 'p2' : 'p1';
              this._dealDamageTo(tgt, matBonus, true);
              this._floatText(bx, by - 24, `+${matBonus} CHIP`, '#ffaa00');
            }
          }
          // Tick infected contacts
          if ((dieRef._infectHits ?? 0) > 0) this._tickInfectedContact(dieRef);
          return;
        }

        // Wall contacts
        if (other?.label === 'wall') {
          dieRef._hadCollision = true;
          if (!rerolled.has(dieRef)) { rerolled.add(dieRef); this._rerollDie(dieRef); }
          if (this._hasDieUpgrade(dieRef.data, 'wall_ball')) {
            dieRef._valueBonus = (dieRef._valueBonus ?? 0) + 1;
          }
          if ((dieRef._infectHits ?? 0) > 0) this._tickInfectedContact(dieRef);
        }
      });
    });
  }

  _handleDieDie(dA, dB, bodyA, bodyB, rerolled) {
    // Glass upgrade
    const checkGlass = (die, other) => {
      if (!(die.data.material === 'glass' || this._hasDieUpgrade(die.data, 'glass'))) return false;
      if (die._destroyTriggered) return false;
      die._destroyTriggered = true;
      this._floatText(die.img?.x??0, (die.img?.y??0)-24, 'GLASS!', '#ff6633');
      this._queueDie(die, true); this._queueDie(die, true);
      this._shatterDie(die);
      if (!rerolled.has(other)) { rerolled.add(other); this._rerollDie(other); }
      return true;
    };
    const gA = checkGlass(dA, dB);
    const gB = checkGlass(dB, dA);
    if (gA || gB) return;

    // Bulletproof glass
    if (this._hasDieUpgrade(dA.data, 'bulletproof_glass')) this._handleBulletproofHit(dA);
    if (this._hasDieUpgrade(dB.data, 'bulletproof_glass')) this._handleBulletproofHit(dB);

    // Destroy contacts
    const dAWasInfected = (dA._infectHits ?? 0) > 0;
    const dBWasInfected = (dB._infectHits ?? 0) > 0;
    const infect = (attacker, target) => {
      if (!this._hasDieUpgrade(attacker.data, 'destroy_contacts')) return;
      if (!target.img?.active || !this.allDice.includes(target)) return;
      if ((target._infectHits ?? 0) > 0) return;
      target._infectHits = 1;
      this._applyCrackOverlay(target);
      this._floatText(target.img?.x??0, (target.img?.y??0)-24, 'INFECTED', '#ff6633');
    };
    infect(dA, dB); infect(dB, dA);
    if (dAWasInfected) this._tickInfectedContact(dA);
    if (dBWasInfected) this._tickInfectedContact(dB);

    // Mine upgrade on die-die
    if (dA._rolling && this._hasDieUpgrade(dA.data, 'mine') && !dA._mineFiredThisTurn) {
      dA._mineFiredThisTurn = true;
      this._spawnMine(dA.img?.x ?? 0, dA.img?.y ?? 0);
    }
    if (dB._rolling && this._hasDieUpgrade(dB.data, 'mine') && !dB._mineFiredThisTurn) {
      dB._mineFiredThisTurn = true;
      this._spawnMine(dB.img?.x ?? 0, dB.img?.y ?? 0);
    }

    // Reroll slower die
    const relVel = Math.hypot(bodyA.velocity.x - bodyB.velocity.x, bodyA.velocity.y - bodyB.velocity.y);
    if (relVel >= MIN_REROLL_VEL) {
      const struck = Math.hypot(bodyA.velocity.x, bodyA.velocity.y) <
                     Math.hypot(bodyB.velocity.x, bodyB.velocity.y) ? dA : dB;
      if (!rerolled.has(struck)) { rerolled.add(struck); this._rerollDie(struck); }
    }
  }

  // ─── EFFECT QUEUE ─────────────────────────────────────────────────────────

  _queueDie(dieRef, immediate = false) {
    if (!dieRef.img?.active && !immediate) return;
    const snapX = dieRef.img?.x ?? 0;
    const snapY = dieRef.img?.y ?? 0;

    const isVanguard = this._hasDieUpgrade(dieRef.data, 'vanguard');
    const entry      = { dieRef, snapX, snapY, owner: dieRef.mpOwner };

    if (isVanguard) this._effectQueue.unshift(entry);
    else             this._effectQueue.push(entry);

    const dt     = DIE_TYPES[dieRef.data.type];
    const faceNo = Math.floor(dieRef.data.currentFaceIdx / 2) + 1;
    const color  = dieRef.mpOwner === 'p1' ? 0xd4a820 : 0x8b1a1a;
    const idx    = this._queueCards.length;
    const cardY  = QUEUE_START_Y + idx * (QUEUE_CARD_H + QUEUE_CARD_GAP);
    const cont   = this.add.container(QUEUE_CARD_X, cardY).setDepth(28);
    const bg     = this.add.rectangle(0, 0, 58, QUEUE_CARD_H, color, 0.18)
      .setStrokeStyle(1, color, 0.6);
    const numTxt = this.add.text(0, -14, String(faceNo), {
      fontSize: '22px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const typTxt = this.add.text(0, 10, dt?.label?.slice(0,3).toUpperCase() ?? '', {
      fontSize: '10px', color: dt?.color ?? '#aaaaaa', letterSpacing: 1,
    }).setOrigin(0.5);
    const ownTxt = this.add.text(0, 24, dieRef.mpOwner.toUpperCase(), {
      fontSize: '9px', color: '#556677', letterSpacing: 1,
    }).setOrigin(0.5);
    cont.add([bg, numTxt, typTxt, ownTxt]);
    this._queueCards.push({ container: cont, bg, numTxt, typTxt });
  }

  _repositionQueueCards() {
    this._queueCards.forEach((c, i) => {
      const ty = QUEUE_START_Y + i * (QUEUE_CARD_H + QUEUE_CARD_GAP);
      this.tweens.add({ targets: c.container, y: ty, duration: 120, ease: 'Sine.Out' });
    });
  }

  // ─── RESOLVE PHASE ────────────────────────────────────────────────────────

  _startResolvePhase() {
    this.phase = 2;
    this._setStatus('Resolving...');
    if (this._turnBanner) { this._turnBanner.destroy(true); this._turnBanner = null; }

    // Apply poison at start of resolve
    if (this._p1Poison > 0) {
      const dmg = this._p1Poison;
      this._p1Hp = Math.max(0, this._p1Hp - dmg);
      this._floatText(W/2, P1_THROW_Y, `☠ -${dmg} POISON`, '#44ff88');
      this._p1Poison = Math.max(0, this._p1Poison - 1);
      this._refreshHPBars();
    }
    if (this._p2Poison > 0) {
      const dmg = this._p2Poison;
      this._p2Hp = Math.max(0, this._p2Hp - dmg);
      this._floatText(W/2, P2_THROW_Y, `☠ -${dmg} POISON`, '#44ff88');
      this._p2Poison = Math.max(0, this._p2Poison - 1);
      this._refreshHPBars();
    }

    this.time.delayedCall(600, () => this._processQueue());
  }

  _processQueue() {
    if (this.phase === 99) return;
    if (this._effectQueue.length === 0) {
      this.time.delayedCall(800, () => this._handleRoundEnd());
      return;
    }
    if (this._queueActive) return;
    this._queueActive = true;

    const entry = this._effectQueue.shift();
    const card  = this._queueCards.shift();

    if (!entry) { this._queueActive = false; this._processQueue(); return; }

    // Skip dead dice that were never shattered (shouldn't happen often)
    if (!this.allDice.includes(entry.dieRef) && !entry.immediate) {
      card?.container?.destroy();
      this._repositionQueueCards();
      this._queueActive = false;
      this.time.delayedCall(50, () => this._processQueue());
      return;
    }

    // Flash the queue card
    if (card) {
      const fc = entry.owner === 'p1' ? 0xd4a820 : 0xe74c3c;
      this.tweens.add({
        targets: card.container, scaleX: 1.15, scaleY: 1.15,
        duration: 100, yoyo: true, ease: 'Sine.Out',
        onComplete: () => {
          this._applyDieEffect(entry);
          this.tweens.add({
            targets: card.container, alpha: 0, x: card.container.x + 60,
            duration: 240, delay: 200,
            onComplete: () => {
              card.container.destroy();
              this._repositionQueueCards();
              this._queueActive = false;
              this.time.delayedCall(120, () => this._processQueue());
            }
          });
        }
      });
    } else {
      this._applyDieEffect(entry);
      this._queueActive = false;
      this.time.delayedCall(120, () => this._processQueue());
    }
  }

  _applyDieEffect(entry) {
    const { dieRef, snapX, snapY, owner } = entry;
    const { data }  = dieRef;
    const opponent  = owner === 'p1' ? 'p2' : 'p1';
    let value = Math.floor(data.currentFaceIdx / 2) + 1;
    if (dieRef._cracked)    { value = Math.ceil(value / 2); dieRef._cracked = false; }
    if (dieRef._valueBonus) { value += dieRef._valueBonus;  dieRef._valueBonus = 0;  }
    value = Math.max(0, value);

    // Finisher bonus
    if (this._hasDieUpgrade(data, 'finisher')) {
      const myDice = owner === 'p1' ? this._p1Config : this._p2Config;
      value += myDice.length - 1;
    }

    // Poison upgrade redirects all damage to stacks
    if (this._hasDieUpgrade(data, 'poison')) {
      if (owner === 'p1') this._p2Poison += value;
      else                this._p1Poison += value;
      this._floatText(snapX, snapY - 20, `☠ +${value}`, '#44ff88');
      return;
    }

    switch (data.type) {
      case 'attack': {
        let dmg = value;
        if (this._hasDieUpgrade(data, 'status_damage')) dmg += 5;
        dmg = Math.max(0, dmg);
        this._laserBeam(snapX, snapY,
          opponent === 'p1' ? this._p1BumperX : this._p2BumperX,
          opponent === 'p1' ? this._p1BumperY : this._p2BumperY, 0xff4444);
        this._dealDamageTo(opponent, dmg, false);
        break;
      }
      case 'block': {
        if (owner === 'p1') this._p1Block += value; else this._p2Block += value;
        this._floatText(snapX, snapY - 20, `+${value} BLK`, '#3498db');
        break;
      }
      case 'pierce': {
        this._cleanBonus += value;
        this._floatText(snapX, snapY - 20, `+${value} BOOST`, '#ff9900');
        break;
      }
      case 'poison': {
        if (owner === 'p1') this._p2Poison += value; else this._p1Poison += value;
        this._floatText(snapX, snapY - 20, `☠ +${value}`, '#44ff88');
        break;
      }
      default:
        break;
    }
  }

  // ─── DAMAGE ───────────────────────────────────────────────────────────────

  _dealDamageTo(target, amount, isChip = false) {
    if (amount <= 0) return;
    const block = target === 'p1' ? this._p1Block : this._p2Block;
    let net = isChip ? amount : Math.max(0, amount - block);
    if (!isChip && block > 0) {
      const absorbed = Math.min(block, amount);
      if (target === 'p1') this._p1Block -= absorbed; else this._p2Block -= absorbed;
      net = Math.max(0, amount - absorbed);
    }
    if (net <= 0) return;

    if (target === 'p1') this._p1Hp = Math.max(0, this._p1Hp - net);
    else                 this._p2Hp = Math.max(0, this._p2Hp - net);
    this._refreshHPBars();
    this._flashHPBar(target, net);
  }

  _flashHPBar(target, amount) {
    const x = target === 'p1' ? this._p1BumperX : this._p2BumperX;
    const y = target === 'p1' ? this._p1BumperY : this._p2BumperY;
    this._floatText(x, y - 30, `-${amount}`, '#e74c3c');
    this._flashBumper(target);
  }

  // ─── ROUND / GAME MANAGEMENT ──────────────────────────────────────────────

  _handleRoundEnd() {
    if (this.phase === 99 || this.phase === 3) return;
    this._clearSurface();
    this._clearMines();

    const p1Dead = this._p1Hp <= 0;
    const p2Dead = this._p2Hp <= 0;

    if (p1Dead || p2Dead) {
      const loser = p1Dead ? 'p1' : 'p2';
      this._handleGameEnd(loser);
      return;
    }

    // Next round — re-run placement
    this._setStatus('');
    this.time.delayedCall(600, () => this._startPlacement());
  }

  _handleGameEnd(loser) {
    this.phase = 3;
    const winner = loser === 'p1' ? 'p2' : 'p1';
    if (winner === 'p1') this._p1Wins++; else this._p2Wins++;

    const matchOver = this._p1Wins >= WINS_NEEDED || this._p2Wins >= WINS_NEEDED;
    this._refreshMatchUI();

    // Winner / loser announcement
    const panel = this.add.container(0, 0).setDepth(80).setAlpha(0);
    panel.add(this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7).setInteractive());

    const winColor = winner === 'p1' ? '#d4a820' : '#e74c3c';
    panel.add(this.add.text(W/2, H/2 - 80, `PLAYER ${winner === 'p1' ? 1 : 2} WINS!`, {
      fontSize: '30px', color: winColor, fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5));

    if (matchOver) {
      panel.add(this.add.text(W/2, H/2 - 30, `MATCH WINNER!`, {
        fontSize: '20px', color: winColor, fontStyle: 'bold', letterSpacing: 3,
      }).setOrigin(0.5));
      panel.add(this.add.text(W/2, H/2 + 20, 'Thanks for playing!', {
        fontSize: '16px', color: '#556677',
      }).setOrigin(0.5));

      const homeBtn = this.add.text(W/2, H/2 + 80, 'PLAY AGAIN', {
        fontSize: '18px', color: '#aaccff', fontStyle: 'bold',
        backgroundColor: '#0d1a2e', padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      homeBtn.on('pointerdown', () => this.scene.start('HomeScene'));
      panel.add(homeBtn);
    } else {
      panel.add(this.add.text(W/2, H/2 - 30, `Player ${loser === 'p1' ? 1 : 2} — Pick an upgrade`, {
        fontSize: '16px', color: '#8899aa',
      }).setOrigin(0.5));
      panel.add(this.add.text(W/2, H/2 + 10, `Pass the device to Player ${loser === 'p1' ? 1 : 2}`, {
        fontSize: '14px', color: '#445566',
      }).setOrigin(0.5));

      const contBtn = this.add.text(W/2, H/2 + 70, 'CONTINUE', {
        fontSize: '18px', color: '#aaccff', fontStyle: 'bold',
        backgroundColor: '#0d1a2e', padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      contBtn.on('pointerdown', () => {
        const loserConfig = loser === 'p1' ? this._p1Config : this._p2Config;
        const nextFirstPlayer = loser; // loser goes first next game
        const returnData = {
          p1Config:     loser === 'p1' ? null : this._p1Config,
          p2Config:     loser === 'p2' ? null : this._p2Config,
          _upgradeOwner: loser,
          p1Hp:        PLAYER_HP,
          p2Hp:        PLAYER_HP,
          p1Wins:      this._p1Wins,
          p2Wins:      this._p2Wins,
          gameNum:     this._gameNum + 1,
          firstPlayer: nextFirstPlayer,
        };
        this.scene.start('UpgradeScene', {
          playerDiceConfig: loserConfig,
          playerHp:         PLAYER_HP,
          playerMaxHp:      PLAYER_HP,
          battleIndex:      0,
          returnScene:      'DiceDuelScene',
          returnData,
        });
      });
      panel.add(contBtn);
    }

    this.tweens.add({ targets: panel, alpha: 1, duration: 400 });
  }

  // ─── VISUAL UTILITIES ─────────────────────────────────────────────────────

  _floatText(x, y, msg, color) {
    const txt = this.add.text(x, y, msg, {
      fontSize: '17px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(95).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, y: y - 14, duration: 180,
      onComplete: () => {
        this.tweens.add({ targets: txt, alpha: 0, y: y - 28, duration: 500, delay: 300,
          onComplete: () => txt.destroy() });
      }
    });
  }

  _laserBeam(x1, y1, x2, y2, color) {
    const g = this.add.graphics().setDepth(60);
    g.lineStyle(2, color, 0.8);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
  }

  _flashBumper(who) {
    const gfx = who === 'p1' ? this._p1BumperGfx : this._p2BumperGfx;
    if (!gfx) return;
    this.tweens.add({ targets: gfx, scaleX: 1.4, scaleY: 1.4, duration: 60, yoyo: true, ease: 'Sine.Out',
      onComplete: () => gfx?.setScale(1) });
  }

  _applyCrackOverlay(dieRef) {
    if (dieRef.crackGfx?.active) return;
    const g = this.add.graphics().setDepth(9);
    g.lineStyle(1.2, 0xffffff, 0.6);
    g.beginPath(); g.moveTo(-1,-2); g.lineTo(-6,-9);  g.lineTo(-13,-14); g.strokePath();
    g.beginPath(); g.moveTo(-6,-9); g.lineTo(-10,-5); g.strokePath();
    g.beginPath(); g.moveTo(-1,-2); g.lineTo(7,2);    g.lineTo(15,1);    g.strokePath();
    g.beginPath(); g.moveTo(-1,-2); g.lineTo(-2,8);   g.lineTo(-6,14);   g.strokePath();
    g.setPosition(dieRef.img?.x ?? 0, dieRef.img?.y ?? 0);
    dieRef.crackGfx = g;
  }

  // ─── BUMPER PHYSICS ───────────────────────────────────────────────────────

  _applyBumperKick(dieBody, bx, by) {
    const dx  = dieBody.position.x - bx;
    const dy  = dieBody.position.y - by;
    const len = Math.hypot(dx, dy) || 1;
    const nvx = dieBody.velocity.x * 0.5 + (dx/len) * BUMPER_KICK;
    const nvy = dieBody.velocity.y * 0.5 + (dy/len) * BUMPER_KICK;
    const spd = Math.hypot(nvx, nvy);
    const cap = Math.min(spd, MAX_THROW_SPEED);
    Phaser.Physics.Matter.Matter.Body.setVelocity(dieBody, { x: (nvx/spd)*cap, y: (nvy/spd)*cap });
  }

  // ─── MINE SYSTEM ──────────────────────────────────────────────────────────

  _spawnMine(x, y) {
    const g    = this.add.circle(x, y, 8, 0x00ccff, 0.25).setDepth(8);
    const body = this.matter.add.circle(x, y, 8, { isStatic: true, label: 'mine', isSensor: true });
    const mine = { x, y, gfx: g, body, blastR: 220, triggered: false, armed: false };
    this._mines.push(mine);
    this.time.delayedCall(500, () => {
      if (mine.triggered) return;
      mine.armed = true;
      this.tweens.add({ targets: g, alpha: 0.85, duration: 180, ease: 'Sine.Out' });
    });
  }

  _triggerMine(mine) {
    mine.gfx?.destroy();
    if (mine.body) { try { this.matter.world.remove(mine.body); } catch(_){} }
    this._floatText(mine.x, mine.y - 24, 'MINE!', '#00ccff');
    this.allDice.forEach(d => {
      if (!d.img?.active || !d.img.body) return;
      const dx   = d.img.x - mine.x;
      const dy   = d.img.y - mine.y;
      const dist = Math.hypot(dx, dy);
      if (dist > mine.blastR) return;
      const nx    = dx / (dist || 1);
      const ny    = dy / (dist || 1);
      const speed = 22 * (1 - dist / mine.blastR);
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, { x: nx*speed, y: ny*speed });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(d.img.body, Phaser.Math.FloatBetween(-0.5, 0.5));
      if (d._rolling) this._rerollDie(d);
    });
  }

  _cleanupMines() { this._mines = this._mines.filter(m => !m.triggered); }
  _clearMines() {
    this._mines.forEach(m => { m.gfx?.destroy(); if (m.body) { try { this.matter.world.remove(m.body); } catch(_){} } });
    this._mines = [];
  }

  _explosionAt(cx, cy, excludeDie = null) {
    const RADIUS = 180, IMPULSE = 0.35;
    this.allDice.forEach(d => {
      if (!d.img?.active || !d.img.body || d === excludeDie) return;
      const dx   = d.img.x - cx;
      const dy   = d.img.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS || dist === 0) return;
      const scale = IMPULSE * (1 - dist / RADIUS);
      Phaser.Physics.Matter.Matter.Body.applyForce(d.img.body, { x: d.img.x, y: d.img.y },
        { x: (dx/dist)*scale, y: (dy/dist)*scale });
      if (d._rolling) this._rerollDie(d);
    });
  }

  _pullDiceToward(cx, cy, excludeDie = null) {
    this.allDice.forEach(d => {
      if (!d.img?.active || !d.img.body || d === excludeDie) return;
      const dx   = cx - d.img.x;
      const dy   = cy - d.img.y;
      const dist = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.applyForce(d.img.body, { x: d.img.x, y: d.img.y },
        { x: (dx/dist)*0.008, y: (dy/dist)*0.008 });
      if (d._rolling) this._rerollDie(d);
    });
  }

  // ─── UPGRADE HELPERS ──────────────────────────────────────────────────────

  _hasDieUpgrade(data, id) {
    return data?.upgradeState?.takenUpgrades?.includes(id) ?? false;
  }

  _getMaterialBonus(data) {
    if (!data?.material) return 0;
    const BONUSES = { rock: 2, iron: 1, cursed: 0, glass: 0 };
    return BONUSES[data.material] ?? 0;
  }

  // ─── BULLETPROOF GLASS & DESTROY CONTACTS ─────────────────────────────────

  _handleBulletproofHit(dieRef) {
    dieRef._contactHits = (dieRef._contactHits ?? 0) + 1;
    if (dieRef._contactHits === 1) {
      dieRef._cracked = true;
      this._applyCrackOverlay(dieRef);
      this._floatText(dieRef.img?.x??0, (dieRef.img?.y??0)-24, 'CRACKED', '#ff6633');
    } else if (dieRef._contactHits >= 3) {
      this._floatText(dieRef.img?.x??0, (dieRef.img?.y??0)-24, 'SHATTER!', '#ff6633');
      this._queueDie(dieRef, true); this._queueDie(dieRef, true); this._queueDie(dieRef, true);
      this._shatterDie(dieRef);
    }
  }

  _tickInfectedContact(dieRef) {
    if (!dieRef?.img?.active || !this.allDice.includes(dieRef)) return;
    if ((dieRef._infectHits ?? 0) === 0) return;
    dieRef._infectHits += 1;
    const threshold = 3; // same for all dice in pvp
    if (dieRef._infectHits >= threshold) {
      this._floatText(dieRef.img?.x??0, (dieRef.img?.y??0)-24, 'SHATTER!', '#ff6633');
      this._queueDie(dieRef, true); this._queueDie(dieRef, true);
      this._shatterDie(dieRef);
    }
  }
}
