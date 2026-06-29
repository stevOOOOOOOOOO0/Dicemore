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
    this._p1Relic   = data.p1Relic   ?? null;
    this._p2Relic   = data.p2Relic   ?? null;
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
    this._p1CleanBonus   = 0;
    this._p2CleanBonus   = 0;
    this._mines          = [];
    this.aimActive       = false;
    this._aimStartX      = 0;
    this._aimStartY      = 0;
    this.aimGfx          = this.add.graphics().setDepth(30);
    this._effectQueue    = [];
    this._queueCards     = [];
    this._queueActive    = false;
    this._onQueueEmpty   = null;
    this._throwLocked    = false;
    this._p1PendingDmg   = 0;
    this._p2PendingDmg   = 0;
    this._p1SelectedIdx  = 0;
    this._p2SelectedIdx  = 0;
    this._currentTurn    = this._firstPlayer;
    this._p1Thrown       = 0;
    this._p2Thrown       = 0;
    this._roundThrown    = 0;
    this._turnBanner     = null;

    this._p1BumperBody   = null;
    this._p2BumperBody   = null;
    this._p1BumperGfx    = null;
    this._p2BumperGfx    = null;
    this._allBumpers     = [];
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
    // HP area occupies the LEFT half of each player strip.
    // Dice tray occupies the RIGHT half (handled in _buildTray).
    const HP_CX  = 90;   // horizontal center of HP area
    const BAR_LX = 10;   // left edge of HP bar
    const BAR_W  = 160;  // bar width

    // ── P2 strip (top, y = 0–80) — all text rotated 180° for P2's perspective ──
    const topY = SURFACE_TOP / 2;
    this.add.text(HP_CX, topY - 14, 'PLAYER 2', {
      fontSize: '11px', color: '#8b1a1a', letterSpacing: 2,
    }).setOrigin(0.5).setAngle(180);
    this._p2HpTxt = this.add.text(HP_CX, topY + 4, `${this._p2Hp} / ${PLAYER_HP}`, {
      fontSize: '16px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5).setAngle(180);
    this._p2HpBarBg = this.add.rectangle(HP_CX, topY + 20, BAR_W, 6, 0x3d0808);
    this._p2HpBarFg = this.add.rectangle(BAR_LX, topY + 20, BAR_W * (this._p2Hp / PLAYER_HP), 6, 0xc0392b).setOrigin(0, 0.5);
    // Rotated 180°: origin is mirrored, so (1,0.5) keeps text right of anchor, (0,0.5) keeps it left
    this._p2PendingTxt = this.add.text(BAR_LX, topY + 4, '', {
      fontSize: '12px', color: '#ff6633', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setAngle(180).setDepth(10);
    this._p2BlockTxt = this.add.text(BAR_LX + BAR_W, topY + 4, '', {
      fontSize: '12px', color: '#4488ff', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setAngle(180).setDepth(10);
    this._p2PoisonLbl = this.add.text(HP_CX - 28, topY + 28, '', {
      fontSize: '10px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5).setAngle(180).setDepth(10);
    this._p2BuffLbl = this.add.text(HP_CX + 28, topY + 28, '', {
      fontSize: '10px', color: '#ff9922', fontStyle: 'bold',
    }).setOrigin(0.5).setAngle(180).setDepth(10);

    // ── P1 strip (bottom, y = 640–700) ──
    const botY = SURFACE_BOTTOM + (H - SURFACE_BOTTOM) / 2;
    this.add.text(HP_CX, botY - 14, 'PLAYER 1', {
      fontSize: '11px', color: '#6b4400', letterSpacing: 2,
    }).setOrigin(0.5);
    this._p1HpTxt = this.add.text(HP_CX, botY + 4, `${this._p1Hp} / ${PLAYER_HP}`, {
      fontSize: '16px', color: '#d4a820', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._p1HpBarBg = this.add.rectangle(HP_CX, botY + 20, BAR_W, 6, 0x3d2a00);
    this._p1HpBarFg = this.add.rectangle(BAR_LX, botY + 20, BAR_W * (this._p1Hp / PLAYER_HP), 6, 0xd4a820).setOrigin(0, 0.5);
    this._p1PendingTxt = this.add.text(BAR_LX, botY + 4, '', {
      fontSize: '12px', color: '#ff6633', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(10);
    this._p1BlockTxt = this.add.text(BAR_LX + BAR_W, botY + 4, '', {
      fontSize: '12px', color: '#4488ff', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(10);
    this._p1PoisonLbl = this.add.text(HP_CX - 28, botY + 28, '', {
      fontSize: '10px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
    this._p1BuffLbl = this.add.text(HP_CX + 28, botY + 28, '', {
      fontSize: '10px', color: '#ff9922', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
  }

  _refreshStatusUI() {
    this._p1PoisonLbl?.setText(this._p1Poison > 0 ? `☠ ${this._p1Poison}` : '');
    this._p1BuffLbl?.setText(this._p1CleanBonus > 0 ? `BUF +${this._p1CleanBonus}` : '');
    this._p2PoisonLbl?.setText(this._p2Poison > 0 ? `☠ ${this._p2Poison}` : '');
    this._p2BuffLbl?.setText(this._p2CleanBonus > 0 ? `BUF +${this._p2CleanBonus}` : '');
  }

  _buildMatchUI() {
    const cx = W / 2;
    this._matchTxt = this.add.text(cx, SURFACE_MID, '', {
      fontSize: '13px', color: '#5a7a8a', fontStyle: 'bold', letterSpacing: 2,
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

  _refreshCombatUI() {
    this._p1PendingTxt?.setText(this._p1PendingDmg > 0 ? `ATK ${this._p1PendingDmg}` : '');
    this._p2PendingTxt?.setText(this._p2PendingDmg > 0 ? `ATK ${this._p2PendingDmg}` : '');
    this._p1BlockTxt?.setText(this._p1Block > 0 ? `BLK ${this._p1Block}` : '');
    this._p2BlockTxt?.setText(this._p2Block > 0 ? `BLK ${this._p2Block}` : '');
  }

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
    const isP1  = who === 'p1';
    const color = isP1 ? '#d4a820' : '#e74c3c';
    const fc    = isP1 ? 0xd4a820 : 0xe74c3c;
    const py    = isP1 ? H - 56 : SURFACE_TOP + 56;

    const banner = this.add.container(0, 0).setDepth(40).setAlpha(0);
    banner.add(this.add.rectangle(W/2, py, W, 36, fc, 0.15));
    const txt = this.add.text(W/2, py, `PLAYER ${isP1?1:2} — PLACE BUMPER`, {
      fontSize: '15px', color, fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5);
    if (!isP1) txt.setAngle(180);
    banner.add(txt);
    this.tweens.add({ targets: banner, alpha: 1, duration: 200 });
    this._updateVignette(who);

    this._activatePlacementDrag(who, () => {
      banner.destroy(true);
      onDone();
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
    const bOpt = { isStatic: true, friction: 0, frictionStatic: 0, restitution: 1.1 };

    const addBumper = (who, x, y, gfx) => {
      const isP1   = who === 'p1';
      const label  = isP1 ? 'p1bumper' : 'p2bumper';
      const cat    = isP1 ? 0x0004 : 0x0008;
      const col    = isP1 ? 0xd4a820 : 0x8b1a1a;
      const txtCol = isP1 ? '#d4a820' : '#e74c3c';

      const body = this.matter.add.circle(x, y, BUMPER_R,
        { ...bOpt, label, collisionFilter: { category: cat, mask: 0xFFFFFFFF } });

      const entry = { body, gfx, x, y, who };
      body._bumperEntry = entry;
      this._allBumpers.push(entry);

      this._drawBumper(gfx, 0, 0, col, 0.85, who.toUpperCase());
      const lbl = this.add.text(x, y, who.toUpperCase(), {
        fontSize: '11px', color: txtCol, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(16);
      if (!isP1) lbl.setAngle(180);

      return body;
    };

    this._p1BumperBody = addBumper('p1', this._p1BumperX, this._p1BumperY, this._p1BumperGfx);
    this._p2BumperBody = addBumper('p2', this._p2BumperX, this._p2BumperY, this._p2BumperGfx);
  }

  // ─── THROW PHASE ──────────────────────────────────────────────────────────

  _startThrowPhase() {
    this.phase = 1;
    this._p1Thrown     = 0;
    this._p2Thrown     = 0;
    this._p1Block      = 0;
    this._p2Block      = 0;
    this._p1Poison     = 0;
    this._p2Poison     = 0;
    this._p1CleanBonus = 0;
    this._p2CleanBonus = 0;
    this._p1PendingDmg = 0;
    this._p2PendingDmg = 0;
    this._refreshCombatUI();
    this._refreshStatusUI();
    this._effectQueue = [];
    this._queueCards.forEach(c => c.container?.destroy());
    this._queueCards  = [];
    this._queueActive = false;
    this._onQueueEmpty = null;
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
    const trayKey = isP1 ? '_p1Tray' : '_p2Tray';
    const ringKey = isP1 ? '_p1SelectRing' : '_p2SelectRing';
    const spacing = 44;
    const startX  = 300 - ((config.length - 1) * spacing) / 2;

    // Destroy items from previous round
    this[trayKey]?.forEach(item => { item.img?.destroy(); item.lbl?.destroy(); });
    this[ringKey]?.destroy();

    this[trayKey] = config.map((dc, i) => {
      const x   = startX + i * spacing;
      const key = isP1 ? 'pdie' : 'edie';
      const img = this.add.image(x, stripY, key).setDepth(5);
      img.setDisplaySize(38, 38);
      const dt  = DIE_TYPES[dc.type];
      const lbl = this.add.text(x, stripY, String(Math.floor(dc.currentFaceIdx/2)+1), {
        fontSize: '15px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(6);
      if (!isP1) lbl.setAngle(180);
      return { img, lbl, configIdx: i, thrown: false };
    });

    // Selection ring — drawn at depth below die image
    this[ringKey] = this.add.graphics().setDepth(4);

    // Default: leftmost die from each player's own perspective
    // P1 left = lowest index; P2 left = highest index (they face the other way)
    const initIdx = isP1 ? 0 : config.length - 1;
    this._setSelectedDie(who, initIdx);
  }

  _setSelectedDie(who, idx) {
    const isP1 = who === 'p1';
    const tray = isP1 ? this._p1Tray : this._p2Tray;
    const ring = isP1 ? this._p1SelectRing : this._p2SelectRing;
    if (!tray?.[idx] || tray[idx].thrown) return;
    if (isP1) this._p1SelectedIdx = idx; else this._p2SelectedIdx = idx;
    ring?.clear();
    if (ring) {
      const col = isP1 ? 0xd4a820 : 0xe74c3c;
      ring.lineStyle(2.5, col, 1);
      ring.strokeCircle(tray[idx].img.x, tray[idx].img.y, 22);
    }
  }

  _autoSelectNextDie(who) {
    const isP1 = who === 'p1';
    const tray = isP1 ? this._p1Tray : this._p2Tray;
    const ring = isP1 ? this._p1SelectRing : this._p2SelectRing;
    if (!tray) return;
    const n     = tray.length;
    const start = isP1 ? 0 : n - 1;
    const step  = isP1 ? 1 : -1;
    for (let i = start; i >= 0 && i < n; i += step) {
      if (!tray[i].thrown) { this._setSelectedDie(who, i); return; }
    }
    ring?.clear();
  }

  // Returns true if the tap landed on an unthrown die in the current player's tray.
  _trySelectTrayDie(ptr) {
    const hitR = 24;
    const who  = this._currentTurn;
    const isP1 = who === 'p1';
    const stripY = isP1 ? H - 20 : SURFACE_TOP - 20;
    if (Math.abs(ptr.y - stripY) > hitR) return false;
    const tray = isP1 ? this._p1Tray : this._p2Tray;
    if (!tray) return false;
    for (let i = 0; i < tray.length; i++) {
      if (!tray[i].thrown && Math.abs(ptr.x - tray[i].img.x) < hitR) {
        this._setSelectedDie(who, i);
        return true;
      }
    }
    return false;
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
    const bannerTxt = this.add.text(W/2, py, `${label}'S TURN`, {
      fontSize: '16px', color, fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5);
    if (!isP1) bannerTxt.setAngle(180);
    banner.add(bannerTxt);

    this.tweens.add({ targets: banner, alpha: 1, duration: 200 });
    this._updateVignette(who);
  }

  _updateVignette(who) {
    // Build both vignettes once, then cross-fade between them
    if (!this._vigP1) {
      this._vigP1 = this._makeVigGfx(0xd4a820).setAlpha(0);
      this._vigP2 = this._makeVigGfx(0xe74c3c).setAlpha(0);
    }
    const [show, hide] = who === 'p1'
      ? [this._vigP1, this._vigP2]
      : [this._vigP2, this._vigP1];
    this.tweens.killTweensOf(show);
    this.tweens.killTweensOf(hide);
    this.tweens.add({ targets: show, alpha: 0.1, duration: 350 });
    this.tweens.add({ targets: hide, alpha: 0, duration: 350 });
  }

  _makeVigGfx(col) {
    const gfx = this.add.graphics().setDepth(3);
    const s   = 0.45;
    const w   = 90;
    gfx.fillGradientStyle(col, col, col, col, s, 0, s, 0); gfx.fillRect(0, 0, w, H);
    gfx.fillGradientStyle(col, col, col, col, 0, s, 0, s); gfx.fillRect(W - w, 0, w, H);
    gfx.fillGradientStyle(col, col, col, col, s, s, 0, 0); gfx.fillRect(0, 0, W, w);
    gfx.fillGradientStyle(col, col, col, col, 0, 0, s, s); gfx.fillRect(0, H - w, W, w);
    return gfx;
  }

  // ─── TURN ADVANCE ─────────────────────────────────────────────────────────

  _advanceTurn() {
    if (this.phase !== 1) return;
    this._throwLocked = false;

    const p1Left = this._p1DiceLeft();
    const p2Left = this._p2DiceLeft();

    if (p1Left === 0 && p2Left === 0) {
      // All dice thrown and queue already drained — end the round
      this._handleRoundEnd();
      return;
    }

    const next     = this._currentTurn === 'p1' ? 'p2' : 'p1';
    const nextLeft = next === 'p1' ? p1Left : p2Left;

    if (nextLeft === 0) {
      // Other player is out — current player throws again
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
      if (this._trySelectTrayDie(ptr)) return; // tray tap — switch selection, don't aim
      this.aimActive  = true;
      this._aimStartX = ptr.x;
      this._aimStartY = ptr.y;
    });

    this.input.on('pointermove', (ptr) => {
      if (!this.aimActive || this.phase !== 1) return;
      const dragDx = ptr.x - this._aimStartX;
      const dragDy = ptr.y - this._aimStartY;
      const ox = this._currentTurn === 'p1' ? this._p1BumperX : this._p2BumperX;
      const oy = this._currentTurn === 'p1' ? this._p1BumperY : this._p2BumperY;
      this.aimGfx.clear();
      this.aimGfx.lineStyle(2, 0xffffff, 0.45);
      this.aimGfx.beginPath();
      this.aimGfx.moveTo(ox, oy);
      this.aimGfx.lineTo(ox - dragDx, oy - dragDy);
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

      const spd = Math.min(MAX_THROW_SPEED, Math.max(7, len * 0.14)) * 0.8;
      const ox  = this._currentTurn === 'p1' ? this._p1BumperX : this._p2BumperX;
      const oy  = this._currentTurn === 'p1' ? this._p1BumperY : this._p2BumperY;
      this._throwNextDie(this._currentTurn, ox, oy, (-dragDx/len)*spd, (-dragDy/len)*spd);
    });
  }

  _throwNextDie(who, ox, oy, vx, vy) {
    const isP1  = who === 'p1';
    const config = isP1 ? this._p1Config : this._p2Config;
    const tray   = isP1 ? this._p1Tray   : this._p2Tray;
    const idx    = isP1 ? this._p1SelectedIdx : this._p2SelectedIdx;

    if (!tray || idx < 0 || idx >= config.length || tray[idx]?.thrown) return;

    const dc  = config[idx];
    const die = this._spawnDie(dc, ox, oy, vx, vy, who);

    // Mark selected tray slot as thrown
    const card = tray[idx];
    if (card) { card.thrown = true; card.img.setAlpha(0.3); card.lbl.setAlpha(0.3); }

    if (isP1) this._p1Thrown++; else this._p2Thrown++;

    // Advance ring to next unthrown die from this player's left
    this._autoSelectNextDie(who);

    this._throwLocked = true;
    die._rolling = true;

    // After the thrown die settles, wait for ALL dice (cascade hits), drain the
    // queue so effects fire now, then advance the turn.
    this._waitForSettle(die, () => {
      if (this.phase !== 1) return;
      this._waitForAllSettle(() => {
        if (this.phase !== 1) return;
        this._onQueueEmpty = () => {
          if (this.phase !== 1) return;
          this._advanceTurn();
        };
        this._processQueue();
      });
    });
  }

  _waitForSettle(dieRef, cb) {
    const check = () => {
      if (!dieRef.img?.active || !dieRef._rolling) { cb(); return; }
      this.time.delayedCall(120, check);
    };
    this.time.delayedCall(400, check);
  }

  _waitForAllSettle(cb) {
    const check = () => {
      const anyRolling = this.allDice.some(d => d._rolling && d.img?.active);
      if (!anyRolling) { cb(); return; }
      this.time.delayedCall(150, check);
    };
    this.time.delayedCall(300, check);
  }

  // ─── DIE SPAWNING ─────────────────────────────────────────────────────────

  _spawnDie(data, x, y, vx, vy, owner) {
    const isP1 = owner === 'p1';
    const key  = isP1 ? 'pdie' : 'edie';
    const lbl  = isP1 ? 'p1die' : 'p2die';

    // Exclude own bumper from collision until die has cleared the launch point
    const startMask = isP1 ? 0xFFFFFFFB : 0xFFFFFFF7; // drops bit 0x0004 (P1) or 0x0008 (P2)
    const img = this.matter.add.image(x, y, key, undefined, {
      isStatic: false, friction: DIE_FRICTION, frictionAir: DIE_FRICTION_AIR,
      restitution: DIE_BOUNCE, label: lbl, density: 0.004,
      shape: { type: 'circle', radius: DIE_SIZE/2 - 2 },
      collisionFilter: { mask: startMask },
    });
    img.setVelocity(vx, vy);
    this.time.delayedCall(500, () => {
      if (img?.active && img.body) img.body.collisionFilter.mask = 0xFFFFFFFF;
    });

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
    if (!isP1) { valTxt.setAngle(180); lblTxt.setAngle(180); }

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
        d.data.currentFaceIdx = roll;
        const dt     = DIE_TYPES[d.data.type];
        const faceNo = Math.floor(roll / 2) + 1;
        d.valTxt?.setText(String(faceNo));
        d.valTxt?.setColor(dt?.color ?? '#ffffff');
        d.lblTxt?.setText(dt?.label?.slice(0,3).toUpperCase() ?? '');
        d.lblTxt?.setColor(dt?.color ?? '#aaaaaa');
        d._rolling = false;
        // Queue every time a die settles — hit dice retrigger with new face
        if (this.phase === 1) this._queueDie(d);
      }
    });
  }

  // No _rolling guard — settled dice that get physically hit will roll again and retrigger
  _rerollDie(dieRef) {
    if (!dieRef.img?.active) return;
    dieRef._hadCollision = false; // reset so each roll is judged independently for Steady Hand
    const sides  = dieRef.data.sides ?? 6;
    const roll   = Phaser.Math.Between(0, sides - 1);
    dieRef.data.currentFaceIdx = roll;
    dieRef._rolling = true;
    const dt     = DIE_TYPES[dieRef.data.type];
    dieRef.valTxt?.setText(String(Math.floor(roll / 2) + 1));
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
          // Use the actual hit bumper's position (not the latest stored one)
          const entry = other._bumperEntry;
          const bx = entry?.x ?? other.position?.x ?? this._p1BumperX;
          const by = entry?.y ?? other.position?.y ?? this._p1BumperY;
          this._applyBumperKick(dieBody, bx, by);
          if (!rerolled.has(dieRef)) { rerolled.add(dieRef); this._rerollDie(dieRef); }
          this._flashGfx(entry?.gfx);

          if (isOppBumper) {
            const target = dieRef.mpOwner === 'p1' ? 'p2' : 'p1';
            let chip = 1 + (this._hasDieUpgrade(dieRef.data, 'bumper') ? 1 : 0);
            if (this._hasRelic(dieRef.mpOwner, 'spiked_bumper')) {
              const spike = Math.floor((dieRef.data.sides ?? 6) / 2);
              chip += spike;
              this._floatText(bx, by - 40, `SPIKE +${spike}`, '#e74c3c');
            }
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

  // ─── QUEUE DRAIN ──────────────────────────────────────────────────────────

  _processQueue() {
    if (this.phase === 99) return;
    if (this._effectQueue.length === 0) {
      const cb = this._onQueueEmpty;
      this._onQueueEmpty = null;
      if (cb) this.time.delayedCall(300, cb);
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
    const rawFace   = Math.floor(data.currentFaceIdx / 2) + 1;
    let value = rawFace;
    if (dieRef._cracked)    { value = Math.ceil(value / 2); dieRef._cracked = false; }
    if (dieRef._valueBonus) { value += dieRef._valueBonus;  dieRef._valueBonus = 0;  }
    value = Math.max(0, value);

    // Finisher bonus
    if (this._hasDieUpgrade(data, 'finisher')) {
      const myDice = owner === 'p1' ? this._p1Config : this._p2Config;
      value += myDice.length - 1;
    }

    // Relic: Steady Hand — no wall or bumper hit grants +4 to effect
    if (!dieRef._hadCollision && this._hasRelic(owner, 'steady_hand')) {
      value += 4;
      this._floatText(snapX, snapY - 34, 'STEADY +4', '#f0c040');
    }

    // Relic: Lucky Coin — rolled max face means effect fires twice (×2 value)
    if (rawFace === Math.floor(data.sides / 2) && this._hasRelic(owner, 'lucky_coin')) {
      value *= 2;
      this._floatText(snapX, snapY - 34, 'LUCKY ×2', '#f0c040');
    }

    // Poison upgrade redirects all damage to stacks
    if (this._hasDieUpgrade(data, 'poison')) {
      if (owner === 'p1') this._p2Poison += value;
      else                this._p1Poison += value;
      this._floatText(snapX, snapY - 20, `☠ +${value}`, '#44ff88');
      this._refreshStatusUI();
      return;
    }

    switch (data.type) {
      case 'attack': {
        const buf = owner === 'p1' ? this._p1CleanBonus : this._p2CleanBonus;
        let dmg = value + buf;
        if (this._hasDieUpgrade(data, 'status_damage')) dmg += 5;
        dmg = Math.max(0, dmg);
        if (owner === 'p1') this._p1PendingDmg += dmg;
        else                this._p2PendingDmg += dmg;
        this._floatText(snapX, snapY - 20, `+${dmg} ATK`, '#ff6633');
        this._refreshCombatUI();
        break;
      }
      case 'block': {
        const buf = owner === 'p1' ? this._p1CleanBonus : this._p2CleanBonus;
        const blk = value + buf;
        if (owner === 'p1') this._p1Block += blk; else this._p2Block += blk;
        this._floatText(snapX, snapY - 20, `+${blk} BLK`, '#4488ff');
        this._refreshCombatUI();
        break;
      }
      case 'pierce': {
        if (owner === 'p1') this._p1CleanBonus += value;
        else                this._p2CleanBonus += value;
        this._floatText(snapX, snapY - 20, `+${value} BOOST`, '#ff9900');
        this._refreshStatusUI();
        break;
      }
      case 'poison': {
        let stacks = value;
        // Relic: Pickpocket's Thumb — +1 extra poison stack whenever a poison die settles
        if (this._hasRelic(owner, 'pickpockets_thumb')) stacks += 1;
        if (owner === 'p1') this._p2Poison += stacks; else this._p1Poison += stacks;
        this._floatText(snapX, snapY - 20, `☠ +${stacks}`, '#44ff88');
        this._refreshStatusUI();
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

    // Mid-round KO — end the game immediately without waiting for round end
    if (this.phase === 1 && (this._p1Hp <= 0 || this._p2Hp <= 0)) {
      const loser = this._p1Hp <= 0 ? 'p1' : 'p2';
      this.time.delayedCall(500, () => this._handleGameEnd(loser));
    }
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
    this.phase = 2;
    if (this._turnBanner) { this._turnBanner.destroy(true); this._turnBanner = null; }
    this._clearSurface();
    this._clearMines();

    this._animateDamageSequence(() => {
      // Apply end-of-round poison
      if (this._p1Poison > 0) {
        const dmg = this._p1Poison;
        this._p1Hp = Math.max(0, this._p1Hp - dmg);
        this._floatText(90, SURFACE_BOTTOM + (H - SURFACE_BOTTOM) / 2, `☠ -${dmg}`, '#44ff88');
        this._p1Poison = Math.max(0, this._p1Poison - 1);
        this._refreshHPBars();
        this._refreshStatusUI();
      }
      if (this._p2Poison > 0) {
        const dmg = this._p2Poison;
        this._p2Hp = Math.max(0, this._p2Hp - dmg);
        this._floatText(90, SURFACE_TOP / 2, `☠ -${dmg}`, '#44ff88');
        this._p2Poison = Math.max(0, this._p2Poison - 1);
        this._refreshHPBars();
        this._refreshStatusUI();
      }

      const p1Dead = this._p1Hp <= 0;
      const p2Dead = this._p2Hp <= 0;

      if (p1Dead || p2Dead) {
        const loser = p1Dead ? 'p1' : 'p2';
        this._handleGameEnd(loser);
        return;
      }

      this._setStatus('');
      this.time.delayedCall(600, () => this._startPlacement());
    });
  }

  // ─── DAMAGE ANIMATION SEQUENCE ────────────────────────────────────────────

  _animateDamageSequence(cb) {
    // Snapshot values before animation mutates them
    const p1Atk = this._p1PendingDmg;
    const p2Atk = this._p2PendingDmg;
    const p2Blk = this._p2Block;
    const p1Blk = this._p1Block;

    // Strip centres for the HP area (left side, x = 90)
    const HP_X  = 90;
    const P1_Y  = SURFACE_BOTTOM + (H - SURFACE_BOTTOM) / 2; // ≈ 670
    const P2_Y  = SURFACE_TOP / 2;                            // ≈ 40

    const doP1Attack = (next) => {
      if (p1Atk <= 0) { next(); return; }
      const net = Math.max(0, p1Atk - p2Blk);
      this._flyDamage(HP_X, P1_Y, HP_X, P2_Y, p1Atk, () => {
        // Apply damage at the moment of impact
        const absorbed = Math.min(p2Blk, p1Atk);
        this._p2Block = Math.max(0, p2Blk - absorbed);
        this._p2Hp    = Math.max(0, this._p2Hp - net);
        this._p1PendingDmg = 0;
        this._refreshHPBars();
        this._showImpact(HP_X, P2_Y, p1Atk, p2Blk, 180, () => {
          this._refreshCombatUI();
          this.time.delayedCall(400, next);
        });
      });
    };

    const doP2Attack = (next) => {
      if (p2Atk <= 0) { next(); return; }
      const net = Math.max(0, p2Atk - p1Blk);
      this._flyDamage(HP_X, P2_Y, HP_X, P1_Y, p2Atk, () => {
        const absorbed = Math.min(p1Blk, p2Atk);
        this._p1Block = Math.max(0, p1Blk - absorbed);
        this._p1Hp    = Math.max(0, this._p1Hp - net);
        this._p2PendingDmg = 0;
        this._refreshHPBars();
        this._showImpact(HP_X, P1_Y, p2Atk, p1Blk, 0, () => {
          this._refreshCombatUI();
          this.time.delayedCall(400, next);
        });
      });
    };

    const finish = () => {
      this._p1Block = 0;
      this._p2Block = 0;
      this._p1PendingDmg = 0;
      this._p2PendingDmg = 0;
      this._refreshCombatUI();
      this.time.delayedCall(300, cb);
    };

    if (p1Atk === 0 && p2Atk === 0) { finish(); return; }

    doP1Attack(() => this.time.delayedCall(200, () => doP2Attack(finish)));
  }

  // Sends a large damage number flying from (sx,sy) to (ex,ey), calls cb on arrival.
  _flyDamage(sx, sy, ex, ey, damage, cb) {
    const txt = this.add.text(sx, sy, String(damage), {
      fontSize: '38px', color: '#ff6622', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(95).setAlpha(0).setScale(0.6);

    this.tweens.add({
      targets: txt, alpha: 1, scaleX: 1, scaleY: 1, duration: 180,
      onComplete: () => {
        this.tweens.add({
          targets: txt, x: ex, y: ey, duration: 480, ease: 'Sine.InOut',
          onComplete: () => { txt.destroy(); cb(); },
        });
      },
    });
  }

  // Shows the block/shatter/hit result at (cx,cy) for a defender.
  // textAngle: 0 for P1 (bottom), 180 for P2 (top, so they can read it).
  _showImpact(cx, cy, damage, block, textAngle, cb) {
    const net     = Math.max(0, damage - block);
    const driftY  = textAngle === 0 ? -28 : 28; // drift toward play area from each player's view

    // Shockwave ring at impact point
    const ring = this.add.graphics().setDepth(94);
    ring.lineStyle(4, 0xff6622, 1);
    ring.strokeCircle(cx, cy, 8);
    this.tweens.add({ targets: ring, scaleX: 7, scaleY: 7, alpha: 0, duration: 380,
      onComplete: () => ring.destroy() });

    const makeText = (str, color, size = 20) =>
      this.add.text(cx, cy, str, {
        fontSize: `${size}px`, color, fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(96).setAngle(textAngle);

    const floatOut = (obj, delay, onDone) =>
      this.time.delayedCall(delay, () =>
        this.tweens.add({ targets: obj, y: cy + driftY, alpha: 0, duration: 480,
          onComplete: () => { obj.destroy(); onDone(); } }));

    if (block > 0 && net === 0) {
      // ── Fully blocked ──
      const shield = makeText('BLOCKED!', '#4488ff', 22);
      floatOut(shield, 80, cb);

    } else if (block > 0 && net > 0) {
      // ── Block shatters, residual damage gets through ──
      const shatter = makeText(`BLK SHATTERED  -${block}`, '#4488ff', 16);
      floatOut(shatter, 60, () => {
        const hit = makeText(`-${net}`, '#ff2222', 28);
        this._flashBumper(textAngle === 0 ? 'p1' : 'p2');
        floatOut(hit, 80, cb);
      });

    } else {
      // ── No block — direct hit ──
      const hit = makeText(`-${damage}`, '#ff2222', 28);
      this._flashBumper(textAngle === 0 ? 'p1' : 'p2');
      floatOut(hit, 80, cb);
    }
  }

  _handleGameEnd(loser) {
    if (this.phase === 3) return;
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
        fontSize: '14px', color: '#6a8a9a',
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
          p1Relic:     this._p1Relic,
          p2Relic:     this._p2Relic,
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

  _flashGfx(gfx) {
    if (!gfx) return;
    this.tweens.add({ targets: gfx, scaleX: 1.4, scaleY: 1.4, duration: 60, yoyo: true, ease: 'Sine.Out',
      onComplete: () => gfx?.setScale(1) });
  }

  // Flashes the latest-placed bumper gfx for a given player (used by damage animations).
  _flashBumper(who) {
    this._flashGfx(who === 'p1' ? this._p1BumperGfx : this._p2BumperGfx);
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

  _hasRelic(who, id) {
    return (who === 'p1' ? this._p1Relic : this._p2Relic) === id;
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
