import Phaser from 'phaser';
import { FACES, ENEMIES, BATTLE_SEQUENCE } from '../data/faces.js';
import { DIE_TYPES, STARTER_DICE } from '../data/dice.js';
import { RUNES, MATERIALS } from '../data/runes.js';
import {
  W, H, SURFACE_TOP, SURFACE_BOTTOM, DIE_SIZE, WALL_T, DIE_STRIP_Y,
  DIE_FRICTION, DIE_FRICTION_AIR, DIE_BOUNCE, SETTLE_VEL,
  MAX_THROW_SPEED, PLAYER_MAX_HP
} from '../constants.js';
import RelicManager from '../systems/RelicManager.js';

const PHASE = { PREP: 0, ENEMY_ROLL: 1, PLAYER_ROLL: 2, COMMIT: 3 };

const INTENT = {
  attack:     { label: 'ATK', color: '#e74c3c' },
  block:      { label: 'BLK', color: '#3498db' },
  strength:   { label: 'STR', color: '#e67e22' },
  vulnerable: { label: 'VLN', color: '#bb44cc' },
  frail:      { label: 'FRL', color: '#1abc9c' },
};
const THROW_ZONE_BOTTOM  = SURFACE_BOTTOM - 8;
const THROW_ORIGIN_X     = W / 2;
const THROW_ORIGIN_Y     = 545;
const ENEMY_BUMPER_R     = 26;
const PLAYER_BUMPER_R    = 22;
const BUMPER_KICK_SPEED  = 9;
const MIN_REROLL_VEL     = 1.5; // relative closing speed below this → die doesn't actually tumble

const QUEUE_CARD_H   = 72;
const QUEUE_CARD_GAP = 8;
const QUEUE_START_Y  = SURFACE_TOP + 40;
const QUEUE_CARD_X   = 33;

export default class BattleScene extends Phaser.Scene {
  constructor() { super({ key: 'BattleScene' }); }

  init(data) {
    this.playerDiceConfig = data.playerDiceConfig
      ? JSON.parse(JSON.stringify(data.playerDiceConfig))
      : JSON.parse(JSON.stringify(STARTER_DICE));
    this.battleIndex  = data.battleIndex  ?? 0;
    this.playerHp     = data.playerHp     ?? PLAYER_MAX_HP;
    this.playerMaxHp  = data.playerMaxHp  ?? PLAYER_MAX_HP;
    this.activeRelics = data.activeRelics ?? [];
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  create() {
    this.phase           = PHASE.PREP;
    this.allDice         = [];
    this.playerDice      = [];
    this.enemyDice       = [];
    this.block           = 0;
    this.aimActive       = false;
    this._aimStartX      = 0;
    this._aimStartY      = 0;
    this._suppressThrow  = false;
    this.aimGfx          = this.add.graphics().setDepth(30);
    this.inspectorPanel  = null;
    this._autoCommitDone = false;
    this._settleChecker  = null;

    this._effectQueue = [];
    this._queueCards  = [];
    this._queueActive = false;
    this._throwLocked = false;

    this.poisonStacks        = 0;
    this.enemyStrength       = 0;
    this.vulnerable          = 0;
    this.enemyPoisonStacks   = 0;
    this.enemyWeakened       = false;
    this.enemyVulnerable     = false;
    this.playerFrail         = 0;
    this.enemyBlock          = 0;
    this._lastIntentWasPassive = false;
    this.currentIntent       = null;
    this._intentPopup        = null;
    this._relicPopup         = null;

    this.trayCards          = [];
    this.throwCount         = 0;
    this._dragCard    = null;
    this._dragOffsetX = 0;
    this._dragMoved   = false;

    this.enemyPos           = { x: W / 2, y: 270 };
    this.enemyPhysicsBody   = null;
    this.enemyCharContainer = null;
    this._enemyHpBarGfx     = null;
    this._enemyHpTxt        = null;
    this.playerGfx          = null;
    this.playerPhysicsBody  = null;
    this._playerPillsCont   = null;
    this._playerStatusPopup = null;

    const key = BATTLE_SEQUENCE[this.battleIndex % BATTLE_SEQUENCE.length];
    this.enemyDef = ENEMIES[key];
    this.enemyHp  = this.enemyDef.hp;

    this.relicManager = new RelicManager(this);
    this.activeRelics.forEach(r => this.relicManager.addRelic(r));

    this._makeTextures();
    this._buildBackground();
    this._buildWalls();
    this._buildHeaderStrip();
    this._buildRelicStrip();
    this._buildEnemyCharacter();
    this._buildPlayerCharacter();
    this._buildDieStrip();
    this._buildCommitOverlay();
    this._setupCollisions();
    this._setupPointer();

    this.time.delayedCall(400, () => this._startTurn());
  }

  // ─── TEXTURES ─────────────────────────────────────────────────────────────

  _makeTextures() {
    const make = (key, fill, stroke, sz) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(fill);
      g.fillRoundedRect(1, 1, sz - 2, sz - 2, 6);
      g.lineStyle(2, stroke);
      g.strokeRoundedRect(1, 1, sz - 2, sz - 2, 6);
      g.generateTexture(key, sz, sz);
      g.destroy();
    };
    make('pdie',  0xd4a820, 0x6b4400, DIE_SIZE);
    make('edie',  0x8b1a1a, 0x3d0808, DIE_SIZE);
    make('tcard', 0x1e1e38, 0x3a3a60, 38);
  }

  // ─── LAYOUT ───────────────────────────────────────────────────────────────

  _buildBackground() {
    this.add.rectangle(W / 2, SURFACE_TOP / 2, W, SURFACE_TOP, 0x0e2a42);
    this.add.rectangle(W / 2, SURFACE_TOP - 1, W, 2, 0x1a4a7a);
    this.add.rectangle(W / 2, (SURFACE_TOP + SURFACE_BOTTOM) / 2,
      W, SURFACE_BOTTOM - SURFACE_TOP, 0x13192e);
    const g = this.add.graphics();
    g.lineStyle(1, 0x1f2d50);
    g.strokeRect(0, SURFACE_TOP, W, SURFACE_BOTTOM - SURFACE_TOP);
  }

  _buildWalls() {
    const opt = { isStatic: true, label: 'wall', friction: 0, frictionStatic: 0, restitution: 0.925 };
    const cy  = (SURFACE_TOP + SURFACE_BOTTOM) / 2;
    const sh  = SURFACE_BOTTOM - SURFACE_TOP + WALL_T * 2;
    this.matter.add.rectangle(-WALL_T / 2,    cy, WALL_T, sh, opt);
    this.matter.add.rectangle(W + WALL_T / 2, cy, WALL_T, sh, opt);
    this.matter.add.rectangle(W / 2, SURFACE_TOP    - WALL_T / 2, W + WALL_T * 2, WALL_T, opt);
    this.matter.add.rectangle(W / 2, SURFACE_BOTTOM + WALL_T / 2, W + WALL_T * 2, WALL_T, opt);
  }

  _buildHeaderStrip() {
    const mid = SURFACE_TOP / 2;
    this.phaseTxt     = this.add.text(W / 2, mid - 16, '', { fontSize: '17px', color: '#556677', letterSpacing: 2 }).setOrigin(0.5, 0.5);
    this.battleMsgTxt = this.add.text(W / 2, mid + 16, '', { fontSize: '17px', color: '#ffffff', wordWrap: { width: W - 60 } }).setOrigin(0.5, 0.5);
    this._refreshStatusUI();
  }

  _buildRelicStrip() {
    if (!this.activeRelics?.length) return;
    const r = 7, gap = 4;
    this.activeRelics.forEach((relic, i) => {
      const x  = 10 + i * (r * 2 + gap) + r;
      const fc = parseInt((relic.color ?? '#ffffff').replace('#', ''), 16);
      const circle = this.add.circle(x, 70, r, fc, 0.85).setDepth(22).setInteractive();
      this.add.text(x, 70, relic.name[0].toUpperCase(), {
        fontSize: '8px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(23);
      circle.on('pointerdown', () => this._showRelicPopup(relic));
    });
  }

  _showRelicPopup(relic) {
    if (this._relicPopup) { this._relicPopup.destroy(); this._relicPopup = null; }

    const RARITY_COLOR = { common: 0x556677, uncommon: 0x2471a3, rare: 0x6c3483, boss: 0x922b21 };
    const rarCol = RARITY_COLOR[relic.rarity] ?? RARITY_COLOR.common;
    const fc     = parseInt((relic.color ?? '#ffffff').replace('#', ''), 16);

    const panelW = W - 40, panelH = 110;
    const panelX = W / 2, panelY = 155;

    const pop = this._relicPopup = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4).setInteractive();
    dim.on('pointerdown', () => { this._relicPopup?.destroy(); this._relicPopup = null; });
    pop.add(dim);

    pop.add(this.add.rectangle(panelX, panelY, panelW, panelH, 0x0d0d1c)
      .setStrokeStyle(2, rarCol, 0.9));

    const dotX = panelX - panelW / 2 + 22;
    pop.add(this.add.circle(dotX, panelY - 18, 10, fc, 0.9));
    pop.add(this.add.text(dotX, panelY - 18, relic.name[0].toUpperCase(), {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    pop.add(this.add.text(dotX + 18, panelY - 20, relic.name, {
      fontSize: '16px', color: relic.color, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    pop.add(this.add.text(dotX + 18, panelY - 3, relic.rarity.toUpperCase(), {
      fontSize: '10px', color: '#334455', letterSpacing: 1,
    }).setOrigin(0, 0.5));
    pop.add(this.add.text(panelX - panelW / 2 + 14, panelY + 18, relic.description, {
      fontSize: '13px', color: '#8899aa', wordWrap: { width: panelW - 28 },
    }).setOrigin(0, 0.5));
  }

  // ─── ENEMY CHARACTER (bumper) ─────────────────────────────────────────────

  _buildEnemyCharacter() {
    const col = parseInt(this.enemyDef.color.replace('#', ''), 16);
    const { x, y } = this.enemyPos;
    const R = ENEMY_BUMPER_R;

    this.enemyCharContainer = this.add.container(x, y).setDepth(15);

    // Outer glow ring
    const glow = this.add.graphics();
    glow.lineStyle(4, col, 0.3);
    glow.strokeCircle(0, 0, R + 10);
    this.enemyCharContainer.add(glow);

    // Dark base circle
    const bg = this.add.graphics();
    bg.fillStyle(0x080814, 0.92);
    bg.fillCircle(0, 0, R);
    this.enemyCharContainer.add(bg);

    // HP fill — circular segment drawn from the bottom up (rebuilt in _refreshEnemyCharacter)
    this._enemyHpFillGfx = this.add.graphics();
    this.enemyCharContainer.add(this._enemyHpFillGfx);

    // Circle ring outline on top of fill
    const ring = this.add.graphics();
    ring.lineStyle(2, col, 0.9);
    ring.strokeCircle(0, 0, R);
    this.enemyCharContainer.add(ring);

    // Intent text inside circle
    this._intentTxt = this.add.text(0, -3, '', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(this._intentTxt);

    // Enemy name above circle
    const nameTxt = this.add.text(0, -R - 16, this.enemyDef.name.toUpperCase(), {
      fontSize: '17px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(nameTxt);

    // Tap zone
    const tapZone = this.add.rectangle(0, 0, (R + 24) * 2, (R + 48) * 2, 0xffffff, 0).setInteractive();
    tapZone.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._toggleIntentPopup(); });
    this.enemyCharContainer.add(tapZone);

    // HP number below circle
    this._enemyHpTxt = this.add.text(0, R + 10, '', {
      fontSize: '13px', color: '#dd9999'
    }).setOrigin(0.5, 0);
    this.enemyCharContainer.add(this._enemyHpTxt);

    // Block shield
    this._blockShieldGfx = this.add.graphics();
    this.enemyCharContainer.add(this._blockShieldGfx);
    this._blockShieldTxt = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(this._blockShieldTxt);

    this._enemyStrTxt = this.add.text(0, R + 28, '', {
      fontSize: '13px', color: '#e67e22', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.enemyCharContainer.add(this._enemyStrTxt);

    this._enemyPsnTxt = this.add.text(0, R + 44, '', {
      fontSize: '13px', color: '#58d68d', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.enemyCharContainer.add(this._enemyPsnTxt);

    this.tweens.add({ targets: glow, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1 });

    this._refreshEnemyCharacter();
    this._createEnemyPhysicsBody();
  }

  _createEnemyPhysicsBody() {
    if (this.enemyPhysicsBody) {
      this.matter.world.remove(this.enemyPhysicsBody);
    }
    this.enemyPhysicsBody = this.matter.add.circle(
      this.enemyPos.x, this.enemyPos.y, ENEMY_BUMPER_R,
      { isStatic: true, label: 'enemyBumper', restitution: 0.9, friction: 0,
        collisionFilter: { category: 0x0004, mask: 0xFFFFFFFF } }
    );
  }

  _moveEnemyToNewPosition(onComplete) {
    if (this.enemyPhysicsBody) {
      this.matter.world.remove(this.enemyPhysicsBody);
      this.enemyPhysicsBody = null;
    }

    const newPos = {
      x: Phaser.Math.Between(70, 330),
      y: Phaser.Math.Between(200, 390),
    };

    this.tweens.add({
      targets: this.enemyCharContainer,
      x: newPos.x, y: newPos.y,
      duration: 550, ease: 'Sine.InOut',
      onComplete: () => {
        this.enemyPos = newPos;
        this._createEnemyPhysicsBody();
        if (onComplete) onComplete();
      }
    });
  }

  _refreshEnemyCharacter() {
    const maxHp = this.enemyDef?.hp || 1;
    const pct   = Math.max(0, Math.min(1, this.enemyHp / maxHp));
    const R     = ENEMY_BUMPER_R;
    const col   = parseInt(this.enemyDef.color.replace('#', ''), 16);

    this._enemyHpTxt?.setText(`${Math.max(0, this.enemyHp)} / ${maxHp}`);

    // Circular HP fill — floods from the bottom up proportional to remaining HP
    this._enemyHpFillGfx?.clear();
    if (pct > 0 && this._enemyHpFillGfx) {
      this._enemyHpFillGfx.fillStyle(col, 0.6);
      if (pct >= 1) {
        this._enemyHpFillGfx.fillCircle(0, 0, R);
      } else {
        // chord_y: y of the horizontal dividing line (-R = top, +R = bottom)
        const chord_y  = R * (1 - 2 * pct);
        const chord_hw = Math.sqrt(R * R - chord_y * chord_y);
        this._enemyHpFillGfx.beginPath();
        this._enemyHpFillGfx.moveTo(-chord_hw, chord_y);
        this._enemyHpFillGfx.lineTo(chord_hw, chord_y);
        // Arc clockwise from right intersection through the bottom to left intersection
        this._enemyHpFillGfx.arc(0, 0, R,
          Math.atan2(chord_y, chord_hw),
          Math.atan2(chord_y, -chord_hw),
          false);
        this._enemyHpFillGfx.closePath();
        this._enemyHpFillGfx.fillPath();
      }
    }

    this._enemyStrTxt?.setText(this.enemyStrength > 0 ? `STR +${this.enemyStrength}` : '');
    this._enemyPsnTxt?.setText(this.enemyPoisonStacks > 0 ? `☠ ${this.enemyPoisonStacks}` : '');
    this._refreshIntentDisplay();
    this._refreshBlockShield();
  }

  _refreshBlockShield() {
    if (!this._blockShieldGfx) return;
    this._blockShieldGfx.clear();
    this._blockShieldTxt?.setText('');
    if (!(this.enemyBlock > 0)) return;

    const cx = -46, cy = ENEMY_BUMPER_R + 20;
    const w = 10, h = 13;

    this._blockShieldGfx.fillStyle(0x1a5276, 0.95);
    this._blockShieldGfx.lineStyle(1.5, 0x5dade2, 1);
    this._blockShieldGfx.beginPath();
    this._blockShieldGfx.moveTo(cx - w, cy - h);
    this._blockShieldGfx.lineTo(cx + w, cy - h);
    this._blockShieldGfx.lineTo(cx + w, cy + h * 0.15);
    this._blockShieldGfx.lineTo(cx,     cy + h);
    this._blockShieldGfx.lineTo(cx - w, cy + h * 0.15);
    this._blockShieldGfx.closePath();
    this._blockShieldGfx.fillPath();
    this._blockShieldGfx.strokePath();

    this._blockShieldTxt?.setPosition(cx, cy - 1).setText(String(this.enemyBlock));
  }

  // ─── INTENT SYSTEM ────────────────────────────────────────────────────────

  _isPurelyPassive(intent) {
    const PASSIVE = new Set(['block', 'strength', 'vulnerable', 'frail']);
    if (intent.type === 'multi') return intent.intents.every(i => PASSIVE.has(i.type));
    return PASSIVE.has(intent.type);
  }

  _drawIntent() {
    const pool = this.enemyDef.intents;
    let candidates = this._lastIntentWasPassive
      ? pool.filter(e => !this._isPurelyPassive(e)).map(e => {
          const aggressive = e.type === 'attack' ||
            (e.type === 'multi' && e.intents?.some(i => i.type === 'attack'));
          return { ...e, weight: aggressive ? e.weight * 2 : e.weight };
        })
      : pool;
    if (!candidates.length) candidates = pool;
    const total = candidates.reduce((s, e) => s + e.weight, 0);
    let r = Phaser.Math.FloatBetween(0, total);
    for (const e of candidates) {
      r -= e.weight;
      if (r <= 0) { this._lastIntentWasPassive = this._isPurelyPassive(e); return e; }
    }
    const last = candidates[candidates.length - 1];
    this._lastIntentWasPassive = this._isPurelyPassive(last);
    return last;
  }

  _refreshIntentDisplay() {
    if (!this._intentTxt) return;
    if (!this.currentIntent) { this._intentTxt.setText(''); return; }
    const intent = this.currentIntent;
    if (intent.type === 'multi') {
      const parts = intent.intents.map(sub => {
        const cfg = INTENT[sub.type];
        return cfg ? cfg.label : sub.type.toUpperCase();
      });
      this._intentTxt.setText(parts.join('\n'));
      this._intentTxt.setColor('#ffffff');
    } else {
      const cfg = INTENT[intent.type];
      if (cfg) {
        let label = cfg.label;
        if (intent.type === 'attack') {
          label = `ATK ${intent.value + (this.enemyStrength ?? 0)}`;
        } else if (intent.type === 'block') {
          label = `BLK ${intent.value}`;
        } else if (intent.value !== undefined) {
          label = `${cfg.label} +${intent.value}`;
        }
        this._intentTxt.setText(label);
        this._intentTxt.setColor(cfg.color);
      } else {
        this._intentTxt.setText(intent.type.toUpperCase());
        this._intentTxt.setColor('#ffffff');
      }
    }
  }

  _toggleIntentPopup() {
    if (this._intentPopup) this._hideIntentPopup();
    else this._showIntentPopup();
  }

  _showIntentPopup() {
    if (this._intentPopup || !this.currentIntent) return;

    this._intentPopup = this.add.container(W / 2, H / 2).setDepth(75);

    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setInteractive();
    dim.on('pointerdown', () => this._hideIntentPopup());
    this._intentPopup.add(dim);

    const lines = this._describeIntent(this.currentIntent);
    const strBonus = this.enemyStrength > 0;
    const panelH = 44 + lines.length * 22 + (strBonus ? 22 : 0) + 16;
    const panelW = 280;

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0d0d1e, 0.97);
    bg.setStrokeStyle(1.5, parseInt(this.enemyDef.color.replace('#', ''), 16), 0.7).setInteractive();
    bg.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._hideIntentPopup(); });
    this._intentPopup.add(bg);

    this._intentPopup.add(
      this.add.text(0, -panelH / 2 + 20, this.enemyDef.name.toUpperCase(), {
        fontSize: '14px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 2,
      }).setOrigin(0.5, 0.5)
    );

    lines.forEach((line, i) => {
      this._intentPopup.add(
        this.add.text(0, -panelH / 2 + 44 + i * 22, line.text, {
          fontSize: '13px', color: line.color ?? '#cccccc',
        }).setOrigin(0.5, 0.5)
      );
    });

    if (strBonus) {
      this._intentPopup.add(
        this.add.text(0, panelH / 2 - 16, `STR +${this.enemyStrength} added to attacks`, {
          fontSize: '11px', color: '#e67e22',
        }).setOrigin(0.5, 0.5)
      );
    }
  }

  _hideIntentPopup() {
    if (this._intentPopup) { this._intentPopup.destroy(true); this._intentPopup = null; }
  }

  _describeIntent(intent) {
    if (intent.type === 'multi') {
      return intent.intents.flatMap(sub => this._describeSingleIntent(sub));
    }
    return this._describeSingleIntent(intent);
  }

  _describeSingleIntent(sub) {
    switch (sub.type) {
      case 'attack': {
        const total = sub.value + (this.enemyStrength ?? 0);
        return [{ text: `Attack  ${total} damage`, color: '#e74c3c' }];
      }
      case 'block':
        return [{ text: `Block  ${sub.value} damage`, color: '#3498db' }];
      case 'strength':
        return [{ text: `Gain +${sub.value} Strength`, color: '#e67e22' }];
      case 'vulnerable':
        return [{ text: `Vulnerable  (+50% damage taken)`, color: '#bb44cc' }];
      case 'frail':
        return [{ text: `Frail  (-50% damage dealt)`, color: '#1abc9c' }];
      default:
        return [{ text: sub.type.toUpperCase(), color: '#aaaaaa' }];
    }
  }

  _floatText(x, y, msg, color) {
    const txt = this.add.text(x, y, msg, {
      fontSize: '17px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0.5).setDepth(95).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, y: y - 14, duration: 180,
      onComplete: () => {
        this.tweens.add({ targets: txt, alpha: 0, y: y - 28, duration: 500, delay: 300,
          onComplete: () => txt.destroy() });
      }
    });
  }

  _applyBumperKick(dieBody, bx, by) {
    const dx   = dieBody.position.x - bx;
    const dy   = dieBody.position.y - by;
    const len  = Math.hypot(dx, dy) || 1;
    const nvx  = dieBody.velocity.x * 0.5 + (dx / len) * BUMPER_KICK_SPEED;
    const nvy  = dieBody.velocity.y * 0.5 + (dy / len) * BUMPER_KICK_SPEED;
    const spd  = Math.hypot(nvx, nvy);
    const cap  = Math.min(spd, MAX_THROW_SPEED);
    Phaser.Physics.Matter.Matter.Body.setVelocity(dieBody, {
      x: (nvx / spd) * cap, y: (nvy / spd) * cap,
    });
  }

  _flashPlayerBumper() {
    if (!this.playerGfx) return;
    this.tweens.killTweensOf(this.playerGfx);
    this.tweens.add({
      targets: this.playerGfx, scaleX: 1.35, scaleY: 1.35,
      duration: 55, yoyo: true, ease: 'Sine.Out',
      onComplete: () => this.playerGfx?.setScale(1)
    });
  }

  _flashEnemyBumper() {
    if (!this.enemyCharContainer) return;
    this.tweens.killTweensOf(this.enemyCharContainer);
    this.tweens.add({
      targets: this.enemyCharContainer,
      scaleX: 1.35, scaleY: 1.35,
      duration: 55, yoyo: true, ease: 'Sine.Out',
      onComplete: () => this.enemyCharContainer?.setScale(1)
    });
  }

  // ─── PLAYER CHARACTER ─────────────────────────────────────────────────────

  _buildPlayerCharacter() {
    const g = this.add.graphics().setDepth(19).setPosition(THROW_ORIGIN_X, THROW_ORIGIN_Y);
    this.playerGfx = g;

    g.fillStyle(0xd4a820, 0.18);
    g.fillCircle(0, 0, 22);
    g.lineStyle(2, 0xd4a820, 0.7);
    g.strokeCircle(0, 0, 22);
    g.lineStyle(1, 0xd4a820, 0.25);
    g.strokeCircle(0, 0, 32);

    this.add.text(THROW_ORIGIN_X, THROW_ORIGIN_Y, 'YOU', {
      fontSize: '17px', color: '#d4a820', fontStyle: 'bold', letterSpacing: 1
    }).setOrigin(0.5, 0.5).setDepth(20);

    const dot = this.add.circle(THROW_ORIGIN_X, THROW_ORIGIN_Y, 4, 0xd4a820, 0.5).setDepth(20);
    this.tweens.add({ targets: dot, alpha: 0.1, duration: 950, yoyo: true, repeat: -1 });

    this.playerHpTxt = this.add.text(THROW_ORIGIN_X + PLAYER_BUMPER_R + 10, THROW_ORIGIN_Y, '', {
      fontSize: '17px', color: '#2ecc71', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(20);

    this.playerBlockTxt = this.add.text(THROW_ORIGIN_X - PLAYER_BUMPER_R - 10, THROW_ORIGIN_Y, '', {
      fontSize: '17px', color: '#3498db', fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(20).setVisible(false);

    // Status pill strip — rebuilt by _refreshPlayerPills()
    this._playerPillsCont = this.add.container(THROW_ORIGIN_X, THROW_ORIGIN_Y + PLAYER_BUMPER_R + 14)
      .setDepth(21);

    // Tap hit zone — shows status popup
    const hitZone = this.add.circle(THROW_ORIGIN_X, THROW_ORIGIN_Y, PLAYER_BUMPER_R + 8, 0, 0)
      .setInteractive().setDepth(22);
    hitZone.on('pointerdown', () => this._showPlayerStatusPopup());

    this.playerPhysicsBody = this.matter.add.circle(
      THROW_ORIGIN_X, THROW_ORIGIN_Y, PLAYER_BUMPER_R,
      { isStatic: true, label: 'playerBumper', restitution: 0.9, friction: 0,
        collisionFilter: { category: 0x0002, mask: 0xFFFFFFFF } }
    );
  }

  // ─── DIE STRIP ────────────────────────────────────────────────────────────

  _buildDieStrip() {
    const sy = DIE_STRIP_Y;
    const fh = H - SURFACE_BOTTOM;
    this.add.rectangle(W / 2, sy, W, fh, 0x080812).setDepth(20);

    this._buildTrayCards();
  }

  _buildTrayCards() {
    this.trayCards.forEach(c => { c.img.destroy(); c.lbl.destroy(); });
    this.trayCards = [];

    const total = this.playerDiceConfig.length;
    const sz = 38, gap = 8;
    const totW = total * sz + (total - 1) * gap;

    this.playerDiceConfig.forEach((dc, configIdx) => {
      const x = (W - totW) / 2 + configIdx * (sz + gap) + sz / 2;
      const y = DIE_STRIP_Y + 5;

      const img = this.add.image(x, y, 'tcard').setDepth(21).setInteractive();
      const dt  = DIE_TYPES[dc.type];
      const lbl = this.add.text(x, y, dt ? dt.sym : '?', {
        fontSize: '17px', color: dt ? dt.color : '#777777', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5, 0.5).setDepth(22);

      const card = { configIdx, img, lbl };
      this.trayCards.push(card);

      img.on('pointerdown', (ptr) => {
        this._dragCard    = card;
        this._dragMoved   = false;
        this._dragOffsetX = ptr.x - img.x;
      });
    });
  }

  _cardX(unthrownPos) {
    const n    = this.trayCards.length - this.throwCount;
    const sz   = 38, gap = 8;
    const totW = n * sz + (n - 1) * gap;
    return (W - totW) / 2 + unthrownPos * (sz + gap) + sz / 2;
  }

  // ─── COMMIT OVERLAY ───────────────────────────────────────────────────────

  _buildCommitOverlay() {
    this.commitGroup = this.add.container(W / 2, DIE_STRIP_Y).setDepth(29).setAlpha(0);

    const bg = this.add.rectangle(0, 0, W - 16, 50, 0x163824);
    bg.setStrokeStyle(1.5, 0x27ae60, 0.9);
    bg.setInteractive();
    bg.on('pointerdown', () => this._onCommit());
    bg.on('pointerover',  () => bg.setFillStyle(0x27ae60));
    bg.on('pointerout',   () => bg.setFillStyle(0x163824));

    const txt = this.add.text(0, 0, 'End Turn', {
      fontSize: '17px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5, 0.5);

    this.commitGroup.add([bg, txt]);
    this.commitBg = bg;
  }

  _showCommitOverlay() {
    this.commitGroup.setAlpha(0).setY(DIE_STRIP_Y + 16);
    this.tweens.add({ targets: this.commitGroup, y: DIE_STRIP_Y, alpha: 1, duration: 280, ease: 'Back.Out' });
    this._pulseCommit();
  }

  _hideCommitOverlay() {
    this.tweens.killTweensOf(this.commitGroup);
    this.tweens.add({ targets: this.commitGroup, alpha: 0, duration: 180,
      onComplete: () => { this.commitGroup.setY(DIE_STRIP_Y); } });
  }

  // ─── STATUS UI ────────────────────────────────────────────────────────────

  _refreshStatusUI() {
    this.playerHpTxt?.setText(`${Math.max(0, this.playerHp)}/${this.playerMaxHp}`);
    if (this.playerBlockTxt) {
      if (this.block > 0) {
        this.playerBlockTxt.setText(`BLK ${this.block}`).setVisible(true);
      } else {
        this.playerBlockTxt.setVisible(false);
      }
    }
    this._refreshPlayerPills();
  }

  _refreshPlayerPills() {
    if (!this._playerPillsCont) return;
    this._playerPillsCont.removeAll(true);

    const active = [];
    if (this.poisonStacks > 0)
      active.push({ label: `☠ ${this.poisonStacks}`, color: '#58d68d' });
    if (this.playerFrail > 0)
      active.push({ label: `FRAIL ×${this.playerFrail}`, color: '#1abc9c' });
    if (this.vulnerable > 0)
      active.push({ label: `VLN ×${this.vulnerable}`, color: '#bb44cc' });
    if (active.length === 0) return;

    const PILL_H = 18, PAD = 7, GAP = 5;

    // Build text objects first so we can measure widths
    const txts = active.map(s => this.add.text(0, 0, s.label, {
      fontSize: '11px', color: s.color, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const widths  = txts.map(t => t.width + PAD * 2);
    const totalW  = widths.reduce((a, b) => a + b, 0) + GAP * (active.length - 1);
    let cx = -totalW / 2;

    active.forEach((s, i) => {
      const pw = widths[i];
      const fc = parseInt(s.color.replace('#', ''), 16);
      const bg = this.add.rectangle(cx + pw / 2, 0, pw, PILL_H, fc, 0.2);
      bg.setStrokeStyle(1.5, fc, 0.75);
      txts[i].setPosition(cx + PAD, 0);
      this._playerPillsCont.add([bg, txts[i]]);
      cx += pw + GAP;
    });
  }

  _showPlayerStatusPopup() {
    if (this._playerStatusPopup) {
      this._playerStatusPopup.destroy(true);
      this._playerStatusPopup = null;
      return;
    }

    const rows = [];
    if (this.poisonStacks > 0)
      rows.push({ label: `Poison  ☠ ${this.poisonStacks}`, color: '#58d68d',
        desc: `Lose ${this.poisonStacks} HP at the start of your turn. Decreases by 1 each turn.` });
    if (this.playerFrail > 0)
      rows.push({ label: `Frail  ×${this.playerFrail}`, color: '#1abc9c',
        desc: `Your dice deal half damage. ${this.playerFrail} turn${this.playerFrail > 1 ? 's' : ''} remaining.` });
    if (this.vulnerable > 0)
      rows.push({ label: `Vulnerable  ×${this.vulnerable}`, color: '#bb44cc',
        desc: `You take 50% more damage. ${this.vulnerable} turn${this.vulnerable > 1 ? 's' : ''} remaining.` });
    if (rows.length === 0)
      rows.push({ label: 'No active effects', color: '#445566',
        desc: 'You have no status effects right now.' });

    const panelW = W - 40;
    const ROW_H  = 54;
    const panelH = rows.length * ROW_H + 40;
    const panelY = Math.max(SURFACE_TOP + panelH / 2 + 8,
                            THROW_ORIGIN_Y - PLAYER_BUMPER_R - panelH / 2 - 12);

    const pop = this._playerStatusPopup = this.add.container(0, 0).setDepth(80);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
    dim.on('pointerdown', () => { pop.destroy(true); this._playerStatusPopup = null; });
    pop.add(dim);

    pop.add(this.add.rectangle(W / 2, panelY, panelW, panelH, 0x080814)
      .setStrokeStyle(1.5, 0x2a3a5a, 0.9));
    pop.add(this.add.text(W / 2, panelY - panelH / 2 + 16, 'YOUR STATUS', {
      fontSize: '12px', color: '#2a3848', letterSpacing: 2,
    }).setOrigin(0.5, 0.5));

    rows.forEach((row, i) => {
      const ry  = panelY - panelH / 2 + 40 + i * ROW_H + ROW_H / 2;
      const fc  = parseInt(row.color.replace('#', ''), 16);
      const lx  = W / 2 - panelW / 2 + 16;
      pop.add(this.add.rectangle(W / 2, ry, panelW - 16, ROW_H - 8, fc, 0.1)
        .setStrokeStyle(1, fc, 0.35));
      pop.add(this.add.text(lx, ry - 10, row.label, {
        fontSize: '14px', color: row.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      pop.add(this.add.text(lx, ry + 10, row.desc, {
        fontSize: '12px', color: '#556677', wordWrap: { width: panelW - 32 },
      }).setOrigin(0, 0.5));
    });
  }

  // ─── COLLISIONS ───────────────────────────────────────────────────────────

  _setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (this.phase !== PHASE.PLAYER_ROLL && this.phase !== PHASE.ENEMY_ROLL) return;
      const rerolled = new Set();

      event.pairs.forEach(({ bodyA, bodyB }) => {
        const dA = bodyA.gameObject?.getData('dieRef');
        const dB = bodyB.gameObject?.getData('dieRef');

        // Die-die: material checks then reroll the slower one
        if (dA && dB) {
          // Glass: shatters both on contact
          const glassA = dA.isPlayer && dA.data.material === 'glass';
          const glassB = dB.isPlayer && dB.data.material === 'glass';
          if (glassA || glassB) {
            this._shatterDie(dA);
            this._shatterDie(dB);
            return;
          }


          // Copy die: remember the last player die type it touched
          if (dA.isPlayer && dA.data.type === 'copy' && dB.isPlayer && dB.data.type !== 'copy') {
            dA._mimicType = dB.data.type;
          }
          if (dB.isPlayer && dB.data.type === 'copy' && dA.isPlayer && dA.data.type !== 'copy') {
            dB._mimicType = dA.data.type;
          }

          dA._hadCollision = true;
          dB._hadCollision = true;
          const relVel = Math.hypot(
            bodyA.velocity.x - bodyB.velocity.x,
            bodyA.velocity.y - bodyB.velocity.y
          );
          if (relVel >= MIN_REROLL_VEL) {
            const sA    = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
            const sB    = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
            const struck = sA < sB ? dA : dB;
            if (!rerolled.has(struck)) {
              rerolled.add(struck); this._rerollDie(struck);
            }
          }
          return;
        }

        // Die-bumper: pinball kick + reroll
        const dieRef  = dA || dB;
        const dieBody = dA ? bodyA : bodyB;
        const other   = dA ? bodyB : bodyA;

        if (dieRef && other.label === 'enemyBumper') {
          dieRef._hadCollision = true;
          this._applyBumperKick(dieBody, this.enemyPos.x, this.enemyPos.y);
          if (!rerolled.has(dieRef)) {
            rerolled.add(dieRef); this._rerollDie(dieRef);
          }
          this._flashEnemyBumper();
          // Any die contacting the enemy bumper deals 1 chip damage (absorbed by block)
          const chipDmg = this._hitEnemyBlock(1);
          if (chipDmg > 0) {
            this.enemyHp = Math.max(0, this.enemyHp - chipDmg);
            this._flashEnemyDamage(chipDmg);
            if (this.enemyHp <= 0) this._triggerVictory();
          }
          if (dieRef.isPlayer && dieRef.data.material === 'cursed') {
            this.enemyVulnerable = true;
            this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'EXPOSED', '#ff44bb');
          }
          if (dieRef.isPlayer) this.relicManager.onHitBumper(dieRef);
          this._refreshEnemyCharacter();
        }

        if (dieRef && other.label === 'playerBumper') {
          dieRef._hadCollision = true;
          this._applyBumperKick(dieBody, THROW_ORIGIN_X, THROW_ORIGIN_Y);
          if (!rerolled.has(dieRef)) {
            rerolled.add(dieRef); this._rerollDie(dieRef);
          }
          this._flashPlayerBumper();
        }
      });
    });
  }

  // ─── POINTER / INPUT ──────────────────────────────────────────────────────

  _setupPointer() {
    this.input.on('pointerdown', (ptr) => {
      if (this.inspectorPanel) return;
      if (this.phase !== PHASE.PLAYER_ROLL) return;
      if (ptr.y > THROW_ZONE_BOTTOM) return;
      if (this.throwCount >= this.trayCards.length) return;
      if (this._throwLocked) return;
      this.aimActive  = true;
      this._aimStartX = ptr.x;
      this._aimStartY = ptr.y;
    });

    this.input.on('pointermove', (ptr) => {
      if (this._dragCard) {
        const card     = this._dragCard;
        const cardPos  = this.trayCards.indexOf(card);
        const isThrown = cardPos < this.throwCount;

        if (!this._dragMoved && Math.abs(ptr.x - card.img.x) > 5 && !isThrown) {
          this._dragMoved = true;
          card.img.setDepth(25);
          card.lbl.setDepth(26);
        }

        if (this._dragMoved && !isThrown) {
          const newX = Phaser.Math.Clamp(ptr.x, 22, W - 22);
          card.img.setX(newX);
          card.lbl.setX(newX);

          const n = this.trayCards.length;
          const currentPos = this.trayCards.indexOf(card);
          for (let j = 0; j < n; j++) {
            if (j === currentPos || j < this.throwCount) continue;
            const jx = this._cardX(j - this.throwCount);
            if (currentPos > j && newX < jx) { this._swapCards(currentPos, j); break; }
            if (currentPos < j && newX > jx) { this._swapCards(currentPos, j); break; }
          }
          this._snapNonDragged(card);
          return;
        }
      }

      if (!this.aimActive) return;
      const dragDx = ptr.x - this._aimStartX;
      const dragDy = ptr.y - this._aimStartY;
      this.aimGfx.clear();
      this.aimGfx.lineStyle(2, 0xffffff, 0.45);
      this.aimGfx.beginPath();
      this.aimGfx.moveTo(THROW_ORIGIN_X, THROW_ORIGIN_Y);
      this.aimGfx.lineTo(THROW_ORIGIN_X - dragDx, THROW_ORIGIN_Y - dragDy);
      this.aimGfx.strokePath();
    });

    this.input.on('pointerup', (ptr) => {
      if (this._suppressThrow) {
        this._suppressThrow = false;
        this.aimActive = false;
        this.aimGfx.clear();
        this._dragCard = null;
        return;
      }

      if (this._dragCard && this._dragMoved) {
        const card = this._dragCard;
        card.img.setDepth(21);
        card.lbl.setDepth(22);
        this._snapAllCards();
        this._dragCard  = null;
        this._dragMoved = false;
        this.aimActive  = false;
        this.aimGfx.clear();
        return;
      }

      if (this._dragCard && !this._dragMoved) {
        const card = this._dragCard;
        this._dragCard = null;
        const dc = this.playerDiceConfig[card.configIdx];
        this._buildPlayerInspector(dc, -1, null);
        return;
      }

      if (this.aimActive && this.phase === PHASE.PLAYER_ROLL) {
        this.aimGfx.clear();
        this.aimActive = false;
        const dragDx = ptr.x - this._aimStartX;
        const dragDy = ptr.y - this._aimStartY;
        const len    = Math.hypot(dragDx, dragDy);
        if (len < 20) return;  // too small — ignore accidental taps
        const spd = Math.min(MAX_THROW_SPEED, Math.max(7, len * 0.14));
        this._throwNextCard(THROW_ORIGIN_X, THROW_ORIGIN_Y, (-dragDx / len) * spd, (-dragDy / len) * spd);
      }
    });
  }

  // ─── CARD ORDER HELPERS ───────────────────────────────────────────────────

  _swapCards(a, b) {
    [this.trayCards[a], this.trayCards[b]] = [this.trayCards[b], this.trayCards[a]];
  }

  _snapNonDragged(dragCard) {
    this.trayCards.forEach((c, pos) => {
      if (c === dragCard || pos < this.throwCount) return;
      const tx = this._cardX(pos - this.throwCount);
      this.tweens.killTweensOf([c.img, c.lbl]);
      this.tweens.add({ targets: [c.img, c.lbl], x: tx, duration: 100, ease: 'Sine.Out' });
    });
  }

  _snapAllCards() {
    this.trayCards.forEach((c, pos) => {
      if (pos < this.throwCount) return;
      const tx = this._cardX(pos - this.throwCount);
      this.tweens.killTweensOf([c.img, c.lbl]);
      this.tweens.add({ targets: [c.img, c.lbl], x: tx, duration: 120, ease: 'Back.Out' });
    });
  }

  // ─── TURN FLOW ────────────────────────────────────────────────────────────

  _startTurn() {
    this.phase           = PHASE.PREP;
    this.block           = 0;
    if (this.vulnerable > 0)   this.vulnerable--;
    this.enemyWeakened   = false;
    this.enemyVulnerable = false;
    if (this.playerFrail > 0) this.playerFrail--;
    this.enemyBlock      = 0;
    this._autoCommitDone = false;
    this._hideIntentPopup();

    this._effectQueue = [];
    this._queueCards.forEach(c => c.container.destroy());
    this._queueCards  = [];
    this._queueActive = false;
    this._throwLocked = false;

    this._resetTray();
    this._hideCommitOverlay();
    this._refreshStatusUI();
    this._setPhase('PREPARING...');
    this._showMsg('');

    this.relicManager.onStartTurn();

    this._moveEnemyToNewPosition(() => {
      this.time.delayedCall(400, () => this._enemyRollPhase());
    });
  }

  _enemyRollPhase() {
    this.phase = PHASE.ENEMY_ROLL;
    this._setPhase('ENEMY ROLLING');

    // Tick enemy poison before obstacles are thrown
    if (this.enemyPoisonStacks > 0) {
      const psn    = this.enemyPoisonStacks;
      this.enemyHp = Math.max(0, this.enemyHp - psn);
      this.enemyPoisonStacks = Math.max(0, this.enemyPoisonStacks - 1);
      this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `☠ -${psn}`, '#58d68d');
      this._refreshEnemyCharacter();
      if (this.enemyHp <= 0) { this._triggerVictory(); return; }
    }

    // Draw intent for this turn
    this.currentIntent = this._drawIntent();

    // Apply block intent immediately so it's active during the player's turn
    const allIntents = this.currentIntent.type === 'multi'
      ? this.currentIntent.intents : [this.currentIntent];
    const blockSub = allIntents.find(i => i.type === 'block');
    if (blockSub) this.enemyBlock = blockSub.value;

    this._refreshEnemyCharacter();
    this._showMsg('Enemy is acting — tap the enemy to see intent');

    // Place obstacle dice in the most open gaps between enemy and player
    const count  = this.enemyDef.obstacleCount ?? 1;
    const MARGIN = 36;
    const placeY = (this.enemyPos.y + THROW_ORIGIN_Y) / 2 + 20;

    // Largest-gap algorithm: each new obstacle fills the widest open x interval
    const anchors = [MARGIN, W - MARGIN];
    const positions = [];
    for (let i = 0; i < count; i++) {
      anchors.sort((a, b) => a - b);
      let bestGap = -1, bestMid = W / 2;
      for (let j = 0; j < anchors.length - 1; j++) {
        const gap = anchors[j + 1] - anchors[j];
        if (gap > bestGap) { bestGap = gap; bestMid = (anchors[j] + anchors[j + 1]) / 2; }
      }
      anchors.push(bestMid);
      positions.push({ x: bestMid, y: placeY + Phaser.Math.FloatBetween(-20, 20) });
    }

    // Pop each obstacle into its position, staggered
    positions.forEach((pos, i) => {
      this.time.delayedCall(i * 140, () => {
        const eDie = this._spawnDie({ isObstacle: true, currentFaceIdx: 0 },
          pos.x, pos.y, 0, 0, false, -1);
        eDie._finalFaceIdx = 0;
        eDie._rolling = false;

        eDie.img.setAlpha(0).setScale(0.1);
        eDie.lbl.setAlpha(0);
        eDie.valLbl.setAlpha(0);
        this.tweens.add({
          targets: eDie.img, alpha: 1, scaleX: 1, scaleY: 1,
          duration: 250, ease: 'Back.Out',
        });
        this.tweens.add({ targets: [eDie.lbl, eDie.valLbl], alpha: 1, duration: 200, delay: 100 });
      });
    });

    this.time.delayedCall(count * 140 + 400, () => this._playerRollPhase());
  }

  _playerRollPhase() {
    this.phase = PHASE.PLAYER_ROLL;

    if (this.poisonStacks > 0) {
      const psn     = this.poisonStacks;
      this.playerHp = Math.max(0, this.playerHp - psn);
      this.poisonStacks = Math.max(0, this.poisonStacks - 1);
      this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 30, `☠ -${psn} PSN`, '#58d68d');
      this._refreshStatusUI();
      if (this.playerHp <= 0) {
        this.time.delayedCall(800, () => this._gameOver());
        return;
      }
    }

    this._setPhase('YOUR TURN');
    this._showMsg('Drag on the surface to throw your next die');
  }

  _onCommit() {
    if (this.phase !== PHASE.PLAYER_ROLL) return;
    if (this._throwLocked || this._queueActive) return;
    if (this.throwCount < this.trayCards.length) {
      this._showMsg(`Throw your remaining ${this.trayCards.length - this.throwCount} dice first!`);
      return;
    }
    this._hideCommitOverlay();
    this._commitPhase();
  }

  _commitPhase() {
    this.phase = PHASE.COMMIT;
    this._setPhase('RESOLVING...');
    this._showMsg('');
    this._hideIntentPopup();

    this.time.delayedCall(600, () => {
      const intent   = this.currentIntent;
      const subs     = intent?.type === 'multi' ? intent.intents : (intent ? [intent] : []);
      const msgs     = [];

      subs.forEach(sub => {
        switch (sub.type) {
          case 'attack': {
            let dmg = (sub.value + this.enemyStrength);
            if (this.vulnerable > 0) dmg = Math.ceil(dmg * 1.5);
            if (this.enemyWeakened)  dmg = Math.floor(dmg * 0.5);
            const taken = Math.max(0, dmg - this.block);
            this.playerHp = Math.max(0, this.playerHp - taken);
            if (taken > 0) {
              this._flashDamage(taken);
              msgs.push(`-${taken} HP`);
              this.relicManager.onDamageTaken(taken);
            } else {
              msgs.push('Blocked!');
            }
            break;
          }
          case 'block':
            // Already set in _enemyRollPhase; just acknowledge
            msgs.push(`Enemy blocked ${sub.value}`);
            break;
          case 'strength':
            this.enemyStrength += sub.value;
            this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `STR +${sub.value}`, '#e67e22');
            msgs.push(`Enemy STR +${sub.value}`);
            break;
          case 'vulnerable':
            this.vulnerable = Math.max(this.vulnerable, 3);
            this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 30, 'VULNERABLE!', '#bb44cc');
            msgs.push('You are Vulnerable');
            break;
          case 'frail':
            this.playerFrail = Math.max(this.playerFrail, 3);
            this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y + 30, 'FRAIL!', '#1abc9c');
            msgs.push('You are Frail');
            break;
        }
      });

      if (this.enemyWeakened)
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 50, 'WEAKENED!', '#9b59b6');

      this._lastIntentWasPassive = intent ? this._isPurelyPassive(intent) : false;

      this._refreshEnemyCharacter();
      this._refreshStatusUI();
      this._showMsg(msgs.length > 0 ? msgs.join('  ·  ') : 'Nothing happened.');

      this.time.delayedCall(2000, () => {
        this._clearSurface();
        if (this.playerHp <= 0) this._gameOver();
        else                    this._startTurn();
      });
    });
  }

  // ─── DIE HELPERS ──────────────────────────────────────────────────────────

  _spawnDie(data, x, y, vx, vy, isPlayer, configIdx) {
    const img = this.matter.add.image(x, y, isPlayer ? 'pdie' : 'edie', undefined, {
      isStatic: false, friction: DIE_FRICTION, frictionAir: DIE_FRICTION_AIR,
      restitution: DIE_BOUNCE, label: isPlayer ? 'pdie' : 'edie', density: 0.004,
      shape: { type: 'circle', radius: DIE_SIZE / 2 - 2 },
    });
    img.setVelocity(vx, vy);

    let lblText, lblColor, valText;
    if (isPlayer) {
      const dt = DIE_TYPES[data.type];
      lblText  = String(Math.floor(data.currentFaceIdx / 2) + 1);
      lblColor = dt ? dt.color : '#ffffff';
      valText  = '';
    } else if (data.faces) {
      const face = FACES[data.faces[data.currentFaceIdx]];
      const showVal = face?.effect === 'enemy_damage' || face?.effect === 'enemy_block';
      lblText  = (showVal && face.value !== undefined) ? String(face.value) : (face ? face.sym : '--');
      lblColor = face ? face.color : '#ffffff';
      valText  = showVal ? '' : (face?.value !== undefined ? String(face.value) : '');
    } else {
      // obstacle die
      lblText  = '--';
      lblColor = '#555555';
      valText  = '';
    }
    const lbl    = this.add.text(x, y - 8, lblText, {
      fontSize: '17px', color: lblColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(10);
    const valLbl = this.add.text(x, y + 10, valText, {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(10);

    const dieRef = { data, img, lbl, valLbl, isPlayer, configIdx, _rolling: false, _finalFaceIdx: null, _lastCycleMs: 0, _shieldActive: false, _shieldPulseTimer: null };
    img.setData('dieRef', dieRef);
    img.setInteractive();
    img.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this._showInspector(dieRef);
    });

    this.allDice.push(dieRef);
    if (isPlayer) this.playerDice.push(dieRef); else this.enemyDice.push(dieRef);
    return dieRef;
  }

  _throwNextCard(x, y, vx, vy) {
    if (this.throwCount >= this.trayCards.length) return;
    if (this._throwLocked) return;

    const card      = this.trayCards[this.throwCount];
    const configIdx = card.configIdx;
    const dc        = this.playerDiceConfig[configIdx];
    const activeIdx = this._getActiveFaceIndices(dc);
    const fIdx      = activeIdx[Phaser.Math.Between(0, activeIdx.length - 1)];
    const data      = { ...dc, currentFaceIdx: fIdx };

    const die  = this._spawnDie(data, x, y, vx, vy, true, configIdx);
    die._finalFaceIdx  = fIdx;
    die._rolling       = true;
    die._lastCycleMs   = 0;
    die._hadCollision  = false;
    this._throwLocked  = true;

    // Ignore the player bumper until the die has cleared the origin
    die.img.body.collisionFilter.mask = 0xFFFFFFFF & ~0x0002;
    this.time.delayedCall(400, () => {
      if (die.img?.body) die.img.body.collisionFilter.mask = 0xFFFFFFFF;
    });

    card.img.setVisible(false);
    card.lbl.setVisible(false);
    this.throwCount++;
    this._snapAllCards();
    this._showMsg('Die thrown — waiting to settle…');
  }

  _rerollDie(dieRef) {
    this._stopDieShield(dieRef);
    const { data } = dieRef;
    if (dieRef.isPlayer) {
      const activeIdx = this._getActiveFaceIndices(data);
      data.currentFaceIdx = activeIdx[Phaser.Math.Between(0, activeIdx.length - 1)];
    } else {
      data.currentFaceIdx = Phaser.Math.Between(0, (data.faces?.length ?? 6) - 1);
    }
    dieRef._finalFaceIdx = data.currentFaceIdx;
    dieRef._rolling      = true;
    dieRef._lastCycleMs  = 0;
  }

  // ─── IMMEDIATE EFFECTS ────────────────────────────────────────────────────

  _applyDieFaceImmediate(dieRef, skipRune = false) {
    if (this.phase === 99) return;
    const { data } = dieRef;
    const value = Math.floor(data.currentFaceIdx / 2) + 1;
    const type  = dieRef._mimicType ?? data.type;
    const isDmg = type === 'attack' || type === 'pierce';

    switch (type) {
      case 'attack': {
        let raw = this._getModifiedValue(dieRef, value, true);
        raw += this.relicManager.getAttackBonus();
        if (!dieRef._hadCollision) raw += this.relicManager.getCleanLandBonus();
        raw  = Math.floor(raw * this.relicManager.getAttackMultiplier());
        if (this.playerFrail > 0) raw = Math.floor(raw * 0.5);
        if (this.enemyVulnerable) raw = Math.ceil(raw * 1.5);
        const isPierceAll = data.material === 'rock' || this.relicManager.isPierceAll();
        const dmg         = isPierceAll ? raw : this._hitEnemyBlock(raw);
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xff4444);
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          this.relicManager.onAttackHit(dmg);
        }
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'block': {
        let blk = this._getModifiedValue(dieRef, value, false);
        blk += this.relicManager.getBlockBonus();
        if (!dieRef._hadCollision) blk += this.relicManager.getCleanLandBonus();
        blk  = Math.floor(blk * this.relicManager.getBlockMultiplier());
        this.block += blk;
        this._refreshStatusUI();
        this._flashDieImpact(dieRef, `+${blk} BLK`, '#3498db');
        this.relicManager.onBlock(blk);
        break;
      }
      case 'pierce': {
        let dmg = this._getModifiedValue(dieRef, value, true);
        dmg += this.relicManager.getAttackBonus();
        if (!dieRef._hadCollision) dmg += this.relicManager.getCleanLandBonus();
        dmg  = Math.floor(dmg * this.relicManager.getAttackMultiplier());
        if (this.playerFrail > 0) dmg = Math.floor(dmg * 0.5);
        if (this.enemyVulnerable) dmg = Math.ceil(dmg * 1.5);
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xff9900);
        this.enemyHp = Math.max(0, this.enemyHp - dmg);
        this._refreshEnemyCharacter();
        this._flashEnemyDamage(dmg);
        if (dmg > 0) this.relicManager.onAttackHit(dmg);
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'copy': {
        // No mimic acquired — deal 1 weak attack (absorbed by block)
        const dmg = this._hitEnemyBlock(1);
        this._floatText(dieRef.img.x, dieRef.img.y - 32, 'NO COPY', '#cc88ff');
        if (dmg > 0) {
          this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xcc88ff);
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          if (this.enemyHp <= 0) this._triggerVictory();
        }
        break;
      }
      case 'leech': {
        let dmg  = this._getModifiedValue(dieRef, value, true);
        dmg += this.relicManager.getAttackBonus();
        if (!dieRef._hadCollision) dmg += this.relicManager.getCleanLandBonus();
        dmg  = Math.floor(dmg * this.relicManager.getAttackMultiplier());
        if (this.playerFrail > 0) dmg = Math.floor(dmg * 0.5);
        if (this.enemyVulnerable) dmg = Math.ceil(dmg * 1.5);
        const heal = Math.min(dmg, this.playerMaxHp - this.playerHp);
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xaa44ff);
        this.enemyHp  = Math.max(0, this.enemyHp - dmg);
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
        this._refreshEnemyCharacter();
        this._flashEnemyDamage(dmg);
        if (dmg > 0) this.relicManager.onAttackHit(dmg);
        if (heal > 0) this._flashHeal(heal);
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'poison': {
        const stacks = this._getModifiedValue(dieRef, value, false);
        this.enemyPoisonStacks += stacks;
        this._refreshEnemyCharacter();
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `☠ +${stacks} PSN`, '#58d68d');
        break;
      }
      case 'hex': {
        this.enemyWeakened = true;
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'HEXED!', '#9b59b6');
        break;
      }
      case 'bomb': {
        let raw = this._getModifiedValue(dieRef, value * 2, true);
        raw += this.relicManager.getAttackBonus();
        if (!dieRef._hadCollision) raw += this.relicManager.getCleanLandBonus();
        raw  = Math.floor(raw * this.relicManager.getAttackMultiplier());
        if (this.playerFrail > 0) raw = Math.floor(raw * 0.5);
        if (this.enemyVulnerable) raw = Math.ceil(raw * 1.5);
        const dmg = this.relicManager.isPierceAll() ? raw : this._hitEnemyBlock(raw);
        const recoil  = value;
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xff6622);
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          this.relicManager.onAttackHit(dmg);
        }
        this.playerHp = Math.max(0, this.playerHp - recoil);
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 30, `-${recoil} RECOIL`, '#ff6622');
        this._refreshStatusUI();
        if (this.enemyHp <= 0) this._triggerVictory();
        if (this.playerHp <= 0) this.time.delayedCall(800, () => this._gameOver());
        break;
      }
    }

    if (!skipRune && data.runeMap?.[data.currentFaceIdx]) {
      this._applyRuneEffect(dieRef);
    }
  }

  _applyRuneEffect(dieRef) {
    const runeId = dieRef.data.runeMap?.[dieRef.data.currentFaceIdx];
    if (!RUNES[runeId]) return;
    const rune = RUNES[runeId];

    switch (runeId) {
      case 'viking': {
        this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym} ×2`, rune.color);
        this.time.delayedCall(120, () => this._applyDieFaceImmediate(dieRef, true));
        break;
      }
      case 'egyptian': {
        this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym} ↻`, rune.color);
        this.time.delayedCall(250, () => {
          if (!dieRef.img?.active || !dieRef.img.body) return;
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const spd   = Phaser.Math.FloatBetween(6, 11);
          Phaser.Physics.Matter.Matter.Body.setVelocity(dieRef.img.body, {
            x: Math.cos(angle) * spd,
            y: Math.sin(angle) * spd,
          });
          this._rerollDie(dieRef);
        });
        break;
      }
      case 'trojan': {
        const origIdx = dieRef.data.currentFaceIdx;
        const oppIdx  = (dieRef.data.sides - 1) - origIdx;
        this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym}`, rune.color);
        dieRef.data.currentFaceIdx = oppIdx;
        this._applyDieFaceImmediate(dieRef, true);
        dieRef.data.currentFaceIdx = origIdx;
        break;
      }
      case 'greek': {
        this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym} BLAST`, rune.color);
        this._blastDice(dieRef, 1);
        break;
      }
      case 'cosmic': {
        this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym} PULL`, rune.color);
        this._blastDice(dieRef, -1);
        break;
      }
      case 'venom': {
        this.enemyPoisonStacks += 3;
        this._refreshEnemyCharacter();
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠+3`, rune.color);
        break;
      }
      case 'weaken': {
        this.enemyWeakened = true;
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} WEAKENED`, rune.color);
        break;
      }
      case 'expose': {
        this.enemyVulnerable = true;
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} EXPOSED`, rune.color);
        break;
      }
      case 'toxic': {
        this.enemyPoisonStacks += 5;
        this._refreshEnemyCharacter();
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠+5`, rune.color);
        break;
      }
      case 'plague': {
        const added = this.enemyPoisonStacks;
        this.enemyPoisonStacks *= 2;
        this._refreshEnemyCharacter();
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠×2 (+${added})`, rune.color);
        break;
      }
    }
  }

  _blastDice(originDieRef, direction) {
    const BLAST_SPEED = 14;
    const ox = originDieRef.img.x;
    const oy = originDieRef.img.y;
    this.allDice.forEach(d => {
      if (d === originDieRef || !d.img?.active || !d.img.body) return;
      const dx  = d.img.x - ox;
      const dy  = d.img.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, {
        x: (dx / len) * BLAST_SPEED * direction,
        y: (dy / len) * BLAST_SPEED * direction,
      });
      this._rerollDie(d);
    });
  }

  _getModifiedValue(dieRef, base, isDamage = false) {
    const mat = dieRef.data.material;
    let v = base;
    if (mat === 'iron')             v += 1;
    if (mat === 'steel')            v *= 2;
    if (mat === 'uranium')          v *= 2;
    if (isDamage && mat === 'fire') v += 3;
    if (mat === 'phantom' && !dieRef._hadCollision) v *= 2;
    return v;
  }

  _applyMaxFaceDamage(dieRef) {
    if (!dieRef.img?.active || this.phase === 99) return;
    const activeIdx = this._getActiveFaceIndices(dieRef.data);
    if (!activeIdx.length) return;
    const maxIdx = Math.max(...activeIdx);

    const doHit = () => {
      if (!dieRef.img?.active || this.phase === 99) return;
      const base = Math.floor(maxIdx / 2) + 1;
      let dmg = this._getModifiedValue(dieRef, base, true);
      dmg += this.relicManager.getAttackBonus();
      dmg  = Math.floor(dmg * this.relicManager.getAttackMultiplier());
      if (this.playerFrail > 0) dmg = Math.floor(dmg * 0.5);
      if (this.enemyVulnerable) dmg = Math.ceil(dmg * 1.5);
      const actual = this.relicManager.isPierceAll() ? dmg : this._hitEnemyBlock(dmg);
      if (actual > 0) {
        this.enemyHp = Math.max(0, this.enemyHp - actual);
        this._flashEnemyDamage(actual);
        this._floatText(dieRef.img.x, dieRef.img.y - 24, `★${actual}`, '#e74c3c');
        this.relicManager.onAttackHit(actual);
        this._refreshEnemyCharacter();
      }
      if (this.enemyHp <= 0) this._triggerVictory();
    };

    doHit();

    const runeId = dieRef.data.runeMap?.[maxIdx];
    const rune   = runeId && RUNES[runeId];
    if (rune) {
      switch (runeId) {
        case 'viking':
          this._floatText(dieRef.img.x, dieRef.img.y - 44, `${rune.sym} ×2`, rune.color);
          this.time.delayedCall(120, doHit);
          break;
        case 'venom':
          this.enemyPoisonStacks += 3;
          this._refreshEnemyCharacter();
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠+3`, rune.color);
          break;
        case 'weaken':
          this.enemyWeakened = true;
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} WEAKENED`, rune.color);
          break;
        case 'expose':
          this.enemyVulnerable = true;
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} EXPOSED`, rune.color);
          break;
        case 'toxic':
          this.enemyPoisonStacks += 5;
          this._refreshEnemyCharacter();
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠+5`, rune.color);
          break;
        case 'plague': {
          const added = this.enemyPoisonStacks;
          this.enemyPoisonStacks *= 2;
          this._refreshEnemyCharacter();
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `${rune.sym} ☠×2 (+${added})`, rune.color);
          break;
        }
      }
    }
  }

  _shatterDie(dieRef) {
    if (!this.allDice.includes(dieRef)) return;
    this._floatText(dieRef.img.x, dieRef.img.y - 24, 'SHATTER!', '#aaddff');
    this._stopDieShield(dieRef);
    const wasRollingPlayer = dieRef.isPlayer && dieRef._rolling;
    const removeFrom = (arr) => { const i = arr.indexOf(dieRef); if (i >= 0) arr.splice(i, 1); };
    removeFrom(this.allDice);
    removeFrom(this.playerDice);
    removeFrom(this.enemyDice);
    this.time.delayedCall(150, () => { dieRef.img?.destroy(); dieRef.lbl?.destroy(); dieRef.valLbl?.destroy(); });
    // Die was shattered before settling — the update loop will never trigger
    // _startQueue for it, so _throwLocked would stay true indefinitely.
    if (wasRollingPlayer && !this._queueActive) {
      this._startQueue();
    }
  }

  _triggerVictory() {
    if (this.phase === 99) return;
    this.phase = 99;
    this._hideCommitOverlay();
    this.relicManager.onKill();
    this.time.delayedCall(600, () => this._victory());
  }

  _getActiveEnemyBlock() {
    return this.enemyBlock ?? 0;
  }

  // Absorbs `damage` into enemy block. Returns remaining damage that reaches HP.
  _hitEnemyBlock(damage) {
    if (this.enemyBlock <= 0) return damage;
    const absorbed = Math.min(this.enemyBlock, damage);
    this.enemyBlock -= absorbed;
    this._refreshBlockShield();
    const remaining = damage - absorbed;
    if (remaining === 0) {
      this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `BLOCKED`, '#3498db');
    }
    return remaining;
  }

  _getActiveFaceIndices(dc) {
    const culled = dc.culledFaces ?? [];
    return Array.from({ length: dc.sides }, (_, i) => i).filter(i => !culled.includes(i + 1));
  }

  _laserBeam(x1, y1, x2, y2, color) {
    const g = this.add.graphics().setDepth(50);
    g.lineStyle(5, color, 0.3);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    this.tweens.add({
      targets: g, alpha: 0, duration: 180, ease: 'Sine.In',
      onComplete: () => g.destroy(),
    });
  }

  _flashDieImpact(dieRef, msg, color) {
    if (!dieRef.img?.active) return;
    // Use a separate non-physics overlay so the physics body is never resized,
    // which would generate phantom collisions against adjacent settled dice.
    const ring = this.add.circle(dieRef.img.x, dieRef.img.y, DIE_SIZE * 0.5, 0xffffff, 0.4).setDepth(12);
    this.tweens.add({
      targets: ring, scaleX: 2.0, scaleY: 2.0, alpha: 0,
      duration: 220, ease: 'Sine.Out',
      onComplete: () => ring.destroy(),
    });
    this._floatText(dieRef.img.x, dieRef.img.y - 24, msg, color);
  }

  // ─── SHIELD ANIMATION ─────────────────────────────────────────────────────

  _startDieShield(dieRef) {
    if (dieRef._shieldActive) return;
    dieRef._shieldActive = true;
    const pulse = () => {
      if (!dieRef._shieldActive || !dieRef.img?.active) return;
      const ring = this.add.circle(dieRef.img.x, dieRef.img.y, 18, 0x2980b9, 0.55).setDepth(9);
      this.tweens.add({
        targets: ring, scaleX: 2.8, scaleY: 2.8, alpha: 0,
        duration: 700, ease: 'Sine.Out',
        onComplete: () => ring.destroy(),
      });
      dieRef._shieldPulseTimer = this.time.delayedCall(700, pulse);
    };
    pulse();
  }

  _stopDieShield(dieRef) {
    dieRef._shieldActive = false;
    if (dieRef._shieldPulseTimer) { dieRef._shieldPulseTimer.destroy(); dieRef._shieldPulseTimer = null; }
  }

  _clearSurface() {
    this.allDice.forEach(d => { this._stopDieShield(d); d.img.destroy(); d.lbl.destroy(); d.valLbl.destroy(); });
    this.allDice    = [];
    this.playerDice = [];
    this.enemyDice  = [];
    this._effectQueue = [];
    this._queueCards.forEach(c => c.container.destroy());
    this._queueCards  = [];
    this._queueActive = false;
    this._throwLocked = false;
  }

  // ─── TRAY RESET ───────────────────────────────────────────────────────────

  _resetTray() {
    this.throwCount = 0;
    this.trayCards.forEach((c, pos) => {
      c.img.setVisible(true).setAlpha(1).setDepth(21);
      c.lbl.setVisible(true).setDepth(22);
      const dt = DIE_TYPES[this.playerDiceConfig[c.configIdx].type];
      c.lbl.setText(dt ? dt.sym : '?');
      c.lbl.setColor(dt ? dt.color : '#777777');
      c.img.setX(this._cardX(pos));
      c.lbl.setX(this._cardX(pos));
    });
  }

  // ─── REROLL TOKEN ─────────────────────────────────────────────────────────

  // ─── INSPECTOR ────────────────────────────────────────────────────────────

  _showInspector(dieRef) {
    this._hideInspector();
    const { data, isPlayer } = dieRef;
    if (isPlayer) {
      this._buildPlayerInspector(data, data.currentFaceIdx);
    } else if (data.faces) {
      this._buildInspectorPanel(data.faces, data.currentFaceIdx, 0x8b1a1a);
    }
  }

  _buildInspectorPanel(faces, currentIdx, borderColor) {
    this.aimActive      = false;
    this._suppressThrow = true;
    this.aimGfx.clear();
    this._hideInspector();
    this.inspectorPanel = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    dim.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); });
    this.inspectorPanel.add(dim);

    const cx = W / 2;
    const cy = SURFACE_TOP + (THROW_ZONE_BOTTOM - SURFACE_TOP) / 2;

    if (faces.length === 6) {
      this._buildNetPanel(faces, currentIdx, borderColor, cx, cy);
    } else {
      this._buildRowPanel(faces, currentIdx, borderColor, cx, cy);
    }
  }

  // Lowercase-t die net for exactly 6 faces
  _buildNetPanel(faces, currentIdx, borderColor, cx, cy) {
    const CELL = 46, FACE = 41;
    const NET = [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ];
    const netW = 3 * CELL, netH = 4 * CELL;
    const panelH = netH + 24;
    const gx = cx - netW / 2, gy = cy - netH / 2;

    const bg = this.add.rectangle(cx, cy, netW + 24, panelH, 0x0a0a1e, 0.96);
    bg.setStrokeStyle(1.5, borderColor, 0.85).setInteractive();
    bg.on('pointerdown', () => this._hideInspector());
    this.inspectorPanel.add(bg);

    const closeBtn = this.add.text(cx + (netW + 24) / 2 - 12, cy - panelH / 2 + 14, '✕', {
      fontSize: '17px', color: '#666688',
    }).setOrigin(0.5, 0.5).setInteractive();
    closeBtn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._suppressThrow = true; this._hideInspector(); });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#666688'));
    this.inspectorPanel.add(closeBtn);

    faces.forEach((faceId, fi) => {
      const { col, row } = NET[fi];
      const fx   = gx + col * CELL + CELL / 2;
      const fy   = gy + row * CELL + CELL / 2;
      const face = FACES[faceId];
      const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
      const active = fi === currentIdx;

      const fb = this.add.rectangle(fx, fy, FACE, FACE, active ? 0x1a2e4a : 0x141428);
      fb.setStrokeStyle(active ? 2 : 1, fc, active ? 1 : 0.45);
      this.inspectorPanel.add(fb);
      this.inspectorPanel.add(
        this.add.text(fx, fy, face ? face.sym : '--', {
          fontSize: '17px', color: face ? face.color : '#555577', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0.5)
      );
    });
  }

  // Compact grid fallback for non-6-face lists (e.g. enemy multi-die inspection)
  _buildRowPanel(faces, currentIdx, borderColor, cx, cy) {
    const cols = Math.min(faces.length, 6), sp = 48;
    const rows = Math.ceil(faces.length / cols);
    const panelW = cols * sp + 16, panelH = rows * 58 + 16;

    const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x0a0a1e, 0.96);
    bg.setStrokeStyle(1.5, borderColor, 0.85).setInteractive();
    bg.on('pointerdown', () => this._hideInspector());
    this.inspectorPanel.add(bg);

    const closeBtn = this.add.text(cx + panelW / 2 - 12, cy - panelH / 2 + 14, '✕', {
      fontSize: '17px', color: '#666688',
    }).setOrigin(0.5, 0.5).setInteractive();
    closeBtn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._suppressThrow = true; this._hideInspector(); });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#666688'));
    this.inspectorPanel.add(closeBtn);

    const ox = cx - ((cols - 1) * sp) / 2;
    const oy = cy - ((rows - 1) * 58) / 2;

    faces.forEach((faceId, fi) => {
      const face = FACES[faceId];
      const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
      const fx   = ox + (fi % cols) * sp;
      const fy   = oy + Math.floor(fi / cols) * 58;
      const active = fi === currentIdx;

      const fb = this.add.rectangle(fx, fy - 5, 40, 42, active ? 0x1a2e4a : 0x141428);
      fb.setStrokeStyle(active ? 2 : 1, fc, active ? 1 : 0.4);
      this.inspectorPanel.add(fb);
      this.inspectorPanel.add(
        this.add.text(fx, fy - 5, face ? face.sym : '--', {
          fontSize: '17px', color: face ? face.color : '#555577', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0.5)
      );
    });
  }

  _buildPlayerInspector(data, currentIdx) {
    this.aimActive = false;
    this._suppressThrow = true;
    this.aimGfx.clear();
    this._hideInspector();
    this.inspectorPanel = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    dim.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); });
    this.inspectorPanel.add(dim);

    const cx = W / 2;
    const cy = SURFACE_TOP + (THROW_ZONE_BOTTOM - SURFACE_TOP) / 2;
    const dt = DIE_TYPES[data.type];
    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;

    const CELL = 46, FACE = 41;
    let facePositions, netW, netH;

    if (data.sides === 6) {
      const NET = [
        { col: 1, row: 0 },
        { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
        { col: 1, row: 2 },
        { col: 1, row: 3 },
      ];
      netW = 3 * CELL;
      netH = 4 * CELL;
      facePositions = NET.map(({ col, row }) => ({ fx: col * CELL + CELL / 2, fy: row * CELL + CELL / 2 }));
    } else {
      const cols = 4, sp = CELL;
      const rows = Math.ceil(data.sides / cols);
      netW = cols * sp;
      netH = rows * sp;
      facePositions = Array.from({ length: data.sides }, (_, fi) => {
        const col = fi % cols;
        const row = Math.floor(fi / cols);
        const rowCount = Math.min(cols, data.sides - row * cols);
        const rowOx = (netW - (rowCount - 1) * sp) / 2;
        return { fx: rowOx + col * sp, fy: row * sp + sp / 2 };
      });
    }

    const hasMaterial = !!data.material;
    const hasAnyRune  = Object.entries(data.runeMap ?? {}).some(
      ([fi, id]) => id && !(data.culledFaces ?? []).includes(parseInt(fi) + 1)
    );
    const matH   = hasMaterial ? 16 : 0;
    const runeH  = hasAnyRune  ? 52 : 0;
    const panelW = netW + 24;
    const panelH = netH + 64 + matH + runeH;

    const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x0a0a1e, 0.96);
    bg.setStrokeStyle(1.5, typeColor, 0.85).setInteractive();
    bg.on('pointerdown', () => this._hideInspector());
    this.inspectorPanel.add(bg);

    const closeBtn = this.add.text(cx + panelW / 2 - 12, cy - panelH / 2 + 14, '✕', {
      fontSize: '17px', color: '#666688',
    }).setOrigin(0.5, 0.5).setInteractive();
    closeBtn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._suppressThrow = true; this._hideInspector(); });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#666688'));
    this.inspectorPanel.add(closeBtn);

    // Die type + sides header
    this.inspectorPanel.add(
      this.add.text(cx, cy - panelH / 2 + 18, `${dt?.label ?? '?'}  d${data.sides}`, {
        fontSize: '17px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5)
    );

    // Material row
    if (hasMaterial) {
      const m = MATERIALS[data.material];
      this.inspectorPanel.add(
        this.add.text(cx, cy - panelH / 2 + 34, `${m.sym}  ${m.label}`, {
          fontSize: '12px', color: m.color,
        }).setOrigin(0.5, 0.5)
      );
    }

    const originX = cx - netW / 2;
    const originY = cy - panelH / 2 + 38 + matH;

    // Rune detail footer — populated when a rune face is tapped
    let runeLbl = null, runeDesc = null;
    if (hasAnyRune) {
      const footerCY = originY + netH + 26;
      const footerBg = this.add.rectangle(cx, footerCY, panelW - 8, 44, 0x0d0d1a);
      footerBg.setStrokeStyle(1, 0x1e1e38, 0.7);
      this.inspectorPanel.add(footerBg);

      runeLbl = this.add.text(cx, footerCY - 8, '◆  tap a rune face', {
        fontSize: '11px', color: '#2a2a44',
      }).setOrigin(0.5, 0.5);
      runeDesc = this.add.text(cx, footerCY + 10, '', {
        fontSize: '11px', color: '#667788', wordWrap: { width: panelW - 24 }, align: 'center',
      }).setOrigin(0.5, 0.5);
      this.inspectorPanel.add(runeLbl);
      this.inspectorPanel.add(runeDesc);
    }

    facePositions.forEach(({ fx, fy }, fi) => {
      const ax         = originX + fx;
      const ay         = originY + fy;
      const faceValue  = fi + 1;
      const isCulled   = (data.culledFaces ?? []).includes(faceValue);
      const dispValue  = Math.floor(fi / 2) + 1;
      const isActive   = fi === currentIdx && !isCulled;
      const runeOnFace = !isCulled ? data.runeMap?.[fi] : null;
      const rune       = runeOnFace ? RUNES[runeOnFace] : null;

      const fb = this.add.rectangle(ax, ay, FACE, FACE,
        isCulled ? 0x0a0a14 : (isActive ? 0x1a2e4a : 0x141428));
      fb.setStrokeStyle(
        isActive ? 2 : 1,
        isCulled ? 0x333344 : (rune ? parseInt(rune.color.replace('#',''), 16) : typeColor),
        isCulled ? 0.25 : (isActive ? 1 : 0.45)
      );
      if (rune) {
        fb.setInteractive();
        fb.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          runeLbl.setText(`${rune.sym}  ${rune.label}`).setColor(rune.color)
            .setFontSize('13px').setFontStyle('bold');
          runeDesc.setText(rune.desc).setColor('#8899aa');
        });
        fb.on('pointerover', () => fb.setFillStyle(isActive ? 0x283e5a : 0x1e2030));
        fb.on('pointerout',  () => fb.setFillStyle(isActive ? 0x1a2e4a : 0x141428));
      }
      this.inspectorPanel.add(fb);
      this.inspectorPanel.add(
        this.add.text(ax, ay, isCulled ? '✕' : String(dispValue), {
          fontSize: '17px',
          color: isCulled ? '#2a2a3a' : (isActive ? (dt?.color ?? '#ffffff') : '#556677'),
          fontStyle: isActive ? 'bold' : 'normal',
          stroke: '#000000', strokeThickness: isActive ? 3 : 1,
        }).setOrigin(0.5, 0.5)
      );

      if (rune) {
        this.inspectorPanel.add(
          this.add.text(ax + 14, ay - 14, rune.sym, {
            fontSize: '9px', color: rune.color,
          }).setOrigin(0.5, 0.5)
        );
      }
    });

  }

  _hideInspector() {
    if (this.inspectorPanel) { this.inspectorPanel.destroy(true); this.inspectorPanel = null; }
  }

  // ─── SETTLE DETECTION ─────────────────────────────────────────────────────

  _waitSettle(cb) {
    let attempts = 0;
    if (this._settleChecker) this._settleChecker.destroy();
    this._settleChecker = this.time.addEvent({
      delay: 220, startAt: 500, loop: true,
      callback: () => {
        attempts++;
        const ok = this.allDice.every(d => {
          const v = d.img?.body?.velocity;
          return !v || (Math.abs(v.x) < SETTLE_VEL && Math.abs(v.y) < SETTLE_VEL);
        });
        if (ok || attempts > 22) {
          this._settleChecker.destroy(); this._settleChecker = null; cb();
        }
      }
    });
  }

  // ─── EFFECT QUEUE ─────────────────────────────────────────────────────────

  _addToEffectQueue(dieRef) {
    const { data } = dieRef;
    const value = Math.floor(data.currentFaceIdx / 2) + 1;
    const type  = dieRef._mimicType ?? data.type;
    const entry = { dieRef, value, type };
    this._effectQueue.push(entry);
    const card = this._createQueueCard(entry, this._queueCards.length);
    this._queueCards.push(card);
  }

  _createQueueCard(entry, stackIdx) {
    const CARD_W = 58;
    const dt  = DIE_TYPES[entry.type] ?? DIE_TYPES['attack'];
    const fc  = parseInt(dt.color.replace('#', ''), 16);
    const yPos = QUEUE_START_Y + stackIdx * (QUEUE_CARD_H + QUEUE_CARD_GAP);

    const container = this.add.container(QUEUE_CARD_X, yPos).setDepth(35);
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 200 });

    const bg = this.add.rectangle(0, 0, CARD_W, QUEUE_CARD_H, 0x0d0d1c);
    bg.setStrokeStyle(2, fc, 0.85);

    const symTxt = this.add.text(0, -12, dt.sym, {
      fontSize: '13px', color: dt.color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    const valTxt = this.add.text(0, 11, String(entry.value), {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    container.add([bg, symTxt, valTxt]);

    const { data } = entry.dieRef;
    const activeRune = data.runeMap?.[data.currentFaceIdx];
    if (activeRune) {
      const rune = RUNES[activeRune];
      const runeLbl = this.add.text(16, -28, rune?.sym ?? '◆', {
        fontSize: '9px', color: rune?.color ?? '#f0c040',
      }).setOrigin(0.5, 0.5);
      container.add(runeLbl);
    }

    return { container };
  }

  _startQueue() {
    this._queueActive = true;
    this._waitSettle(() => {
      if (this._effectQueue.length > 0) this._processQueue();
      else this._queueComplete();
    });
  }

  _processQueue() {
    if (this._effectQueue.length === 0) {
      this._queueComplete();
      return;
    }

    const entry = this._effectQueue.shift();
    // Peek — keep card in _queueCards until fully animated out so new cards
    // added while this one is in-flight get the correct stacking index.
    const card  = this._queueCards[0];

    // Pulse the card to signal it's firing
    card.container.setDepth(36);
    this.tweens.add({
      targets: card.container,
      scaleX: 1.15, scaleY: 1.15,
      duration: 180,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => {
        this._applyDieFaceImmediate(entry.dieRef);

        // Wait long enough for rune delays (e.g. Egyptian's 250ms) to initiate movement
        this.time.delayedCall(800, () => {
          const anyRolling = this.allDice.some(d => d._rolling);

          // Slide card off-screen left and destroy
          this.tweens.add({
            targets: card.container,
            x: -36, alpha: 0,
            duration: 280,
            ease: 'Sine.In',
            onComplete: () => {
              this._queueCards.shift();
              card.container.destroy();
              this._repositionQueueCards();

              if (anyRolling) {
                // Rune caused movement — pause until all dice re-settle
                this._waitSettle(() => this.time.delayedCall(250, () => this._processQueue()));
              } else {
                this.time.delayedCall(250, () => this._processQueue());
              }
            }
          });
        });
      }
    });
  }

  _queueComplete() {
    this._queueActive = false;
    this._throwLocked = false;

    if (this.phase !== PHASE.PLAYER_ROLL) return;

    if (this.throwCount >= this.trayCards.length && !this._autoCommitDone) {
      this._autoCommitDone = true;
      this._showMsg('All dice settled — commit when ready');
      this._showCommitOverlay();
    } else if (this.throwCount < this.trayCards.length) {
      const remaining = this.trayCards.length - this.throwCount;
      this._showMsg(`${remaining} ${remaining === 1 ? 'die' : 'dice'} remaining — drag to throw`);
    }
  }

  _repositionQueueCards() {
    this._queueCards.forEach((card, i) => {
      const targetY = QUEUE_START_Y + i * (QUEUE_CARD_H + QUEUE_CARD_GAP);
      this.tweens.add({
        targets: card.container,
        y: targetY,
        duration: 200,
        ease: 'Sine.Out',
      });
    });
  }

  // ─── WIN / LOSE ───────────────────────────────────────────────────────────

  _victory() {
    this.phase = 99;
    this._setPhase('VICTORY!');
    this._showMsg(`${this.enemyDef.name} defeated!`);
    this.time.delayedCall(1400, () => this.scene.start('UpgradeScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      playerMaxHp:      this.playerMaxHp,
      battleIndex:      this.battleIndex + 1,
      isBossReward:     this.enemyDef.tier === 'boss',
      activeRelics:     this.activeRelics,
    }));
  }

  _gameOver() {
    this.phase = 99;
    this._setPhase('GAME OVER');
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(80);
    this.add.text(W / 2, H / 2 - 28, 'GAME OVER', {
      fontSize: '34px', color: '#e74c3c', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(81);
    this.add.text(W / 2, H / 2 + 28, 'Tap to restart', {
      fontSize: '17px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(81);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(82).setInteractive()
      .on('pointerdown', () => this.scene.start('BattleScene', {}));
  }

  // ─── UI HELPERS ───────────────────────────────────────────────────────────

  _setPhase(txt) { this.phaseTxt?.setText(txt); }
  _showMsg(txt)  { this.battleMsgTxt?.setText(txt); }

  _flashDamage(amount) {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(90);
    this.tweens.add({ targets: flash, fillAlpha: 0.28, duration: 90, yoyo: true, repeat: 1,
      onComplete: () => flash.destroy() });
    const txt = this.add.text(W / 2, 52, `-${amount} HP`, {
      fontSize: '30px', color: '#ff4444', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5, 0.5).setDepth(95).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, y: 36, duration: 200,
      onComplete: () => {
        this.tweens.add({ targets: txt, alpha: 0, y: 20, duration: 700, delay: 500,
          onComplete: () => txt.destroy() });
      }
    });
  }

  _flashHeal(amount) {
    const txt = this.add.text(W / 2, 52, `+${amount} HP`, {
      fontSize: '26px', color: '#2ecc71', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5, 0.5).setDepth(95).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, y: 36, duration: 200,
      onComplete: () => {
        this.tweens.add({ targets: txt, alpha: 0, y: 20, duration: 700, delay: 500,
          onComplete: () => txt.destroy() });
      }
    });
  }

  _flashEnemyDamage(amount) {
    const { x, y } = this.enemyPos;
    const txt = this.add.text(x, y - ENEMY_BUMPER_R - 20, `-${amount}`, {
      fontSize: '22px', color: '#ffaaaa', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0.5).setDepth(95).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, y: y - ENEMY_BUMPER_R - 36, duration: 200,
      onComplete: () => {
        this.tweens.add({ targets: txt, alpha: 0, duration: 600, delay: 400,
          onComplete: () => txt.destroy() });
      }
    });
  }

  _pulseCommit() {
    let on = true;
    this.time.addEvent({
      delay: 400, repeat: 5,
      callback: () => { on = !on; this.commitBg.setFillStyle(on ? 0x27ae60 : 0x163824); }
    });
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  update() {
    const now = this.time.now;
    this.allDice.forEach(d => {
      if (!d.img?.active) return;
      d.lbl.setPosition(d.img.x, d.img.y - 7);
      d.valLbl.setPosition(d.img.x, d.img.y + 7);

      if (!d._rolling) return;

      const vel    = d.img.body?.velocity;
      if (!vel) return;
      const speed  = Math.hypot(vel.x, vel.y);
      const angVel = Math.abs(d.img.body.angularVelocity ?? 0);
      const motion = speed + angVel * 20;

      if (motion < SETTLE_VEL) {
        d._rolling = false;
        if (d.isPlayer) {
          const dt = DIE_TYPES[d.data.type];
          d.lbl.setText(String(Math.floor(d._finalFaceIdx / 2) + 1));
          d.lbl.setColor(dt ? dt.color : '#ffffff');
          d.valLbl.setText('');
          this._addToEffectQueue(d);
          if (!this._queueActive) this._startQueue();
          this.relicManager.onSettle(d);
        } else if (d.data.faces) {
          const finalFace   = FACES[d.data.faces[d._finalFaceIdx]];
          const fShowVal    = finalFace?.effect === 'enemy_damage' || finalFace?.effect === 'enemy_block';
          d.lbl.setText((fShowVal && finalFace.value !== undefined) ? String(finalFace.value) : (finalFace ? finalFace.sym : '--'));
          d.lbl.setColor(finalFace ? finalFace.color : '#ffffff');
          d.valLbl.setText(fShowVal ? '' : (finalFace?.value !== undefined ? String(finalFace.value) : ''));
        }
        // obstacle dice: just show '--', no shield, no effects
      } else {
        const interval = Math.max(40, 250 / motion);
        if (now - d._lastCycleMs > interval) {
          d._lastCycleMs = now;
          if (d.isPlayer) {
            const dt = DIE_TYPES[d.data.type];
            const active = this._getActiveFaceIndices(d.data);
            const randIdx = active[Phaser.Math.Between(0, active.length - 1)];
            d.lbl.setText(String(Math.floor(randIdx / 2) + 1));
            d.lbl.setColor(dt ? dt.color : '#ffffff');
            d.valLbl.setText('');
          } else {
            if (!d.data.faces) return; // obstacle die — no face cycling
            const randFace  = FACES[d.data.faces[Phaser.Math.Between(0, d.data.faces.length - 1)]];
            const rShowVal  = randFace?.effect === 'enemy_damage' || randFace?.effect === 'enemy_block';
            d.lbl.setText((rShowVal && randFace.value !== undefined) ? String(randFace.value) : (randFace ? randFace.sym : '--'));
            d.lbl.setColor(randFace ? randFace.color : '#ffffff');
            d.valLbl.setText(rShowVal ? '' : (randFace?.value !== undefined ? String(randFace.value) : ''));
          }
        }
      }
    });
  }
}
