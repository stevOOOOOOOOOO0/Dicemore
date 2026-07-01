import Phaser from 'phaser';
import { FACES, ENEMIES, BATTLE_SEQUENCE } from '../data/faces.js';
import { DIE_TYPES, STARTER_DICE } from '../data/dice.js';
import { RUNES, MATERIALS } from '../data/runes.js';
import {
  W, H, SURFACE_TOP, SURFACE_BOTTOM, DIE_SIZE, WALL_T, DIE_STRIP_Y,
  DIE_FRICTION, DIE_FRICTION_AIR, DIE_BOUNCE, SETTLE_VEL,
  MAX_THROW_SPEED, PLAYER_MAX_HP, FONT_DISPLAY
} from '../constants.js';
import RelicManager from '../systems/RelicManager.js';
import EventBus from '../systems/EventBus.js';
import { RUNE_HANDLERS } from '../systems/RuneRegistry.js';
import { UPGRADE_MAP, UPGRADE_DESCRIPTIONS } from '../data/upgrades.js';
import { COLORS, RADIUS, hexNum } from '../ui/theme.js';
import SaveManager from '../systems/SaveManager.js';
import StatsManager from '../systems/StatsManager.js';

const PHASE = { PREP: 0, ENEMY_ROLL: 1, PLAYER_ROLL: 2, COMMIT: 3 };
const ENEMY_DIE_TYPE_COLORS = { attack: '#e74c3c', block: '#3498db', strength: '#e67e22', vulnerable: '#bb44cc', frail: '#1abc9c' };
const ENEMY_DIE_TYPE_SYMS   = { attack: 'ATK', block: 'BLK', strength: 'STR', vulnerable: 'VUL', frail: 'FRL' };

const ABILITY_INFO = {
  bumper_enrage:   { name: 'ENRAGE',         desc: 'Each time you hit my bumper, I gain permanent Strength.' },
  flat_reduction:  { name: 'FLAT DRAIN',     desc: 'All your dice roll lower — every value reduced by {v}.' },
  glass_curse:     { name: 'GLASS CURSE',    desc: 'Your dice are Glass this round — they shatter on first contact.' },
  contact_drain:   { name: 'CONTACT DRAIN',  desc: 'Every collision shaves −1 off that die\'s value.' },
  obstacle_buff:   { name: 'OBSTACLE BUFF',  desc: 'Each obstacle hit feeds me permanent Strength.' },
  bouncy_bumpers:  { name: 'ULTRA BOUNCE',   desc: 'My bumper launches dice at double force — impossible to aim into.' },
  sticky_walls:    { name: 'STICKY WALLS',   desc: 'Walls absorb all momentum — dice stop dead on contact.' },
  bullet_throws:   { name: 'BULLET THROWS',  desc: 'Your minimum throw speed is locked to max — no soft tosses.' },
};

const INTENT = {
  attack:     { label: 'ATTACK',  color: '#e74c3c' },
  block:      { label: 'BLOCK',   color: '#3498db' },
  strength:   { label: 'LOADED',  color: '#e67e22', hint: '+STR' },
  vulnerable: { label: 'HUSTLE',  color: '#bb44cc', hint: '+DMG' },
  frail:      { label: 'RATTLE',  color: '#1abc9c', hint: '−DEF' },
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
    this.battleIndex    = data.battleIndex  ?? 0;
    this.playerHp       = data.playerHp     ?? PLAYER_MAX_HP;
    this.playerMaxHp    = data.playerMaxHp  ?? PLAYER_MAX_HP;
    this.activeRelics   = data.activeRelics ?? [];
    this.playerGold     = data.playerGold   ?? 0;
    this.cullCount      = data.cullCount    ?? 0;
    this.witchRunes     = data.witchRunes   ?? [];
    this._enemyKeyOverride = data.enemyKey  ?? null;
    this._tutorialMode     = data.tutorial  ?? false;
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  create() {
    if (!this._tutorialMode) this._autosave();

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

    this.pot                 = 0;
    this.poisonStacks        = 0;
    this.enemyStrength       = 0;
    this.vulnerable          = 0;
    this.cleanBonus          = 0;
    this.enemyPoisonStacks   = 0;
    this.enemyWeakened          = false;
    this.enemyVulnerable        = false;
    this.playerFrail            = 0;
    this.enemyBlock             = 0;
    this._pendingEnemyBlock     = 0;
    this._lastIntentWasPassive  = false;
    this.currentIntent          = null;
    this.turnCount              = 0;
    this.statusDamageBonus      = false;
    this._suppressPoisonDecay   = false;
    this._prevQueueEffect       = null;
    this._currQueueEffect       = null;
    this.playerSettleCount      = 0;
    this._omenValue             = null;
    this._luckyCoinUsed         = false;
    this.turnAttackBonus        = 0;
    this._cannonballUsed        = false;
    this._nextThrowSpeedBonus   = 0;
    this._ashenActive           = false;
    this._intentPopup        = null;
    this._relicPopup         = null;
    this._webViewActive      = false;
    this._webViewGfx         = null;
    this._webViewLabels      = [];
    this._webViewDim         = null;

    this._reductionStacks    = 0;
    this._settledValuesThisTurn = [];
    this._mines              = [];

    this._abilityCleanup      = [];
    this._obstacleBuffPerHit  = 0;
    this._contactDrainActive  = false;
    this._bumperEnragePerHit  = 0;
    this._playerDiceReduction = 0;
    this._minThrowOverride    = 0;
    this._maxThrowOverride    = 0;
    this._glassCurseActive    = false;

    this.trayCards          = [];
    this.throwCount         = 0;
    this._dragCard    = null;
    this._dragOffsetX = 0;
    this._dragMoved   = false;
    this._downDieRef        = null;
    this._downOnEnemyBumper = false;
    this._downOnPlayerBumper = false;

    this.enemyPos           = { x: W / 2, y: 270 };
    this.enemyPhysicsBody   = null;
    this.enemyCharContainer = null;
    this._enemyHpBarGfx     = null;
    this._enemyHpTxt        = null;
    this.playerGfx          = null;
    this.playerPhysicsBody  = null;
    this._playerPillsCont   = null;
    this._playerStatusPopup = null;

    const key = this._enemyKeyOverride ?? BATTLE_SEQUENCE[this.battleIndex % BATTLE_SEQUENCE.length];
    this.enemyDef = ENEMIES[key];
    this.enemyHp  = this.enemyDef.hp;

    this.bus = new EventBus();
    this.relicManager = new RelicManager(this, this.bus);
    this.activeRelics.forEach(r => this.relicManager.addRelic(r));

    this._makeTextures();
    this._buildBackground();
    this._buildWalls();
    this._buildHeaderStrip();
    this._buildRelicStrip();
    this._buildEnemyCharacter();
    this._buildPlayerCharacter();
    this._processSpecialistSwarm();
    this._buildDieStrip();
    this._buildCommitOverlay();
    this._setupCollisions();
    this._setupPointer();

    if (this._tutorialMode) this._initTutorial();
    this.time.delayedCall(400, () => this._startTurn());

    // Danger overlay — pulses red when HP is critical
    this._dangerOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff1100, 0).setDepth(1);
    this._dangerTween   = null;

    this.cameras.main.fadeIn(350, 0, 0, 0);
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
    const opt = { isStatic: true, label: 'wall', friction: 0, frictionStatic: 0, restitution: 0.925,
                  collisionFilter: { category: 0x0020, mask: 0xFFFFFFFF } };
    const cy  = (SURFACE_TOP + SURFACE_BOTTOM) / 2;
    const sh  = SURFACE_BOTTOM - SURFACE_TOP + WALL_T * 2;
    this._wallBodies = [
      this.matter.add.rectangle(-WALL_T / 2,    cy, WALL_T, sh, opt),
      this.matter.add.rectangle(W + WALL_T / 2, cy, WALL_T, sh, opt),
      this.matter.add.rectangle(W / 2, SURFACE_TOP    - WALL_T / 2, W + WALL_T * 2, WALL_T, opt),
      this.matter.add.rectangle(W / 2, SURFACE_BOTTOM + WALL_T / 2, W + WALL_T * 2, WALL_T, opt),
    ];
  }

  _buildHeaderStrip() {
    const mid = SURFACE_TOP / 2;
    this.phaseTxt     = this.add.text(W / 2, mid - 16, '', { fontSize: '17px', color: '#5a7a8a', letterSpacing: 3, fontFamily: FONT_DISPLAY }).setOrigin(0.5, 0.5);
    this.battleMsgTxt = this.add.text(W / 2, mid + 16, '', { fontSize: '17px', color: '#ffffff', wordWrap: { width: W - 60 }, fontFamily: FONT_DISPLAY }).setOrigin(0.5, 0.5);
    this.potLabelTxt  = this.add.text(W - 8, 6, 'POT', { fontSize: '10px', color: '#8b7a40', letterSpacing: 1, fontFamily: FONT_DISPLAY }).setOrigin(1, 0);
    this.potTxt       = this.add.text(W - 8, 18, '0', { fontSize: '22px', color: '#f0c040', fontStyle: 'bold', fontFamily: FONT_DISPLAY }).setOrigin(1, 0);

    // Quit button — top-left of header strip
    const qbx = 14, qby = 14;
    const qbCircle = this.add.circle(qbx, qby, 11, 0x1a1a2a, 0.95).setDepth(25).setInteractive();
    qbCircle.setStrokeStyle(1.5, 0x445566, 0.8);
    this.add.text(qbx, qby, '✕', {
      fontSize: '11px', color: '#6a8a9a',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(26);
    qbCircle.on('pointerdown', () => this._showQuitConfirm());

    // Info button — bottom-right of header strip
    const ibx = W - 14, iby = 62;
    const ibCircle = this.add.circle(ibx, iby, 11, 0x1a2a44, 0.95).setDepth(25).setInteractive();
    ibCircle.setStrokeStyle(1.5, 0x4477bb, 0.9);
    this.add.text(ibx, iby, 'i', {
      fontSize: '13px', color: '#88aadd', fontStyle: 'bold italic',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(26);
    ibCircle.on('pointerdown', () => this._showHowToPlay());

    this._refreshStatusUI();
  }

  _showQuitConfirm() {
    if (this._quitPanel) return;

    const cx = W / 2, cy = H / 2;
    const pop = this._quitPanel = this.add.container(0, 0).setDepth(95);

    const dim = this.add.rectangle(cx, cy, W, H, 0x000000, 0.7).setInteractive();
    pop.add(dim);

    const panelW = 240, panelH = 110;
    const panel = this.add.graphics();
    panel.fillStyle(hexNum(COLORS.panelVoid), 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, RADIUS.soft);
    panel.lineStyle(2, hexNum('#445566'), 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, RADIUS.soft);
    pop.add(panel);

    pop.add(this.add.text(cx, cy - 30, 'Quit run?', {
      fontSize: '17px', color: '#ccddee', fontStyle: 'bold', fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5, 0.5));

    const self = this;
    function close() { self._quitPanel?.destroy(); self._quitPanel = null; }

    const yesBtn = this.add.text(cx - 44, cy + 18, 'QUIT', {
      fontSize: '14px', color: '#ee6644', fontStyle: 'bold', fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5, 0.5);
    const yesGfx = this.add.graphics();
    yesGfx.fillStyle(hexNum('#1a0a08'), 1);
    yesGfx.fillRoundedRect(cx - 44 - yesBtn.width / 2 - 16, cy + 18 - yesBtn.height / 2 - 7, yesBtn.width + 32, yesBtn.height + 14, RADIUS.soft);
    pop.add(yesGfx);
    yesBtn.setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => {
      close();
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HomeScene'));
    });
    pop.add(yesBtn);

    const noBtn = this.add.text(cx + 44, cy + 18, 'KEEP GOING', {
      fontSize: '14px', color: '#4488aa', fontStyle: 'bold', fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5, 0.5);
    const noGfx = this.add.graphics();
    noGfx.fillStyle(hexNum('#08141a'), 1);
    noGfx.fillRoundedRect(cx + 44 - noBtn.width / 2 - 16, cy + 18 - noBtn.height / 2 - 7, noBtn.width + 32, noBtn.height + 14, RADIUS.soft);
    pop.add(noGfx);
    noBtn.setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', close);
    pop.add(noBtn);

    dim.on('pointerdown', close);
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

    const relicPanelGfx = this.add.graphics();
    relicPanelGfx.fillStyle(hexNum(COLORS.cardDark), 1);
    relicPanelGfx.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, RADIUS.soft);
    relicPanelGfx.lineStyle(2, rarCol, 0.9);
    relicPanelGfx.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, RADIUS.soft);
    pop.add(relicPanelGfx);

    const dotX = panelX - panelW / 2 + 22;
    pop.add(this.add.circle(dotX, panelY - 18, 10, fc, 0.9));
    pop.add(this.add.text(dotX, panelY - 18, relic.name[0].toUpperCase(), {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    pop.add(this.add.text(dotX + 18, panelY - 20, relic.name, {
      fontSize: '16px', color: relic.color, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    pop.add(this.add.text(dotX + 18, panelY - 3, relic.rarity.toUpperCase(), {
      fontSize: '10px', color: '#567090', letterSpacing: 1,
    }).setOrigin(0, 0.5));
    pop.add(this.add.text(panelX - panelW / 2 + 14, panelY + 18, relic.description, {
      fontSize: '13px', color: '#8899aa', wordWrap: { width: panelW - 28 },
    }).setOrigin(0, 0.5));
  }

  _showHowToPlay() {
    if (this._howToPlayPanel) return;

    const cx = W / 2, cy = H / 2;
    const panelW = W - 28, panelH = H - 80;

    const pop = this._howToPlayPanel = this.add.container(0, 0).setDepth(90);

    // Dim overlay — tap anywhere to close
    const dim = this.add.rectangle(cx, cy, W, H, 0x000000, 0.75).setInteractive();
    dim.on('pointerdown', close);
    pop.add(dim);

    // Panel background + border
    const panel = this.add.graphics();
    panel.fillStyle(hexNum(COLORS.panelVoid), 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, RADIUS.soft);
    panel.lineStyle(2, hexNum('#2255aa'), 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, RADIUS.soft);
    pop.add(panel);

    // Title
    pop.add(this.add.text(cx, cy - panelH / 2 + 20, 'HOW TO PLAY', {
      fontSize: '17px', color: '#aaccff', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5, 0.5));

    // Content
    const LEFT   = cx - panelW / 2 + 16;
    const WRAP_W = panelW - 32;
    const sections = [
      { head: 'THROWING DICE' },
      '• Drag from the field upward to aim, release to throw',
      '• Dice bounce off walls and bumpers before settling',
      '• Each die in your tray throws one at a time, left to right',
      { head: 'DIE TYPES' },
      '• Attack — deal damage equal to the rolled value',
      '• Block — absorb that much incoming damage this turn',
      '• Buff — boost every die that settles after this one',
      '• Poison — apply stacks to the enemy; each stack deals 1 damage per turn',
      { head: 'BUMPERS' },
      '• Hitting the enemy bumper deals 1 chip damage and rerolls the die',
      '• More bounces = more chip hits and more rerolls',
      '• The enemy bumper may have passive abilities — check their icon',
      { head: 'ENEMY TURN' },
      '• After you COMMIT, the enemy throws their own dice',
      '• Attack dice reduce your HP minus your current block',
      '• Block dice shield the enemy from damage next turn',
      '• Strength dice permanently increase the enemy\'s attack',
      { head: 'UPGRADES' },
      '• Win battles to earn upgrade offers between rounds',
      '• Each upgrade targets one die and is permanent for the run',
      '• Tap any tray card before throwing to inspect its upgrades',
    ];

    let yPos = cy - panelH / 2 + 50;
    sections.forEach(item => {
      if (typeof item === 'object') {
        pop.add(this.add.text(LEFT, yPos, item.head, {
          fontSize: '10px', color: '#ffcc44', fontStyle: 'bold', letterSpacing: 2,
        }).setOrigin(0, 0.5));
        yPos += 18;
      } else {
        const t = this.add.text(LEFT + 4, yPos, item, {
          fontSize: '11px', color: '#99aabb', wordWrap: { width: WRAP_W },
        }).setOrigin(0, 0);
        pop.add(t);
        yPos += t.height + 4;
      }
    });

    // Close button
    const closeBtn = this.add.text(cx, cy + panelH / 2 - 22, 'CLOSE', {
      fontSize: '14px', color: '#4488ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const closeGfx = this.add.graphics();
    closeGfx.fillStyle(hexNum('#111a2e'), 1);
    closeGfx.fillRoundedRect(
      cx - closeBtn.width / 2 - 24, cy + panelH / 2 - 22 - closeBtn.height / 2 - 7,
      closeBtn.width + 48, closeBtn.height + 14, RADIUS.soft,
    );
    pop.add(closeGfx);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', close);
    pop.add(closeBtn);

    const self = this;
    function close() {
      self._howToPlayPanel?.destroy();
      self._howToPlayPanel = null;
    }
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
    this._intentTxt = this.add.text(0, -7, '', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(this._intentTxt);

    // Mechanical hint below main intent label (decodes LOADED/HUSTLE/RATTLE)
    this._intentHintTxt = this.add.text(0, 7, '', {
      fontSize: '9px', color: '#aaaacc',
      stroke: '#000000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(this._intentHintTxt);

    // Enemy name above circle
    const nameTxt = this.add.text(0, -R - 16, this.enemyDef.name.toUpperCase(), {
      fontSize: '17px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 2,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(nameTxt);

    // Tap zone
    const tapZone = this.add.rectangle(0, 0, (R + 24) * 2, (R + 48) * 2, 0xffffff, 0).setInteractive();
    tapZone.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this._downOnEnemyBumper = true;
      if (this.phase === PHASE.PLAYER_ROLL && !this._throwLocked && !this.inspectorPanel && this.throwCount < this.trayCards.length) {
        this.aimActive  = true;
        this._aimStartX = ptr.x;
        this._aimStartY = ptr.y;
      }
    });
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

    this._enemyPillsCont = this.add.container(0, R + 26);
    this.enemyCharContainer.add(this._enemyPillsCont);

    this.tweens.add({ targets: glow, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1 });

    this._refreshEnemyCharacter();
    this._createEnemyPhysicsBody();
    this._buildBumperDecoys();
  }

  _buildBumperDecoys() {
    this._decoyBumpers = [];
    if (!this.relicManager.active.some(r => r.id === 'bumper_decoy')) return;
    const R   = ENEMY_BUMPER_R;
    const col = parseInt(this.enemyDef.color.replace('#', ''), 16);
    // Place two fakes symmetrically, flanking the real bumper
    const positions = [
      { x: 90,  y: 262 },
      { x: 310, y: 262 },
    ];
    positions.forEach(pos => {
      const cont = this.add.container(pos.x, pos.y).setDepth(14);

      const glow = this.add.graphics();
      glow.lineStyle(4, col, 0.3);
      glow.strokeCircle(0, 0, R + 10);
      cont.add(glow);

      const bg = this.add.graphics();
      bg.fillStyle(0x080814, 0.92);
      bg.fillCircle(0, 0, R);
      cont.add(bg);

      const ring = this.add.graphics();
      ring.lineStyle(2, col, 0.9);
      ring.strokeCircle(0, 0, R);
      cont.add(ring);

      const intentTxt = this.add.text(0, -3, '?', {
        fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5, 0.5);
      cont.add(intentTxt);

      const nameTxt = this.add.text(0, -R - 16, this.enemyDef.name.toUpperCase(), {
        fontSize: '17px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 2
      }).setOrigin(0.5, 0.5);
      cont.add(nameTxt);

      this.tweens.add({ targets: glow, alpha: 0.3, duration: 1100 + Math.random() * 200, yoyo: true, repeat: -1 });
      this._decoyBumpers.push(cont);
    });
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

    this._enemyHpTxt?.setText(`${Math.max(0, this.enemyHp)}`);

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

    this._refreshEnemyPills();
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

  _calcIntentDamage(baseValue) {
    let dmg = baseValue + (this.enemyStrength ?? 0);
    if (this.vulnerable > 0) dmg = Math.ceil(dmg * 1.5);
    if (this.enemyWeakened)  dmg = Math.floor(dmg * 0.5);
    return dmg;
  }

  _refreshIntentDisplay() {
    if (!this._intentTxt) return;
    if (!this.currentIntent) {
      this._intentTxt.setText('');
      this._intentHintTxt?.setText('');
      return;
    }
    const intent = this.currentIntent;
    if (intent.type === 'multi') {
      const parts = intent.intents.map(sub => {
        if (sub.type === 'attack') return `ATK ${this._calcIntentDamage(sub.value)}`;
        if (sub.type === 'block')  return `BLK ${sub.value}`;
        const cfg = INTENT[sub.type];
        return cfg ? cfg.label : sub.type.toUpperCase();
      });
      this._intentTxt.setText(parts.join('\n'));
      this._intentTxt.setColor('#ffffff');
      this._intentHintTxt?.setText('');
    } else {
      const cfg = INTENT[intent.type];
      if (cfg) {
        let label = cfg.label;
        if (intent.type === 'attack') {
          label = `ATK ${this._calcIntentDamage(intent.value)}`;
        } else if (intent.type === 'block') {
          label = `BLK ${intent.value}`;
        } else if (intent.value !== undefined) {
          label = `${cfg.label} +${intent.value}`;
        }
        this._intentTxt.setText(label);
        this._intentTxt.setColor(cfg.color);
        this._intentHintTxt?.setText(cfg.hint ?? '');
        this._intentHintTxt?.setColor(cfg.color ?? '#aaaacc');
      } else {
        this._intentTxt.setText(intent.type.toUpperCase());
        this._intentTxt.setColor('#ffffff');
        this._intentHintTxt?.setText('');
      }
    }

    // Pop the bumper to draw attention to the new intent
    if (this.enemyCharContainer) {
      this.tweens.killTweensOf(this.enemyCharContainer);
      this.enemyCharContainer.setScale(1);
      this.tweens.add({
        targets: this.enemyCharContainer,
        scaleX: 1.1, scaleY: 1.1,
        duration: 120, yoyo: true, ease: 'Sine.Out',
      });
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
    const panelH = 44 + lines.length * 22 + 16;
    const panelW = 280;

    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(hexNum('#0d0d1e'), 0.97);
    bgGfx.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.soft);
    bgGfx.lineStyle(1.5, parseInt(this.enemyDef.color.replace('#', ''), 16), 0.7);
    bgGfx.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.soft);
    this._intentPopup.add(bgGfx);
    const bgHit = this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0).setInteractive();
    bgHit.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._hideIntentPopup(); });
    this._intentPopup.add(bgHit);

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
  }

  _hideIntentPopup() {
    if (!this._intentPopup) return;
    this._intentPopup.destroy(true);
    this._intentPopup = null;
  }

  // ─── WEB VIEW (enemy dice overlay) ───────────────────────────────────────

  _toggleWebView() {
    if (this._webViewActive) this._hideWebView();
    else this._showWebView();
  }

  _showWebView() {
    if (this._webViewActive) return;
    this._webViewActive = true;

    const combatDice = this.enemyDice.filter(d => d._isEnemyCombatDie && d.img?.active);
    const eCol = parseInt(this.enemyDef.color.replace('#', ''), 16);

    this._webViewGfx = this.add.graphics().setDepth(50);

    combatDice.forEach(eDie => {
      const dx = eDie.img.x;
      const dy = eDie.img.y;
      this._webViewGfx.lineStyle(2, eCol, 0.55);
      this._webViewGfx.beginPath();
      this._webViewGfx.moveTo(this.enemyPos.x, this.enemyPos.y);
      this._webViewGfx.lineTo(dx, dy);
      this._webViewGfx.strokePath();
      this._webViewGfx.lineStyle(3, eCol, 0.8);
      this._webViewGfx.strokeCircle(dx, dy, DIE_SIZE / 2 + 8);

      const value = (Math.floor(eDie.data.currentFaceIdx / 2) + 1) * 2;
      const sym   = ENEMY_DIE_TYPE_SYMS[eDie.data.type] ?? '?';
      const lbl   = this.add.text(dx, dy - DIE_SIZE / 2 - 10, `${sym} ${value}`, {
        fontSize: '13px', color: this.enemyDef.color, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(51);
      this._webViewLabels.push(lbl);
    });

    // Ability card — shown whenever this enemy has passive abilities
    const abilities = this.enemyDef.abilities ?? [];
    if (abilities.length > 0) {
      const cardW = 260, lineH = 38, padY = 14, padX = 16;
      const cardH = padY * 2 + abilities.length * lineH;
      const cardX = W / 2;
      const cardY = this.enemyPos.y + 72;

      const cardBg = this.add.graphics().setDepth(52);
      cardBg.fillStyle(hexNum('#0a0a18'), 0.92);
      cardBg.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, RADIUS.soft);
      cardBg.lineStyle(1, eCol, 0.6);
      cardBg.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, RADIUS.soft);
      this._webViewLabels.push(cardBg);

      abilities.forEach((ab, i) => {
        const info = ABILITY_INFO[ab.id];
        if (!info) return;
        const lineY = cardY - cardH / 2 + padY + i * lineH + lineH / 2;

        const desc = info.desc.replace('{v}', ab.value ?? '?');
        const nameTxt = this.add.text(cardX - cardW / 2 + padX, lineY - 7, info.name, {
          fontSize: '11px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5).setDepth(53);
        const descTxt = this.add.text(cardX - cardW / 2 + padX, lineY + 8, desc, {
          fontSize: '10px', color: '#99aabb',
          wordWrap: { width: cardW - padX * 2 },
        }).setOrigin(0, 0.5).setDepth(53);
        this._webViewLabels.push(nameTxt, descTxt);
      });
    }

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(49).setInteractive();
    dim.on('pointerdown', () => this._hideWebView());
    this._webViewDim = dim;
  }

  _hideWebView() {
    this._webViewActive = false;
    this._webViewGfx?.destroy();
    this._webViewGfx = null;
    this._webViewLabels.forEach(l => l?.destroy());
    this._webViewLabels = [];
    this._webViewDim?.destroy();
    this._webViewDim = null;
    if (this._tutorialMode && this._tutStep === 2) this._tutIntentViewed = true;
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
        const dmg = this._calcIntentDamage(sub.value);
        const hasModifiers = this.enemyStrength > 0 || this.vulnerable > 0 || this.enemyWeakened;
        if (hasModifiers) {
          const notes = [`${sub.value} base`];
          if (this.enemyStrength > 0) notes.push(`+${this.enemyStrength} loaded`);
          if (this.vulnerable > 0)    notes.push(`+50% distracted`);
          if (this.enemyWeakened)     notes.push(`−50% weakened`);
          return [{ text: `Attack  ${dmg} chips  (${notes.join(', ')})`, color: '#e74c3c' }];
        }
        return [{ text: `Attack  ${dmg} chips`, color: '#e74c3c' }];
      }
      case 'block':
        return [{ text: `Block  ${sub.value} chips next turn`, color: '#3498db' }];
      case 'strength':
        return [{ text: `Loaded dice  (+${sub.value} to all steals)`, color: '#e67e22' }];
      case 'vulnerable':
        return [{ text: `Hustle you  (+25% chips stolen from you)`, color: '#bb44cc' }];
      case 'frail':
        return [{ text: `Rattle you  (−25% protection)`, color: '#1abc9c' }];
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
    hitZone.on('pointerdown', () => {
      this._downOnPlayerBumper = true;
    });

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

  _siphonHeal(dmg) {
    this.relicManager.onSiphonDamage(dmg);
  }

  _addToPot(amount) {
    if (amount <= 0) return;
    this.pot += amount;
    this.potTxt?.setText(`${this.pot}`);
  }

  _refreshStatusUI() {
    const hp = Math.max(0, this.playerHp);
    this.playerHpTxt?.setText(`${hp} / ${this.playerMaxHp}`);
    this.potTxt?.setText(`${this.pot}`);

    // Danger pulse: start when HP ≤ 25% of max, stop when recovered
    const dangerThreshold = Math.ceil(this.playerMaxHp * 0.25);
    if (hp > 0 && hp <= dangerThreshold) {
      if (!this._dangerTween?.isPlaying()) {
        this._dangerTween?.stop();
        this._dangerOverlay?.setAlpha(0);
        this._dangerTween = this.tweens.add({
          targets: this._dangerOverlay, alpha: 0.10,
          duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
      }
    } else {
      this._dangerTween?.stop();
      this._dangerTween = null;
      this._dangerOverlay?.setAlpha(0);
    }
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
    if (this.cleanBonus > 0)
      active.push({ label: `BUF +${this.cleanBonus}`, color: '#ff9900' });
    if (this.poisonStacks > 0)
      active.push({ label: `☠ ${this.poisonStacks}`, color: '#58d68d' });
    if (this.playerFrail > 0)
      active.push({ label: `FRAIL ×${this.playerFrail}`, color: '#1abc9c' });
    if (this.vulnerable > 0)
      active.push({ label: `DISTRACTED ×${this.vulnerable}`, color: '#bb44cc' });
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
      const bg = this.add.graphics();
      bg.fillStyle(fc, 0.2);
      bg.fillRoundedRect(cx, -PILL_H / 2, pw, PILL_H, RADIUS.soft);
      bg.lineStyle(1.5, fc, 0.75);
      bg.strokeRoundedRect(cx, -PILL_H / 2, pw, PILL_H, RADIUS.soft);
      txts[i].setPosition(cx + PAD, 0);
      this._playerPillsCont.add([bg, txts[i]]);
      cx += pw + GAP;
    });
  }

  _refreshEnemyPills() {
    if (!this._enemyPillsCont) return;
    this._enemyPillsCont.removeAll(true);

    const active = [];
    if (this.enemyPoisonStacks > 0)
      active.push({ label: `☠ ${this.enemyPoisonStacks}`, color: '#58d68d' });
    if (this.enemyStrength > 0)
      active.push({ label: `LOADED +${this.enemyStrength}`, color: '#e67e22' });
    if (this.enemyWeakened)
      active.push({ label: 'WEAK', color: '#9b59b6' });
    if (this.enemyVulnerable)
      active.push({ label: 'EXPOSED', color: '#e74c3c' });
    if (active.length === 0) return;

    const PILL_H = 16, PAD = 6, GAP = 4;
    const txts = active.map(s => this.add.text(0, 0, s.label, {
      fontSize: '10px', color: s.color, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const widths = txts.map(t => t.width + PAD * 2);
    const totalW = widths.reduce((a, b) => a + b, 0) + GAP * (active.length - 1);
    let cx = -totalW / 2;

    active.forEach((s, i) => {
      const pw = widths[i];
      const fc = parseInt(s.color.replace('#', ''), 16);
      const bg = this.add.graphics();
      bg.fillStyle(fc, 0.2);
      bg.fillRoundedRect(cx, -PILL_H / 2, pw, PILL_H, RADIUS.soft);
      bg.lineStyle(1.5, fc, 0.75);
      bg.strokeRoundedRect(cx, -PILL_H / 2, pw, PILL_H, RADIUS.soft);
      txts[i].setPosition(cx + PAD, 0);
      this._enemyPillsCont.add([bg, txts[i]]);
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
    if (this.cleanBonus > 0)
      rows.push({ label: `Buff  +${this.cleanBonus}`, color: '#ff9900',
        desc: `All your dice deal +${this.cleanBonus} bonus this turn. Resets next turn.` });
    if (this.poisonStacks > 0)
      rows.push({ label: `Poison  ☠ ${this.poisonStacks}`, color: '#58d68d',
        desc: `Lose ${this.poisonStacks} HP at the start of your turn. Decreases by 1 each turn.` });
    if (this.playerFrail > 0)
      rows.push({ label: `Frail  ×${this.playerFrail}`, color: '#1abc9c',
        desc: `Your dice deal half damage. ${this.playerFrail} turn${this.playerFrail > 1 ? 's' : ''} remaining.` });
    if (this.vulnerable > 0)
      rows.push({ label: `Distracted  ×${this.vulnerable}`, color: '#bb44cc',
        desc: `You take 50% more chips stolen. ${this.vulnerable} turn${this.vulnerable > 1 ? 's' : ''} remaining.` });
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
      fontSize: '12px', color: '#5a7a8a', letterSpacing: 2,
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
          // Glass material OR Glass upgrade: shatters on first die contact, triggers 2×
          const glassA = dA.isPlayer && (dA.data.material === 'glass' || this._hasDieUpgrade(dA.data, 'glass') || dA._cursedGlass);
          const glassB = dB.isPlayer && (dB.data.material === 'glass' || this._hasDieUpgrade(dB.data, 'glass') || dB._cursedGlass);
          if (glassA && !dA._destroyTriggered) {
            dA._destroyTriggered = true;
            this._floatText(dA.img?.x ?? 0, (dA.img?.y ?? 0) - 24, 'GLASS!', '#ff6633');
            this._applyDieFaceImmediate(dA, true, null, null, true);
            this._applyDieFaceImmediate(dA, true, null, null, true);
            this._shatterDie(dA);
            // Force-settle the hit die so its effect also fires
            this._forceSettleDie(dB);
          }
          if (glassB && !dB._destroyTriggered) {
            dB._destroyTriggered = true;
            this._floatText(dB.img?.x ?? 0, (dB.img?.y ?? 0) - 24, 'GLASS!', '#ff6633');
            this._applyDieFaceImmediate(dB, true, null, null, true);
            this._applyDieFaceImmediate(dB, true, null, null, true);
            this._shatterDie(dB);
            // Force-settle the hit die so its effect also fires
            this._forceSettleDie(dA);
          }
          if (glassA || glassB) return;

          // Bulletproof Glass upgrade: track contact hits
          if (dA.isPlayer && this._hasDieUpgrade(dA.data, 'bulletproof_glass')) this._handleBulletproofHit(dA);
          if (dB.isPlayer && this._hasDieUpgrade(dB.data, 'bulletproof_glass')) this._handleBulletproofHit(dB);

          // Destroy Contacts: infect a die on its first touch by the upgrade die.
          // After infection the die shatters after further contacts with ANYTHING
          // (walls, bumpers, any die) — ticked by _tickInfectedContact at each site.
          const dAWasInfected = (dA._infectHits ?? 0) > 0;
          const dBWasInfected = (dB._infectHits ?? 0) > 0;
          const _checkDestroyContacts = (attacker, target) => {
            if (!attacker.isPlayer) return;
            if (!this._hasDieUpgrade(attacker.data, 'destroy_contacts')) return;
            if (!target.img?.active || !this.allDice.includes(target)) return;
            if ((target._infectHits ?? 0) > 0) return; // already infected
            target._infectHits = 1;
            this._applyCrackOverlay(target);
            this._floatText(target.img?.x ?? 0, (target.img?.y ?? 0) - 24, 'INFECTED', '#ff6633');
          };
          _checkDestroyContacts(dA, dB);
          _checkDestroyContacts(dB, dA);
          // Tick already-infected dice — snapshot taken before infection so the
          // same collision that infects doesn't also count as the second hit.
          if (dAWasInfected) this._tickInfectedContact(dA);
          if (dBWasInfected) this._tickInfectedContact(dB);

          // Black Hole: any player die that contacts it during pull is destroyed and triggers max face
          if (dA._blackHole && dB.isPlayer && this.allDice.includes(dB)) {
            this._applyMaxFaceDamage(dB);
            this._shatterDie(dB);
          }
          if (dB._blackHole && dA.isPlayer && this.allDice.includes(dA)) {
            this._applyMaxFaceDamage(dA);
            this._shatterDie(dA);
          }

          // Copy die: remember the last player die type it touched
          if (dA.isPlayer && dA.data.type === 'copy' && dB.isPlayer && dB.data.type !== 'copy') {
            dA._mimicType = dB.data.type;
          }
          if (dB.isPlayer && dB.data.type === 'copy' && dA.isPlayer && dA.data.type !== 'copy') {
            dB._mimicType = dA.data.type;
          }

          if (dA.isPlayer && dA._firstContactedDie === undefined) dA._firstContactedDie = dB;
          if (dB.isPlayer && dB._firstContactedDie === undefined) dB._firstContactedDie = dA;
          if (dA.isPlayer) { if (!dA._contactedDice) dA._contactedDice = new Set(); dA._contactedDice.add(dB); }
          if (dB.isPlayer) { if (!dB._contactedDice) dB._contactedDice = new Set(); dB._contactedDice.add(dA); }
          this.bus.emit('ON_CONTACT_DIE', { dieA: dA, dieB: dB });
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
          // Gravity well: always reroll the die that hit the pinned die
          if (dA._gravityWell && dB.isPlayer && !rerolled.has(dB)) {
            rerolled.add(dB); this._rerollDie(dB);
          }
          if (dB._gravityWell && dA.isPlayer && !rerolled.has(dA)) {
            rerolled.add(dA); this._rerollDie(dA);
          }

          // obstacle_buff: enemy gains strength whenever any die touches an obstacle die
          if (this._obstacleBuffPerHit > 0 && (dA.data?.isObstacle || dB.data?.isObstacle)) {
            this.enemyStrength = (this.enemyStrength ?? 0) + this._obstacleBuffPerHit;
            this._refreshEnemyCharacter();
            this._floatText(this.enemyPos.x, this.enemyPos.y - 30, `+${this._obstacleBuffPerHit} STR`, '#e67e22');
          }
          // contact_drain: each die-die contact reduces value bonus
          if (this._contactDrainActive) {
            if (dA.isPlayer) dA._valueBonus = (dA._valueBonus ?? 0) - 1;
            if (dB.isPlayer) dB._valueBonus = (dB._valueBonus ?? 0) - 1;
          }
          // sign: flip face value on die-die contact
          if (dA.isPlayer) this._applySignToggle(dA);
          if (dB.isPlayer) this._applySignToggle(dB);
          return;
        }

        // Die-bumper: pinball kick + reroll
        const dieRef  = dA || dB;
        const dieBody = dA ? bodyA : bodyB;
        const other   = dA ? bodyB : bodyA;

        // Mine contact
        if (other?.label === 'mine') {
          const mine = this._mines.find(m => m.body === other && !m.triggered && m.armed);
          if (mine) { mine.triggered = true; this._triggerMine(mine); }
        }

        if (dieRef && other.label === 'enemyBumper') {
          dieRef._hadCollision = true;
          this._applyBumperKick(dieBody, this.enemyPos.x, this.enemyPos.y);
          if (!rerolled.has(dieRef)) {
            rerolled.add(dieRef); this._rerollDie(dieRef);
          }
          this._flashEnemyBumper();
          if (dieRef.isPlayer) {
            const bumperBonus = this._hasDieUpgrade(dieRef.data, 'bumper') ? 1 : 0;
            const chipDmg = this._hitEnemyBlock(1 + bumperBonus);
            if (chipDmg > 0) {
              this.enemyHp = Math.max(0, this.enemyHp - chipDmg);
              this._addToPot(chipDmg);
              this._flashEnemyDamage(chipDmg);
              this._siphonHeal(chipDmg);
              if (this.enemyHp <= 0) this._triggerVictory();
            }
            // bumper_decoy: +bonus damage for hitting the real bumper
            const decoyRelic = this.relicManager.active.find(r => r.id === 'bumper_decoy');
            if (decoyRelic) {
              const decoyDmg = this._hitEnemyBlock(decoyRelic.value);
              if (decoyDmg > 0) {
                this.enemyHp = Math.max(0, this.enemyHp - decoyDmg);
                this._addToPot(decoyDmg);
                this._flashEnemyDamage(decoyDmg);
                this._siphonHeal(decoyDmg);
                if (this.enemyHp <= 0) this._triggerVictory();
              }
              this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 36, `REAL! +${decoyRelic.value}`, '#ffee00');
            }
          }
          if (dieRef.isPlayer && dieRef.data.material === 'cursed') {
            this.enemyVulnerable = true;
            this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'EXPOSED', '#ff44bb');
          }
          if (dieRef.isPlayer) {
            dieRef._bumperContactCount = (dieRef._bumperContactCount ?? 0) + 1;
            dieRef._lastBumperX = this.enemyPos.x;
            dieRef._lastBumperY = this.enemyPos.y;
            this.bus.emit('ON_CONTACT_BUMPER_ENEMY', { die: dieRef });
            // Bulletproof Glass on bumper contact
            if (this._hasDieUpgrade(dieRef.data, 'bulletproof_glass')) this._handleBulletproofHit(dieRef);
            // Heavyweight on bumper contact
            if (this._hasDieUpgrade(dieRef.data, 'heavyweight')) {
              const bDmg = this._hitEnemyBlock(2);
              if (bDmg > 0) { this.enemyHp = Math.max(0, this.enemyHp - bDmg); this._addToPot(bDmg); this._refreshEnemyCharacter(); this._flashEnemyDamage(bDmg); this._siphonHeal(bDmg); if (this.enemyHp <= 0) this._triggerVictory(); }
              this._floatText(dieRef.img.x, dieRef.img.y - 24, 'HEAVY +2', '#aabbcc');
            }
            // bumper_enrage: enemy gains strength on each bumper contact
            if (this._bumperEnragePerHit > 0) {
              this.enemyStrength = (this.enemyStrength ?? 0) + this._bumperEnragePerHit;
              this._floatText(this.enemyPos.x, this.enemyPos.y - 30, `ENRAGED! +${this._bumperEnragePerHit}`, '#e74c3c');
            }
            // contact_drain on bumper contact
            if (this._contactDrainActive) {
              dieRef._valueBonus = (dieRef._valueBonus ?? 0) - 1;
            }
            // sign: flip face value on enemy bumper contact
            this._applySignToggle(dieRef);
            // explosive_contact: radial knockback from enemy bumper
            if (this._hasDieUpgrade(dieRef.data, 'explosive_contact')) {
              this._explosionAt(this.enemyPos.x, this.enemyPos.y, dieRef);
            }
            // trigger_materials: material bonus as chip damage on enemy bumper hit
            this._triggerMaterialChip(dieRef, this.enemyPos.x, this.enemyPos.y);
          }
          // Infected dice progress toward shatter on every bumper contact
          this._tickInfectedContact(dieRef);
          this._refreshEnemyCharacter();
        }

        if (dieRef && other.label === 'playerBumper') {
          dieRef._hadCollision = true;
          this._applyBumperKick(dieBody, THROW_ORIGIN_X, THROW_ORIGIN_Y);
          if (!rerolled.has(dieRef)) {
            rerolled.add(dieRef); this._rerollDie(dieRef);
          }
          this._flashPlayerBumper();
          if (dieRef.isPlayer) {
            dieRef._bumperContactCount = (dieRef._bumperContactCount ?? 0) + 1;
            dieRef._lastBumperX = THROW_ORIGIN_X;
            dieRef._lastBumperY = THROW_ORIGIN_Y;
            this.bus.emit('ON_CONTACT_BUMPER_PLAYER', { die: dieRef });
            // Bulletproof Glass on player bumper contact
            if (this._hasDieUpgrade(dieRef.data, 'bulletproof_glass')) this._handleBulletproofHit(dieRef);
            // Heavyweight on player bumper contact
            if (this._hasDieUpgrade(dieRef.data, 'heavyweight')) {
              const bDmg = this._hitEnemyBlock(2);
              if (bDmg > 0) { this.enemyHp = Math.max(0, this.enemyHp - bDmg); this._addToPot(bDmg); this._refreshEnemyCharacter(); this._flashEnemyDamage(bDmg); this._siphonHeal(bDmg); if (this.enemyHp <= 0) this._triggerVictory(); }
              this._floatText(dieRef.img.x, dieRef.img.y - 24, 'HEAVY +2', '#aabbcc');
            }
            // contact_drain on player bumper contact
            if (this._contactDrainActive) {
              dieRef._valueBonus = (dieRef._valueBonus ?? 0) - 1;
            }
            // sign: flip face value on player bumper contact
            this._applySignToggle(dieRef);
            // trigger_materials: material bonus chip damage on player bumper hit
            this._triggerMaterialChip(dieRef, THROW_ORIGIN_X, THROW_ORIGIN_Y);
          }
          // Infected dice progress toward shatter on every bumper contact
          this._tickInfectedContact(dieRef);
        }

        if (dieRef && other.label === 'wall') {
          if (dieRef.isPlayer) {
            // Wall Ball upgrade: +1 value per wall contact
            if (this._hasDieUpgrade(dieRef.data, 'wall_ball')) {
              dieRef._valueBonus = (dieRef._valueBonus ?? 0) + 1;
            }
            // Wall Radiation: reduce own roll by 1 per wall hit
            if (this._hasDieUpgrade(dieRef.data, 'wall_radiation')) {
              dieRef._valueBonus = (dieRef._valueBonus ?? 0) - 1;
            }
            // Mine upgrade: spawn on first wall hit per turn
            if (this._hasDieUpgrade(dieRef.data, 'mine') && !dieRef._mineFiredThisTurn) {
              dieRef._mineFiredThisTurn = true;
              this._spawnMine(dieRef.img.x, dieRef.img.y);
            }
            // Bulletproof Glass
            if (this._hasDieUpgrade(dieRef.data, 'bulletproof_glass')) this._handleBulletproofHit(dieRef);
            // Heavyweight: bonus damage on wall contact
            if (this._hasDieUpgrade(dieRef.data, 'heavyweight')) {
              const bDmg = this._hitEnemyBlock(2);
              if (bDmg > 0) { this.enemyHp = Math.max(0, this.enemyHp - bDmg); this._addToPot(bDmg); this._refreshEnemyCharacter(); this._flashEnemyDamage(bDmg); this._siphonHeal(bDmg); if (this.enemyHp <= 0) this._triggerVictory(); }
              this._floatText(dieRef.img.x, dieRef.img.y - 24, 'HEAVY +2', '#aabbcc');
            }
            // contact_drain on wall contact
            if (this._contactDrainActive) {
              dieRef._valueBonus = (dieRef._valueBonus ?? 0) - 1;
            }
            // sign: flip face value on wall contact
            this._applySignToggle(dieRef);
          }
          // Wall Radiation: when ANY die hits a wall, give +1 to dice with wall_radiation
          this.playerDice.forEach(pd => {
            if (pd !== dieRef && this._hasDieUpgrade(pd.data, 'wall_radiation')) {
              pd._valueBonus = (pd._valueBonus ?? 0) + 1;
            }
          });
          // Infected dice progress toward shatter on every wall contact
          this._tickInfectedContact(dieRef);
        }
      });
    });
  }

  // ─── POINTER / INPUT ──────────────────────────────────────────────────────

  _setupPointer() {
    this.input.on('pointerdown', (ptr) => {
      if (this.inspectorPanel) return;
      if (this._suppressThrow)  return;
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
      const wasTap = Math.hypot(ptr.x - ptr.downX, ptr.y - ptr.downY) < 14;

      if (this._downDieRef) {
        const dr = this._downDieRef;
        this._downDieRef = null;
        if (wasTap) {
          this.aimActive = false;
          this.aimGfx.clear();
          this._showInspector(dr);
          return;
        }
        // drag — fall through to throw logic
      }

      if (this._downOnEnemyBumper) {
        this._downOnEnemyBumper = false;
        if (wasTap) {
          this.aimActive = false;
          this.aimGfx.clear();
          this._toggleWebView();
          return;
        }
        // drag — fall through to throw logic
      }

      if (this._downOnPlayerBumper) {
        this._downOnPlayerBumper = false;
        if (wasTap) {
          this.aimActive = false;
          this.aimGfx.clear();
          this._showPlayerStatusPopup();
          return;
        }
        // drag — fall through to throw logic
      }

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
        const speedBonus = this._nextThrowSpeedBonus ?? 0;
        this._nextThrowSpeedBonus = 0;
        const minSpd = this._minThrowOverride > 0 ? this._minThrowOverride : 7;
        const maxSpd = this._maxThrowOverride > 0 ? this._maxThrowOverride : MAX_THROW_SPEED;
        const spd = Math.min(maxSpd, Math.max(minSpd, len * 0.14) + speedBonus);
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
    if (this._tutorialMode) this._tutTurnCount = (this._tutTurnCount ?? 0) + 1;
    this.phase           = PHASE.PREP;
    this.block           = 0;
    this.cleanBonus      = 0;
    this.turnCount++;
    this.statusDamageBonus    = false;
    this._suppressPoisonDecay = false;
    this._prevQueueEffect     = null;
    this._currQueueEffect     = null;
    this.playerSettleCount    = 0;
    this._omenValue           = null;
    this._luckyCoinUsed       = false;
    this.turnAttackBonus      = 0;
    this._cannonballUsed      = false;
    this._nextThrowSpeedBonus = 0;
    this._ashenActive         = false;
    if (this.vulnerable > 0)   this.vulnerable--;
    this.enemyWeakened   = false;
    this.enemyVulnerable = false;
    if (this.playerFrail > 0) this.playerFrail--;
    this.enemyBlock         = this._pendingEnemyBlock ?? 0;
    this._pendingEnemyBlock = 0;
    this._autoCommitDone = false;
    this._hideWebView();

    this._reductionStacks = 0;
    this._settledValuesThisTurn = [];
    this._clearMines();

    // Flush ability teardowns from previous turn, then reset all ability flags
    this._abilityCleanup.forEach(fn => fn());
    this._abilityCleanup      = [];
    this._obstacleBuffPerHit  = 0;
    this._contactDrainActive  = false;
    this._bumperEnragePerHit  = 0;
    this._playerDiceReduction = 0;
    this._minThrowOverride    = 0;
    this._maxThrowOverride    = 0;
    this._glassCurseActive    = false;

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

    this.relicManager.applyPassives();
    this.bus.emit('ON_TURN_START', {});

    this._moveEnemyToNewPosition(() => {
      this.time.delayedCall(400, () => this._enemyRollPhase());
    });
  }

  _enemyRollPhase() {
    this.phase = PHASE.ENEMY_ROLL;
    this._setPhase('ENEMY ROLLING');

    if (this.enemyPoisonStacks > 0) {
      const psn    = this.enemyPoisonStacks;
      this.enemyHp = Math.max(0, this.enemyHp - psn);
      this._addToPot(psn);
      if (!this._suppressPoisonDecay) this.enemyPoisonStacks = Math.max(0, this.enemyPoisonStacks - 1);
      this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `☠ -${psn}`, '#58d68d');
      this._siphonHeal(psn);
      this._refreshEnemyCharacter();
      if (this.enemyHp <= 0) { this._triggerVictory(); return; }
    }

    // Apply passive abilities for this turn
    (this.enemyDef.abilities ?? []).forEach(ab => this._applyEnemyAbility(ab));

    const enemyDiceConfigs = this.enemyDef.enemyDice ?? [];
    this._showMsg('Enemy rolling their dice...');

    // Pre-compute evenly distributed target landing zones across the play area
    const MARGIN  = 40;
    const placeY  = (this.enemyPos.y + THROW_ORIGIN_Y) / 2 + 20;
    const anchors = [MARGIN, W - MARGIN];
    const targets = [];
    for (let i = 0; i < enemyDiceConfigs.length; i++) {
      anchors.sort((a, b) => a - b);
      let bestGap = -1, bestMid = W / 2;
      for (let j = 0; j < anchors.length - 1; j++) {
        const gap = anchors[j + 1] - anchors[j];
        if (gap > bestGap) { bestGap = gap; bestMid = (anchors[j] + anchors[j + 1]) / 2; }
      }
      anchors.push(bestMid);
      targets.push({ x: bestMid + Phaser.Math.FloatBetween(-18, 18), y: placeY + Phaser.Math.FloatBetween(-30, 30) });
    }

    // Throw each die aimed at its distributed target position
    enemyDiceConfigs.forEach((cfg, i) => {
      this.time.delayedCall(i * 200, () => {
        if (this.phase === 99) return;
        const fIdx  = Phaser.Math.Between(0, cfg.sides - 1);
        const data  = { ...cfg, currentFaceIdx: fIdx };
        const sx    = this.enemyPos.x + Phaser.Math.FloatBetween(-15, 15);
        const sy    = this.enemyPos.y + ENEMY_BUMPER_R + 6;
        const tx    = targets[i].x;
        const ty    = targets[i].y;
        const dist  = Math.hypot(tx - sx, ty - sy);
        const speed = Phaser.Math.FloatBetween(6, 10);
        const vx    = ((tx - sx) / dist) * speed;
        const vy    = ((ty - sy) / dist) * speed;
        const eDie  = this._spawnDie(data, sx, sy, vx, vy, false, -1);
        eDie._rolling          = true;
        eDie._finalFaceIdx     = fIdx;
        eDie._isEnemyCombatDie = true;
      });
    });

    const minDelay = enemyDiceConfigs.length * 200 + 800;
    this._waitForEnemyDiceSettle(minDelay, () => {
      if (this.phase !== PHASE.ENEMY_ROLL) return;
      this._showMsg('Tap the enemy to see their dice');
      this._playerRollPhase();
    });
  }

  _waitForEnemyDiceSettle(minDelay, cb) {
    let checks = 0;
    const maxChecks = 16;
    const poll = () => {
      if (this.phase === 99) return;
      checks++;
      const combat     = this.enemyDice.filter(d => d._isEnemyCombatDie && d.img?.active);
      const allSettled = combat.length === 0 || combat.every(d => !d._rolling);
      if (allSettled || checks > maxChecks) { cb(); }
      else { this.time.delayedCall(250, poll); }
    };
    this.time.delayedCall(minDelay, poll);
  }

  _applyEnemyAbility(ab) {
    const WALL_DEF = { friction: 0, frictionStatic: 0, restitution: 0.925 };
    switch (ab.id) {
      case 'bouncy_bumpers':
        if (this.enemyPhysicsBody) {
          this.enemyPhysicsBody.restitution = 2.0;
          this._abilityCleanup.push(() => { if (this.enemyPhysicsBody) this.enemyPhysicsBody.restitution = 0.9; });
        }
        this._floatText(this.enemyPos.x, this.enemyPos.y - 50, 'ULTRA BOUNCE!', '#ffee00');
        break;
      case 'sticky_walls':
        (this._wallBodies ?? []).forEach(b => { b.friction = 8; b.frictionStatic = 8; b.restitution = 0; });
        this._abilityCleanup.push(() =>
          (this._wallBodies ?? []).forEach(b => {
            b.friction = WALL_DEF.friction; b.frictionStatic = WALL_DEF.frictionStatic; b.restitution = WALL_DEF.restitution;
          })
        );
        this._floatText(this.enemyPos.x, this.enemyPos.y - 50, 'STICKY WALLS', '#88aaff');
        break;
      case 'glass_curse':
        this._glassCurseActive = true;
        this._abilityCleanup.push(() => { this._glassCurseActive = false; });
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 40, 'GLASS CURSE', '#ff6633');
        break;
      case 'obstacle_buff':
        this._obstacleBuffPerHit = ab.value ?? 1;
        this._abilityCleanup.push(() => { this._obstacleBuffPerHit = 0; });
        this._floatText(this.enemyPos.x, this.enemyPos.y - 50, 'WATCH THE PILLARS', '#e67e22');
        break;
      case 'contact_drain':
        this._contactDrainActive = true;
        this._abilityCleanup.push(() => { this._contactDrainActive = false; });
        this._floatText(this.enemyPos.x, this.enemyPos.y - 50, 'CONTACT DRAIN', '#cc44ff');
        break;
      case 'bumper_enrage':
        this._bumperEnragePerHit = ab.value ?? 2;
        this._abilityCleanup.push(() => { this._bumperEnragePerHit = 0; });
        this._floatText(this.enemyPos.x, this.enemyPos.y - 50, 'ENRAGE', '#e74c3c');
        break;
      case 'flat_reduction':
        this._playerDiceReduction = ab.value ?? 2;
        this._abilityCleanup.push(() => { this._playerDiceReduction = 0; });
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 40, `DICE -${ab.value ?? 2}`, '#cc44ff');
        break;
      case 'bullet_throws':
        this._minThrowOverride = ab.value ?? 18;
        this._abilityCleanup.push(() => { this._minThrowOverride = 0; });
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 40, 'BULLET THROWS', '#ff4444');
        break;
      case 'weak_throws':
        this._maxThrowOverride = ab.value ?? Math.floor(MAX_THROW_SPEED * 0.5);
        this._abilityCleanup.push(() => { this._maxThrowOverride = 0; });
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 40, 'WEAKENED', '#9b59b6');
        break;
    }
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
    this._hideWebView();

    this.time.delayedCall(600, () => {
      const msgs = [];
      const enemyCombatDice = this.enemyDice.filter(d => d._isEnemyCombatDie);

      enemyCombatDice.forEach(eDie => {
        const value = (Math.floor(eDie.data.currentFaceIdx / 2) + 1) * 2;
        switch (eDie.data.type) {
          case 'attack': {
            let dmg = Math.max(0, (value + (this.enemyStrength ?? 0)) - (this._reductionStacks ?? 0));
            if (this.vulnerable > 0) dmg = Math.ceil(dmg * 1.5);
            if (this.enemyWeakened)  dmg = Math.floor(dmg * 0.5);
            const absorbed = Math.min(this.block, dmg);
            this.block -= absorbed;
            const taken = dmg - absorbed;
            this.playerHp = Math.max(0, this.playerHp - taken);
            if (taken > 0) {
              this._flashDamage(taken);
              msgs.push(`-${taken} HP`);
              this.bus.emit('ON_DAMAGE_TAKEN', { amount: taken });
            } else {
              msgs.push('Blocked!');
            }
            break;
          }
          case 'block':
            this._pendingEnemyBlock += value;
            msgs.push(`Enemy blocked ${value}`);
            break;
          case 'strength':
            this.enemyStrength += value;
            this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `LOADED +${value}`, '#e67e22');
            msgs.push(`Loaded dice +${value}`);
            break;
          case 'vulnerable':
            this.vulnerable = Math.max(this.vulnerable, value);
            this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 30, 'HUSTLED!', '#bb44cc');
            msgs.push("You're distracted");
            this.bus.emit('ON_STATUS_APPLIED', { target: 'player', status: 'vulnerable', amount: value });
            break;
          case 'frail':
            this.playerFrail = Math.max(this.playerFrail, value);
            this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y + 30, 'RATTLED!', '#1abc9c');
            msgs.push("You're rattled");
            this.bus.emit('ON_STATUS_APPLIED', { target: 'player', status: 'frail', amount: value });
            break;
        }
      });

      if (this.enemyWeakened)
        this._floatText(THROW_ORIGIN_X, THROW_ORIGIN_Y - 50, 'OPPONENT EXPOSED!', '#9b59b6');

      this._reductionStacks = 0;

      this._refreshEnemyCharacter();
      this._refreshStatusUI();
      this._showMsg(msgs.length > 0 ? msgs.join('  ·  ') : 'Nothing happened.');

      this.time.delayedCall(2000, () => {
        // Poison Burst upgrade
        const hasBurst = this.playerDiceConfig.some(dc => dc.upgradeState?.takenUpgrades?.includes('poison_burst'));
        if (hasBurst && this.enemyPoisonStacks > 0) {
          const n = this.enemyPoisonStacks;
          const burst = n * (n + 1) / 2;
          this.enemyPoisonStacks = 0;
          const dmgB = this._hitEnemyBlock(burst);
          if (dmgB > 0) {
            this.enemyHp = Math.max(0, this.enemyHp - dmgB);
            this._addToPot(dmgB);
            this._refreshEnemyCharacter();
            this._flashEnemyDamage(dmgB);
            this.bus.emit('ON_DAMAGE_DEALT', { amount: dmgB });
            this._siphonHeal(dmgB);
          }
          this._floatText(this.enemyPos.x, this.enemyPos.y - 50, `POISON BURST -${burst}`, '#44ff88');
          if (this.enemyHp <= 0) { this._triggerVictory(); return; }
        }

        this._clearSurface();
        if (this.playerHp <= 0) this._gameOver();
        else { this.bus.emit('ON_TURN_END', {}); this._startTurn(); }
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
    } else if (data.type && !data.isObstacle) {
      // Enemy combat die
      lblText  = ENEMY_DIE_TYPE_SYMS[data.type]  ?? data.type.slice(0, 3).toUpperCase();
      lblColor = ENEMY_DIE_TYPE_COLORS[data.type] ?? '#ffffff';
      valText  = String((Math.floor(data.currentFaceIdx / 2) + 1) * 2);
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
      this._downDieRef = dieRef;
      if (this.phase === PHASE.PLAYER_ROLL && !this._throwLocked && !this.inspectorPanel && this.throwCount < this.trayCards.length) {
        this.aimActive  = true;
        this._aimStartX = ptr.x;
        this._aimStartY = ptr.y;
      }
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
    if (this._ashenActive) { die._runeDouble = true; this._ashenActive = false; }
    if (this._glassCurseActive) die._cursedGlass = true;

    // Physics-modifying upgrades applied at throw time
    let phantomStep = false;
    if (dc.upgradeState?.takenUpgrades && die.img?.body) {
      const ups = dc.upgradeState.takenUpgrades;
      if (ups.includes('featherlight')) {
        die.img.body.restitution = 0.96;
        Phaser.Physics.Matter.Matter.Body.setDensity(die.img.body, 0.001);
      }
      if (ups.includes('greased')) {
        die.img.body.frictionAir = 0;
      }
      if (ups.includes('heavyweight')) {
        Phaser.Physics.Matter.Matter.Body.setDensity(die.img.body, 0.014);
        die.img.body.restitution = Math.max(0.1, DIE_BOUNCE - 0.3);
      }
      if (ups.includes('phantom_step')) {
        phantomStep = true;
        die._phantomStep = true;
        die.img.body.collisionFilter.category = 0x0010;
        // Tier boost: use a 0–19 face index regardless of die's configured sides
        const pFIdx = Phaser.Math.Between(0, 19);
        die._finalFaceIdx = pFIdx;
        die.data.currentFaceIdx = pFIdx;
      }
    }
    this._throwLocked  = true;

    // Ignore the player bumper until the die has cleared the origin.
    // Phantom step also passes through other player dice (category 0x0001) permanently.
    const initMask  = phantomStep ? (0xFFFFFFFF & ~0x0001 & ~0x0002) : (0xFFFFFFFF & ~0x0002);
    const finalMask = phantomStep ? (0xFFFFFFFF & ~0x0001)            : 0xFFFFFFFF;
    die.img.body.collisionFilter.mask = initMask;
    this.time.delayedCall(400, () => {
      if (die.img?.body) die.img.body.collisionFilter.mask = finalMask;
    });

    card.img.setVisible(false);
    card.lbl.setVisible(false);
    this.throwCount++;
    StatsManager.recordDiceThrown();
    this._snapAllCards();
    this._showMsg('Die thrown — waiting to settle…');
  }

  _rerollDie(dieRef) {
    if (dieRef._anchored) return;
    this._stopDieShield(dieRef);
    const { data } = dieRef;
    if (dieRef.isPlayer) {
      const activeIdx = this._getActiveFaceIndices(data);
      data.currentFaceIdx = activeIdx[Phaser.Math.Between(0, activeIdx.length - 1)];
    } else {
      data.currentFaceIdx = Phaser.Math.Between(0, (data.sides ?? data.faces?.length ?? 6) - 1);
    }
    dieRef._finalFaceIdx = data.currentFaceIdx;
    dieRef._rolling      = true;
    dieRef._lastCycleMs  = 0;
    dieRef._wasRerolled  = true;
  }

  // ─── IMMEDIATE EFFECTS ────────────────────────────────────────────────────

  _applyDieFaceImmediate(dieRef, skipRune = false, snapX = null, snapY = null, _skipUpgrades = false) {
    if (this.phase === 99) return;
    const { data } = dieRef;
    // Prefer the position snapshotted at queue-entry time so effects resolve
    // correctly even if the die was destroyed before this entry fired.
    const imgX = snapX ?? dieRef.img?.x ?? 0;
    const imgY = snapY ?? dieRef.img?.y ?? 0;
    let value = Math.floor(data.currentFaceIdx / 2) + 1;
    if (dieRef._cracked)     { value = Math.ceil(value / 2); dieRef._cracked = false; }
    if (dieRef._valueBonus)  { value += dieRef._valueBonus;  dieRef._valueBonus = 0; }
    if (this._playerDiceReduction > 0) value = Math.max(0, value - this._playerDiceReduction);
    const type  = dieRef._mimicType ?? data.type;

    // Buffet upgrade: add min of previously settled dice values
    if (this._hasDieUpgrade(data, 'buffet') && (this._settledValuesThisTurn?.length ?? 0) > 1) {
      const prev = this._settledValuesThisTurn.slice(0, -1);
      if (prev.length) value += Math.min(...prev);
    }

    // Vanguard: does not benefit from cleanBonus
    const effectiveCleanBonus = this._hasDieUpgrade(data, 'vanguard') ? 0 : this.cleanBonus;

    // Poison upgrade: convert die effect to poison stacks (runs after buffet + cleanBonus so buff dice apply)
    if (!_skipUpgrades && this._hasDieUpgrade(data, 'poison')) {
      let stacks = this._getModifiedValue(dieRef, value, false) + effectiveCleanBonus;
      stacks = Math.max(0, stacks);
      this.enemyPoisonStacks += stacks;
      this._refreshEnemyCharacter();
      this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `☠ +${stacks} PSN`, '#44ff88');
      this._currQueueEffect = { type: 'poison', value: stacks };
      if (!skipRune && data.runeMap?.[data.currentFaceIdx]) this._applyRuneEffect(dieRef);
      if (!_skipUpgrades) this._applyFlatUpgradeEffects(dieRef, value);
      return;
    }

    switch (type) {
      case 'attack': {
        let raw = this._getModifiedValue(dieRef, value, true);
        raw += this.relicManager.getAttackBonus();
        raw += effectiveCleanBonus;
        raw += this.turnAttackBonus;
        if (!dieRef._hadCollision) raw += this.relicManager.getCleanLandBonus();
        raw  = Math.floor(raw * this.relicManager.getAttackMultiplier());
        if (this.playerFrail > 0)    raw = Math.floor(raw * 0.5);
        if (this.enemyVulnerable)    raw = Math.ceil(raw * 1.5);
        if (this.statusDamageBonus)  raw = Math.ceil(raw * 1.25);
        const isPierceAll = data.material === 'rock' || this.relicManager.isPierceAll();
        const dmg         = isPierceAll ? raw : this._hitEnemyBlock(raw);
        this._laserBeam(imgX, imgY, this.enemyPos.x, this.enemyPos.y, 0xff4444);
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._addToPot(dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          this.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: dieRef });
          this._siphonHeal(dmg);
        }
        if (this.enemyHp <= 0) this._triggerVictory();
        this._currQueueEffect = { type: 'attack', value: raw };
        break;
      }
      case 'block': {
        let blk = this._getModifiedValue(dieRef, value, false);
        blk += this.relicManager.getBlockBonus();
        blk += effectiveCleanBonus;
        if (!dieRef._hadCollision) blk += this.relicManager.getCleanLandBonus();
        blk  = Math.floor(blk * this.relicManager.getBlockMultiplier());
        this.block += blk;
        StatsManager.recordBlockGained(blk);
        this._refreshStatusUI();
        this._flashDieImpact(dieRef, `+${blk} BLK`, '#3498db');
        this.bus.emit('ON_BLOCK_GAINED', { amount: blk });
        this._currQueueEffect = { type: 'block', value: blk };
        break;
      }
      case 'pierce': {
        const boost = this._getModifiedValue(dieRef, value, false);
        this.cleanBonus += boost;
        this._flashDieImpact(dieRef, `+${boost} BOOST`, '#ff9900');
        this._refreshPlayerPills();
        break;
      }
      case 'copy': {
        // No mimic acquired — deal 1 weak attack (absorbed by block)
        const dmg = this._hitEnemyBlock(1);
        this._floatText(imgX, imgY - 32, 'NO COPY', '#cc88ff');
        if (dmg > 0) {
          this._laserBeam(imgX, imgY, this.enemyPos.x, this.enemyPos.y, 0xcc88ff);
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._addToPot(dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          this._siphonHeal(dmg);
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
        const heal = this.relicManager.hasSiphon() ? dmg : Math.min(dmg, this.playerMaxHp - this.playerHp);
        this._laserBeam(imgX, imgY, this.enemyPos.x, this.enemyPos.y, 0xaa44ff);
        this.enemyHp  = Math.max(0, this.enemyHp - dmg);
        this._addToPot(dmg);
        this.playerHp += heal;
        this._refreshEnemyCharacter();
        this._flashEnemyDamage(dmg);
        if (dmg > 0) this.relicManager.onAttackHit(dmg);
        if (heal > 0) { this._flashHeal(heal); this._refreshStatusUI(); }
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'poison': {
        const stacks = this._getModifiedValue(dieRef, value, false);
        this.enemyPoisonStacks += stacks;
        this._refreshEnemyCharacter();
        this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `☠ +${stacks} PSN`, '#58d68d');
        this._currQueueEffect = { type: 'poison', value: stacks };
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
        this._laserBeam(imgX, imgY, this.enemyPos.x, this.enemyPos.y, 0xff6622);
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._addToPot(dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
          this.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: dieRef });
          this._siphonHeal(dmg);
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

    if (!_skipUpgrades) this._applyFlatUpgradeEffects(dieRef, value);
  }

  _applyRuneEffect(dieRef) {
    // Don't re-fire the brand if this player die was already shattered
    if (dieRef.isPlayer && !this.playerDice.includes(dieRef)) return;
    const runeId = dieRef.data.runeMap?.[dieRef.data.currentFaceIdx];
    if (!runeId) return;
    const handler = RUNE_HANDLERS[runeId];
    if (!handler) return;
    const faceIdx = dieRef.data.currentFaceIdx;
    const value   = Math.floor(faceIdx / 2) + 1;
    const ctx = { scene: this, die: dieRef, value, faceIdx, playerX: THROW_ORIGIN_X, playerY: THROW_ORIGIN_Y };
    const fireCount = dieRef._runeDouble ? 2 : 1;
    dieRef._runeDouble = false;
    for (let i = 0; i < fireCount; i++) {
      handler(ctx);
      this.bus.emit('ON_RUNE_TRIGGER', { runeId, die: dieRef });
    }
    this.bus.emit('ON_FACE', { die: dieRef, runeId, value, faceIdx });
  }

  // ─── FLAT UPGRADE EFFECTS ─────────────────────────────────────────────────

  _applyFlatUpgradeEffects(dieRef, value) {
    if (!dieRef.isPlayer || !dieRef.data) return;
    const data = dieRef.data;
    const has  = (id) => this._hasDieUpgrade(data, id);
    const imgX = dieRef.img?.x ?? 0;
    const imgY = dieRef.img?.y ?? 0;

    // REDUCTION
    if (has('reduction')) { this._reductionStacks += 1; this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'REDUCE -1', '#cc44ff'); this.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'reduction' }); }
    if (has('more_reduction')) { this._reductionStacks += value; this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, `REDUCE -${value}`, '#cc44ff'); this.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'reduction', amount: value }); }

    // STATUS DAMAGE
    if (has('status_damage')) {
      const n = this._countEnemyStatuses();
      if (n > 0) {
        const raw = n * 5;
        const dmg = this._hitEnemyBlock(raw);
        if (dmg > 0) { this._laserBeam(imgX, imgY, this.enemyPos.x, this.enemyPos.y, 0xcc44ff); this.enemyHp = Math.max(0, this.enemyHp - dmg); this._addToPot(dmg); this._refreshEnemyCharacter(); this._flashEnemyDamage(dmg); this.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: dieRef }); this._siphonHeal(dmg); if (this.enemyHp <= 0) { this._triggerVictory(); return; } }
        this._floatText(imgX, imgY - 32, `STATUS ×${n}`, '#cc44ff');
      }
    }

    // BLOCKING STANCE
    if (has('blocking_stance')) { this.block += value; StatsManager.recordBlockGained(value); this._refreshStatusUI(); this._floatText(imgX, imgY - 32, `+${value} BLK`, '#3498db'); this.bus.emit('ON_BLOCK_GAINED', { amount: value }); }

    // BUFF
    if (has('buff')) { dieRef._valueBonus = (dieRef._valueBonus ?? 0) + 1; this._floatText(imgX, imgY - 32, 'BUFF +1', '#ffaa00'); }

    // BUFF REACH
    if (has('buff_reach')) {
      const bonus = Math.max(1, Math.floor(value / 2));
      this.playerDice.forEach(pd => { if (pd.img?.active) pd._valueBonus = (pd._valueBonus ?? 0) + bonus; });
      this._floatText(imgX, imgY - 32, `REACH +${bonus}`, '#ffaa00');
    }

    // SLOW DRIP
    if (has('slow_drip')) this._suppressPoisonDecay = true;

    // CULTIST
    if (has('cultist')) {
      const maxVal = Math.floor((data.sides - 1) / 2) + 1;
      if (Math.floor(data.currentFaceIdx / 2) + 1 >= maxVal) { this.enemyPoisonStacks += 5; this._refreshEnemyCharacter(); this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 36, '☠ +5 CULTIST', '#44ff88'); }
    }

    // GRAVITY WELL
    if (has('gravity_well') && !dieRef._gravityWellFiredThisTurn) {
      dieRef._gravityWellFiredThisTurn = true;
      this._pullDiceToward(imgX, imgY, dieRef);
      this._floatText(imgX, imgY - 32, 'GRAVITY WELL', '#4488ff');
    }

    // BLACK HOLE
    if (has('black_hole') && !dieRef._blackHoleFiredThisTurn) {
      dieRef._blackHoleFiredThisTurn = true;
      dieRef._blackHole = true;
      this._pullDiceToward(imgX, imgY, dieRef);
      this._floatText(imgX, imgY - 32, 'BLACK HOLE', '#4488ff');
    }

    // VENTRILOQUIST
    if (has('ventriloquist') && !dieRef._ventriloquistFiredThisTurn) {
      dieRef._ventriloquistFiredThisTurn = true;
      this._pullDiceToward(this.enemyPos.x, this.enemyPos.y, dieRef);
      this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'GRAVITY WELL', '#4488ff');
    }

    // SHIV (now uncommon — spawns d2 attack die)
    if (has('shiv') && !dieRef._shivFiredThisTurn) {
      dieRef._shivFiredThisTurn = true;
      this._addTempDieToTray('attack', 2);
      this._floatText(imgX, imgY - 32, 'SHIV d2', '#ff4488');
    }
    if (has('shiv_tier_plus') && !dieRef._shivTierFiredThisTurn) {
      dieRef._shivTierFiredThisTurn = true;
      this._addTempDieToTray('attack', 4);
      this._floatText(imgX, imgY - 48, 'SHIV d4', '#ff4488');
    }
    if (has('shiv_quantity') && !dieRef._shivQtyFiredThisTurn) {
      dieRef._shivQtyFiredThisTurn = true;
      this._addTempDieToTray('attack', 2);
      this._addTempDieToTray('attack', 2);
      this._floatText(imgX, imgY - 48, 'SHIV \xd72', '#ff4488');
    }
    if (has('shiv_trigger')) {
      const maxVal = Math.floor((data.sides - 1) / 2) + 1;
      if (Math.floor(data.currentFaceIdx / 2) + 1 >= maxVal) { this._addTempDieToTray('attack', 2); this._floatText(imgX, imgY - 48, 'SHIV TRIGGER', '#ff4488'); }
    }

    // CONSUME
    if (has('consume') && this._effectQueue.length > 0) {
      const myType = dieRef._mimicType ?? data.type;
      this._effectQueue.forEach(e => { e.type = myType; e.dieRef._mimicType = myType; });
      this._floatText(imgX, imgY - 32, 'CONSUME', '#f0c040');
    }

    // FINISHER text
    if (has('finisher')) {
      const bonus = Math.max(0, this.playerSettleCount - 1);
      if (bonus > 0) this._floatText(imgX, imgY - 48, `FINISHER +${bonus}`, '#f0c040');
    }
  }

  _countEnemyStatuses() {
    let n = 0;
    if (this.enemyPoisonStacks > 0) n++;
    if (this.enemyWeakened)         n++;
    if (this.enemyVulnerable)       n++;
    return n;
  }

  _hasDieUpgrade(data, id) {
    return data?.upgradeState?.takenUpgrades?.includes(id) ?? false;
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

  // ─── BULLETPROOF GLASS HELPER ─────────────────────────────────────────────

  _handleBulletproofHit(dieRef) {
    if (!this.allDice.includes(dieRef)) return;
    dieRef._contactHits = (dieRef._contactHits ?? 0) + 1;
    if (dieRef._contactHits === 1) {
      dieRef._cracked = true;
      this._applyCrackOverlay(dieRef);
      this._floatText(dieRef.img?.x ?? 0, (dieRef.img?.y ?? 0) - 24, 'CRACKED', '#ff6633');
    } else if (dieRef._contactHits >= 3) {
      this._floatText(dieRef.img?.x ?? 0, (dieRef.img?.y ?? 0) - 24, 'SHATTER!', '#ff6633');
      this._applyDieFaceImmediate(dieRef, true, null, null, true);
      this._applyDieFaceImmediate(dieRef, true, null, null, true);
      this._applyDieFaceImmediate(dieRef, true, null, null, true);
      this._shatterDie(dieRef);
    }
  }

  // Progress an infected die (from destroy_contacts) one step toward shatter.
  // Called from every contact site: die-die, enemy bumper, player bumper, wall.
  // Player dice shatter at 3 total contacts; enemy dice at 4.
  _tickInfectedContact(dieRef) {
    if (!dieRef?.img?.active || !this.allDice.includes(dieRef)) return;
    if ((dieRef._infectHits ?? 0) === 0) return;
    dieRef._infectHits += 1;
    const threshold = dieRef.isPlayer ? 3 : 4;
    if (dieRef._infectHits >= threshold) {
      this._floatText(dieRef.img?.x ?? 0, (dieRef.img?.y ?? 0) - 24, 'SHATTER!', '#ff6633');
      this._applyDieFaceImmediate(dieRef, true, null, null, true);
      this._applyDieFaceImmediate(dieRef, true, null, null, true);
      this._shatterDie(dieRef);
    }
  }

  _pullDiceToward(tx, ty, excludeDie = null) {
    const PULL_SPEED = 8;
    this.allDice.forEach(d => {
      if (d === excludeDie || !d.img?.active || !d.img.body) return;
      const dx  = tx - d.img.x;
      const dy  = ty - d.img.y;
      const len = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, {
        x: (dx / len) * PULL_SPEED,
        y: (dy / len) * PULL_SPEED,
      });
      if (d._rolling) this._rerollDie(d);
    });
  }

  // ─── MINE ─────────────────────────────────────────────────────────────────

  _spawnMine(x, y) {
    const g = this.add.circle(x, y, 8, 0x00ccff, 0.25).setDepth(8);
    const body = this.matter.add.circle(x, y, 8, { isStatic: true, label: 'mine', isSensor: true });
    const mine = { x, y, gfx: g, body, blastR: 220, triggered: false, armed: false };
    this._mines.push(mine);
    // Arm after 500ms — prevents the spawning die from immediately triggering it
    this.time.delayedCall(500, () => {
      if (mine.triggered) return;
      mine.armed = true;
      this.tweens.add({ targets: g, alpha: 0.85, duration: 180, ease: 'Sine.Out' });
    });
  }

  _cleanupMines() {
    if (!this._mines.length || this.phase === 99) return;
    this._mines = this._mines.filter(m => !m.triggered);
  }

  _clearMines() {
    this._mines.forEach(m => { m.gfx?.destroy(); if (m.body) { try { this.matter.world.remove(m.body); } catch(_){} } });
    this._mines = [];
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
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      const speed = 22 * (1 - dist / mine.blastR);
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, { x: nx * speed, y: ny * speed });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(d.img.body, Phaser.Math.FloatBetween(-0.5, 0.5));
      if (d._rolling) this._rerollDie(d);
    });
  }

  _applyCrackOverlay(dieRef) {
    if (dieRef.crackGfx?.active) return;
    const g = this.add.graphics().setDepth(9);
    const x = dieRef.img?.x ?? 0;
    const y = dieRef.img?.y ?? 0;

    // Three branching fracture lines from a slightly off-center origin.
    // All points stay within ~18px of center so they hug the die edge
    // without obscuring the value text in the middle.
    g.lineStyle(1.2, 0xffffff, 0.6);
    // Branch A: upper-left
    g.beginPath(); g.moveTo(-1, -2); g.lineTo(-6, -9); g.lineTo(-13, -14); g.strokePath();
    // Sub-branch off A
    g.beginPath(); g.moveTo(-6, -9); g.lineTo(-10, -5); g.strokePath();
    // Branch B: right
    g.beginPath(); g.moveTo(-1, -2); g.lineTo(7,  2); g.lineTo(15, 1); g.strokePath();
    // Branch C: lower-left
    g.beginPath(); g.moveTo(-1, -2); g.lineTo(-2, 8); g.lineTo(-6, 14); g.strokePath();

    g.setPosition(x, y);
    dieRef.crackGfx = g;
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
    const base = Math.floor(maxIdx / 2) + 1;

    const doHit = () => {
      if (!dieRef.img?.active || this.phase === 99) return;
      let dmg = this._getModifiedValue(dieRef, base, true);
      dmg += this.relicManager.getAttackBonus();
      dmg  = Math.floor(dmg * this.relicManager.getAttackMultiplier());
      if (this.playerFrail > 0) dmg = Math.floor(dmg * 0.5);
      if (this.enemyVulnerable) dmg = Math.ceil(dmg * 1.5);
      const actual = this.relicManager.isPierceAll() ? dmg : this._hitEnemyBlock(dmg);
      if (actual > 0) {
        this.enemyHp = Math.max(0, this.enemyHp - actual);
        this._addToPot(actual);
        this._flashEnemyDamage(actual);
        this._floatText(dieRef.img.x, dieRef.img.y - 24, `★${actual}`, '#e74c3c');
        this.bus.emit('ON_DAMAGE_DEALT', { amount: actual, die: dieRef });
        this._siphonHeal(actual);
        this._refreshEnemyCharacter();
      }
      if (this.enemyHp <= 0) this._triggerVictory();
    };

    doHit();

    const runeId = dieRef.data.runeMap?.[maxIdx];
    if (runeId && RUNE_HANDLERS[runeId]) {
      const rune = RUNES[runeId];
      if (rune) this._floatText(dieRef.img.x, dieRef.img.y - 44, rune.sym, rune.color);
      RUNE_HANDLERS[runeId]({ scene: this, die: dieRef, value: base, faceIdx: maxIdx, context: 'bumper', playerX: THROW_ORIGIN_X, playerY: THROW_ORIGIN_Y });
      this.bus.emit('ON_FACE', { die: dieRef, runeId, value: base, faceIdx: maxIdx });
      this.bus.emit('ON_RUNE_TRIGGER', { runeId, die: dieRef });
    }
  }

  _forceSettleDie(dieRef) {
    if (!dieRef?.isPlayer) return;
    if (!this.allDice.includes(dieRef)) return;
    if (!dieRef._rolling) return;  // already settled
    if (dieRef.img?.body) {
      Phaser.Physics.Matter.Matter.Body.setVelocity(dieRef.img.body, { x: 0, y: 0 });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(dieRef.img.body, 0);
    }
    dieRef._rolling = false;
    this.playerSettleCount++;
    dieRef._settleOrder = this.playerSettleCount;
    this._addToEffectQueue(dieRef);
    if (!this._queueActive) this._startQueue();
    this.bus.emit('ON_SETTLE', { die: dieRef });
  }

  // ─── PLANNED UPGRADE IMPLEMENTATIONS ─────────────────────────────────────

  // specialist_swarm: run once before the tray is built; converts matching dice to d4 attack
  // and spawns additional d4 dice carrying pairs of the original upgrades.
  _processSpecialistSwarm() {
    const additions = [];
    this.playerDiceConfig = this.playerDiceConfig.map(dc => {
      const ups = dc.upgradeState?.takenUpgrades ?? [];
      if (!ups.includes('specialist_swarm')) return dc;
      const otherUps   = ups.filter(u => u !== 'specialist_swarm');
      const remaining  = [...otherUps];
      const spawnCount = Math.floor(remaining.length / 2);
      for (let i = 0; i < spawnCount; i++) {
        const pair = remaining.splice(0, 2);
        additions.push({
          id: `_swarm_${Date.now()}_${i}`,
          type: 'attack', sides: 4, runeMap: {}, material: null, culledFaces: [],
          upgradeState: { takenUpgrades: pair },
        });
      }
      return { ...dc, type: 'attack', sides: 4, runeMap: {}, material: null, culledFaces: [],
               upgradeState: { takenUpgrades: [] } };
    });
    this.playerDiceConfig.push(...additions);
  }

  // sign: flip this die's face between its lowest and highest active face indices.
  _applySignToggle(dieRef) {
    if (!dieRef?.isPlayer || !this._hasDieUpgrade(dieRef.data, 'sign')) return;
    const active = this._getActiveFaceIndices(dieRef.data);
    if (active.length < 2) return;
    const lo = active[0];
    const hi = active[active.length - 1];
    const nextIdx = dieRef.data.currentFaceIdx === hi ? lo : hi;
    dieRef.data.currentFaceIdx = nextIdx;
    dieRef._finalFaceIdx       = nextIdx;
  }

  // explosive_contact: radial impulse from (cx, cy) applied to all dice within RADIUS.
  _explosionAt(cx, cy, excludeDie = null) {
    const IMPULSE = 0.055;
    const RADIUS  = 160;
    this._floatText(cx, cy - 35, 'BOOM!', '#ffee00');
    this.allDice.forEach(d => {
      if (d === excludeDie || !d.img?.body || !d.img.active) return;
      const dx   = d.img.x - cx;
      const dy   = d.img.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > RADIUS) return;
      const scale = IMPULSE * (1 - dist / RADIUS);
      Phaser.Physics.Matter.Matter.Body.applyForce(d.img.body, { x: d.img.x, y: d.img.y },
        { x: (dx / dist) * scale, y: (dy / dist) * scale });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(d.img.body, Phaser.Math.FloatBetween(-0.3, 0.3));
      // Only reroll dice that are still in-flight; calling _rerollDie on a
      // settled die sets _rolling=true again and causes it to double-enter the queue.
      if (d._rolling) this._rerollDie(d);
    });
  }

  // trigger_materials: deal the die's material bonus as immediate chip damage on bumper hit.
  _triggerMaterialChip(dieRef, cx, cy) {
    if (!dieRef?.isPlayer || !this._hasDieUpgrade(dieRef.data, 'trigger_materials')) return;
    const mat = dieRef.data?.material;
    if (!mat) return;
    const baseVal = Math.floor((dieRef.data.currentFaceIdx ?? 0) / 2) + 1;
    let bonus = 0;
    if (mat === 'iron')    bonus = 1;
    if (mat === 'steel')   bonus = baseVal;
    if (mat === 'fire')    bonus = 3;
    if (mat === 'uranium') bonus = baseVal;
    if (mat === 'rock')    bonus = 1;
    if (mat === 'phantom' && !dieRef._hadCollision) bonus = baseVal;
    if (mat === 'cursed') {
      this.enemyVulnerable = true;
      this._floatText(cx, cy - 30, 'EXPOSED', '#ff44bb');
    }
    if (bonus <= 0) return;
    const dmg = this._hitEnemyBlock(bonus);
    if (dmg > 0) {
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      this._addToPot(dmg);
      this._refreshEnemyCharacter();
      this._flashEnemyDamage(dmg);
      this._siphonHeal(dmg);
      if (this.enemyHp <= 0) this._triggerVictory();
    }
    this._floatText(cx, cy - 45, `${mat.toUpperCase()} +${bonus}`, '#aaddff');
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

    // Purge any pending (not-yet-animating) queue entry for this die so the
    // queue never tries to pulse/slide a dead die's card.
    const pendingIdx = this._effectQueue.findIndex(e => e.dieRef === dieRef);
    if (pendingIdx !== -1) {
      this._effectQueue.splice(pendingIdx, 1);
      const orphanCard = this._queueCards.splice(pendingIdx, 1)[0];
      if (orphanCard) { orphanCard.container.destroy(); this._repositionQueueCards(); }
    }
    if (dieRef.isPlayer) this.bus.emit('ON_DIE_DESTROYED', { die: dieRef });

    // Fire any ON_DIE_DESTROYED runes on this die (e.g. Chain Reaction Brand)
    for (const runeId of Object.values(dieRef.data?.runeMap ?? {})) {
      const rune = RUNES[runeId];
      if (rune?.trigger !== 'ON_DIE_DESTROYED') continue;
      const handler = RUNE_HANDLERS[runeId];
      if (!handler) continue;
      const active = this._getActiveFaceIndices(dieRef.data);
      const maxVal = active.length ? Math.floor(Math.max(...active) / 2) + 1 : 1;
      handler({ scene: this, die: dieRef, value: maxVal, faceIdx: -1, playerX: THROW_ORIGIN_X, playerY: THROW_ORIGIN_Y });
    }

    this.time.delayedCall(150, () => { dieRef.crackGfx?.destroy(); dieRef.img?.destroy(); dieRef.lbl?.destroy(); dieRef.valLbl?.destroy(); });
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
    this.bus.emit('ON_KILL', {});
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
    this.allDice.forEach(d => { this._stopDieShield(d); d.crackGfx?.destroy(); d.img.destroy(); d.lbl.destroy(); d.valLbl.destroy(); });
    this.allDice    = [];
    this.playerDice = [];
    this.enemyDice  = [];
    this._effectQueue = [];
    this._queueCards.forEach(c => c.container.destroy());
    this._queueCards  = [];
    this._queueActive = false;
    this._throwLocked = false;
    this._clearMines();
  }

  // ─── TRAY RESET ───────────────────────────────────────────────────────────

  _resetTray() {
    // Remove cards for temporary dice added by rune/relic effects
    this.trayCards = this.trayCards.filter(c => {
      if (this.playerDiceConfig[c.configIdx]?._temp) {
        c.img.destroy(); c.lbl.destroy(); return false;
      }
      return true;
    });
    this.playerDiceConfig = this.playerDiceConfig.filter(dc => !dc._temp);

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

  _addTempDieToTray(type, sides) {
    if (this.phase === 99) return;
    const configIdx = this.playerDiceConfig.length;
    this.playerDiceConfig.push({
      id: `_tmp_${configIdx}`, type, sides,
      runeMap: {}, material: null, culledFaces: [], _temp: true,
    });
    const y   = DIE_STRIP_Y + 5;
    const img = this.add.image(0, y, 'tcard').setDepth(21).setInteractive();
    const dt  = DIE_TYPES[type];
    const lbl = this.add.text(0, y, dt ? dt.sym : '?', {
      fontSize: '17px', color: dt ? dt.color : '#777777', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(22);
    const card = { configIdx, img, lbl };
    this.trayCards.push(card);
    img.on('pointerdown', (ptr) => {
      this._dragCard    = card;
      this._dragMoved   = false;
      this._dragOffsetX = ptr.x - img.x;
    });
    this._snapAllCards();
  }

  // ─── REROLL TOKEN ─────────────────────────────────────────────────────────

  // ─── INSPECTOR ────────────────────────────────────────────────────────────

  _showInspector(dieRef) {
    this._hideInspector();
    const { data, isPlayer } = dieRef;
    if (isPlayer) {
      this._buildPlayerInspector(data, data.currentFaceIdx);
    } else if (data.type && !data.isObstacle) {
      this._buildEnemyCombatDieInspector(dieRef);
    } else if (data.faces) {
      this._buildInspectorPanel(data.faces, data.currentFaceIdx, 0x8b1a1a);
    }
  }

  _buildEnemyCombatDieInspector(dieRef) {
    const { data } = dieRef;
    this.aimActive      = false;
    this._suppressThrow = true;
    this.aimGfx.clear();
    this._hideInspector();
    this.inspectorPanel = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    dim.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); });
    this.inspectorPanel.add(dim);

    const typeColor = parseInt((ENEMY_DIE_TYPE_COLORS[data.type] ?? '#ffffff').replace('#', ''), 16);
    const typeSym   = ENEMY_DIE_TYPE_SYMS[data.type] ?? data.type.toUpperCase();
    const typeDesc  = {
      attack:     'Deals damage to you at end of turn',
      block:      'Enemy blocks this much damage next turn',
      strength:   'Enemy gains +value to all future attacks',
      vulnerable: 'You take 50% more damage for that many turns',
      frail:      'Your dice deal less damage for that many turns',
    }[data.type] ?? '';

    const maxVal    = (Math.floor((data.sides - 1) / 2) + 1) * 2;
    const currentVal= (Math.floor(data.currentFaceIdx / 2) + 1) * 2;

    // Layout
    const CELL = 46, FACE = 41;
    const cols  = Math.min(maxVal, 6);
    const rows  = Math.ceil(maxVal / cols);
    const gridW = cols * CELL;
    const gridH = rows * CELL;
    const headerH = 46;
    const descH   = 22;
    const panelW  = Math.max(gridW + 24, 160);
    const panelH  = headerH + descH + gridH + 16;

    const cx = W / 2;
    const cy = SURFACE_TOP + (THROW_ZONE_BOTTOM - SURFACE_TOP) / 2;

    const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x0a0a1e, 0.97);
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

    // Header: type + sides
    this.inspectorPanel.add(
      this.add.text(cx, cy - panelH / 2 + 18, `${typeSym}  d${data.sides}`, {
        fontSize: '18px', color: ENEMY_DIE_TYPE_COLORS[data.type] ?? '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5)
    );

    // Description line
    this.inspectorPanel.add(
      this.add.text(cx, cy - panelH / 2 + 38, typeDesc, {
        fontSize: '11px', color: '#778899',
      }).setOrigin(0.5, 0.5)
    );

    // Value cells
    const originX = cx - gridW / 2 + CELL / 2;
    const originY = cy - panelH / 2 + headerH + descH + CELL / 2;

    for (let v = 1; v <= maxVal; v++) {
      const col  = (v - 1) % cols;
      const row  = Math.floor((v - 1) / cols);
      const ax   = originX + col * CELL;
      const ay   = originY + row * CELL;
      const isActive = v === currentVal;

      const fb = this.add.rectangle(ax, ay, FACE, FACE,
        isActive ? 0x1a2e4a : 0x141428);
      fb.setStrokeStyle(isActive ? 2 : 1, typeColor, isActive ? 1 : 0.35);
      this.inspectorPanel.add(fb);

      this.inspectorPanel.add(
        this.add.text(ax, ay, String(v), {
          fontSize: '18px',
          color: isActive ? (ENEMY_DIE_TYPE_COLORS[data.type] ?? '#ffffff') : '#445566',
          fontStyle: isActive ? 'bold' : 'normal',
          stroke: '#000000', strokeThickness: isActive ? 3 : 1,
        }).setOrigin(0.5, 0.5)
      );
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

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); });
    this.inspectorPanel.add(dim);

    const cx = W / 2;
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
    const upgrades = (data.upgradeState?.takenUpgrades ?? []).map(id => UPGRADE_MAP[id]).filter(Boolean);

    // Panel is wider so upgrade descriptions have room to breathe
    const panelW   = 340;
    const WRAP_W   = panelW - 32;
    // Estimate lines per upgrade description (~42 chars/line at 12px in 308px)
    const upgItemH = (upg) => {
      const lines = Math.min(4, Math.max(1, Math.ceil((UPGRADE_DESCRIPTIONS[upg.id]?.length ?? 0) / 42)));
      return 20 + lines * 15 + 4;
    };
    const matH      = hasMaterial  ? 20 : 0;
    const runeH     = hasAnyRune   ? 52 : 0;
    const upgradeH  = upgrades.length > 0
      ? (20 + upgrades.reduce((s, u) => s + upgItemH(u), 0))
      : 0;
    const panelH    = netH + 56 + matH + runeH + upgradeH;

    // Vertically centre, clamped so panel stays on screen
    const cy = Math.max(panelH / 2 + 8, Math.min(H / 2, H - panelH / 2 - 8));

    const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x0a0a1e, 0.97);
    bg.setStrokeStyle(1.5, typeColor, 0.85).setInteractive();
    bg.on('pointerdown', () => this._hideInspector());
    this.inspectorPanel.add(bg);

    const closeBtn = this.add.text(cx + panelW / 2 - 14, cy - panelH / 2 + 16, '✕', {
      fontSize: '18px', color: '#666688',
    }).setOrigin(0.5, 0.5).setInteractive();
    closeBtn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this._suppressThrow = true; this._hideInspector(); });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#666688'));
    this.inspectorPanel.add(closeBtn);

    // Header: die type + sides
    this.inspectorPanel.add(
      this.add.text(cx, cy - panelH / 2 + 18, `${dt?.label ?? '?'}  d${data.sides}`, {
        fontSize: '18px', color: dt?.color ?? '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5)
    );

    // Material row
    if (hasMaterial) {
      const m = MATERIALS[data.material];
      this.inspectorPanel.add(
        this.add.text(cx, cy - panelH / 2 + 37, `${m.sym}  ${m.label}`, {
          fontSize: '13px', color: m.color,
        }).setOrigin(0.5, 0.5)
      );
    }

    const originX = cx - netW / 2;
    const originY = cy - panelH / 2 + 42 + matH;

    // Rune detail footer — populated when a rune face is tapped
    let runeLbl = null, runeDesc = null;
    if (hasAnyRune) {
      const footerCY = originY + netH + 26;
      const footerBg = this.add.rectangle(cx, footerCY, panelW - 8, 44, 0x0d0d1a);
      footerBg.setStrokeStyle(1, 0x1e1e38, 0.7);
      this.inspectorPanel.add(footerBg);

      runeLbl = this.add.text(cx, footerCY - 8, '◆  tap a rune face', {
        fontSize: '12px', color: '#2a2a44',
      }).setOrigin(0.5, 0.5);
      runeDesc = this.add.text(cx, footerCY + 10, '', {
        fontSize: '12px', color: '#667788', wordWrap: { width: WRAP_W }, align: 'center',
      }).setOrigin(0.5, 0.5);
      this.inspectorPanel.add(runeLbl);
      this.inspectorPanel.add(runeDesc);
    }

    // Face cells
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

    // Upgrades section — inline name + description, no tap required
    if (upgrades.length > 0) {
      const leftX = cx - panelW / 2 + 14;
      let uy = originY + netH + runeH + (hasAnyRune ? 10 : 14);

      this.inspectorPanel.add(
        this.add.text(cx, uy, 'UPGRADES', {
          fontSize: '11px', color: '#33334a', fontStyle: 'bold',
        }).setOrigin(0.5, 0)
      );
      uy += 18;

      upgrades.forEach(upg => {
        const desc  = UPGRADE_DESCRIPTIONS[upg.id] ?? '';
        const lines = Math.min(4, Math.max(1, Math.ceil(desc.length / 42)));

        this.inspectorPanel.add(
          this.add.text(leftX, uy, `◆  ${upg.name}`, {
            fontSize: '14px', color: upg.color ?? '#aaaaaa', fontStyle: 'bold',
          }).setOrigin(0, 0)
        );
        uy += 20;

        this.inspectorPanel.add(
          this.add.text(leftX + 8, uy, desc, {
            fontSize: '12px', color: '#778899',
            wordWrap: { width: WRAP_W - 8 },
          }).setOrigin(0, 0)
        );
        uy += lines * 15 + 4;
      });
    }

  }

  _hideInspector() {
    if (this.inspectorPanel) { this.inspectorPanel.destroy(true); this.inspectorPanel = null; }
  }

  // ─── SETTLE DETECTION ─────────────────────────────────────────────────────

  // Ground-truth check via actual body velocity — not the `_rolling` flag, which
  // can go stale: a die already marked settled can get knocked again later (e.g.
  // a shatter triggered by a later contact) without anything resetting `_rolling`.
  _anyPlayerDieMoving() {
    return this.allDice.some(d => {
      if (!d.isPlayer) return false;
      const v = d.img?.body?.velocity;
      return v && (Math.abs(v.x) >= SETTLE_VEL || Math.abs(v.y) >= SETTLE_VEL);
    });
  }

  _waitSettle(cb) {
    let attempts = 0;
    if (this._settleChecker) this._settleChecker.destroy();
    this._settleChecker = this.time.addEvent({
      delay: 220, startAt: 500, loop: true,
      callback: () => {
        attempts++;
        if (!this._anyPlayerDieMoving() || attempts > 22) {
          this._settleChecker.destroy(); this._settleChecker = null; cb();
        }
      }
    });
  }

  // ─── EFFECT QUEUE ─────────────────────────────────────────────────────────

  _addToEffectQueue(dieRef, opts = {}) {
    if (this._tutorialMode && !this._tutFirstSettled) this._tutFirstSettled = true;
    const { data } = dieRef;
    const settleVal = Math.floor(data.currentFaceIdx / 2) + 1;
    this._settledValuesThisTurn = this._settledValuesThisTurn ?? [];
    this._settledValuesThisTurn.push(settleVal);
    StatsManager.recordDieLanded(settleVal);

    // Finisher: +1 per die settled before it (applied at queue-add time)
    if (this._hasDieUpgrade(data, 'finisher')) {
      dieRef._valueBonus = (dieRef._valueBonus ?? 0) + Math.max(0, this.playerSettleCount - 1);
    }

    let value = settleVal;
    const type  = dieRef._mimicType ?? data.type;
    const x     = dieRef.img?.x ?? 0;
    const y     = dieRef.img?.y ?? 0;
    const entry = { dieRef, value, type, x, y, skipRune: opts.skipRune ?? false };

    // Vanguard: insert at front of queue
    if (this._hasDieUpgrade(data, 'vanguard')) {
      this._effectQueue.unshift(entry);
      const card = this._createQueueCard(entry, 0);
      this._queueCards.unshift(card);
      this._repositionQueueCards();
    } else {
      this._effectQueue.push(entry);
      const card = this._createQueueCard(entry, this._queueCards.length);
      this._queueCards.push(card);
    }

    // Finisher: always ensure it's last
    const finIdx = this._effectQueue.findIndex(e => this._hasDieUpgrade(e.dieRef.data, 'finisher'));
    if (finIdx !== -1 && finIdx !== this._effectQueue.length - 1) {
      const finEntry = this._effectQueue.splice(finIdx, 1)[0];
      const finCard  = this._queueCards.splice(finIdx, 1)[0];
      this._effectQueue.push(finEntry);
      this._queueCards.push(finCard);
      this._repositionQueueCards();
    }
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
    if (!card) { this._queueComplete(); return; }

    // Skip silently if the die was shattered before its turn to fire
    if (entry.dieRef.isPlayer && !this.allDice.includes(entry.dieRef)) {
      this._queueCards.shift();
      card.container.destroy();
      this._repositionQueueCards();
      this.time.delayedCall(50, () => this._processQueue());
      return;
    }

    // Pulse the card to signal it's firing
    card.container.setDepth(36);
    this.tweens.add({
      targets: card.container,
      scaleX: 1.15, scaleY: 1.15,
      duration: 180,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => {
        this._prevQueueEffect = this._currQueueEffect ?? null;
        this._currQueueEffect = null;
        this.bus.emit('ON_QUEUE_FIRE', { die: entry.dieRef });
        this._applyDieFaceImmediate(entry.dieRef, entry.skipRune ?? false, entry.x, entry.y);

        // Wait long enough for rune delays (e.g. Egyptian's 250ms) to initiate movement
        this.time.delayedCall(800, () => {
          const anyRolling = this._anyPlayerDieMoving();

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
      this._showMsg('All dice settled…');
      this.time.delayedCall(800, () => {
        if (this.phase === PHASE.PLAYER_ROLL) {
          this._hideCommitOverlay();
          this._commitPhase();
        }
      });
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

  // ─── SAVE / STATS ───────────────────────────────────────────────────────────

  _autosave() {
    SaveManager.save({
      playerDiceConfig: this.playerDiceConfig,
      battleIndex:      this.battleIndex,
      playerHp:         this.playerHp,
      playerMaxHp:      this.playerMaxHp,
      activeRelics:     this.activeRelics,
      playerGold:       this.playerGold,
      cullCount:        this.cullCount,
      witchRunes:       this.witchRunes,
    });
  }

  // ─── WIN / LOSE ───────────────────────────────────────────────────────────

  _victory() {
    this.phase = 99;
    this._setPhase('VICTORY!');
    this._showMsg(`${this.enemyDef.name} defeated!`);
    if (this._tutorialMode) {
      this._tutPollTimer?.remove();
      this.time.delayedCall(1000, () => {
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(80);
        this.add.text(W / 2, H / 2 - 32, 'Tutorial Complete!', {
          fontSize: '26px', color: '#f0c040', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(81);
        this.add.text(W / 2, H / 2 + 8, "You're ready for the real thing.", {
          fontSize: '16px', color: '#aabbcc',
        }).setOrigin(0.5).setDepth(81);
        this.add.text(W / 2, H / 2 + 42, 'Tap to choose your class', {
          fontSize: '14px', color: '#556677',
        }).setOrigin(0.5).setDepth(81);
        this.add.rectangle(W / 2, H / 2, W, H, 0, 0).setDepth(82).setInteractive()
          .on('pointerdown', () => this.scene.start('SetupScene'));
      });
      return;
    }
    StatsManager.recordBattleWin({ isBoss: this.enemyDef.tier === 'boss' });
    this.playerGold += 10;
    this.time.delayedCall(1400, () => this.scene.start('UpgradeScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      playerMaxHp:      this.playerMaxHp,
      battleIndex:      this.battleIndex + 1,
      isBossReward:     this.enemyDef.tier === 'boss',
      activeRelics:     this.activeRelics,
      playerGold:       this.playerGold,
      cullCount:        this.cullCount,
      witchRunes:       this.witchRunes,
    }));
  }

  _gameOver() {
    this.phase = 99;
    this._setPhase('GAME OVER');
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(80);

    this.add.text(W / 2, H / 2 - 64, 'GAME OVER', {
      fontSize: '34px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(81);

    const battlesWon = this._tutorialMode ? 0 : (this.battleIndex ?? 0);
    const cause = this.poisonStacks > 0 ? 'poison' : 'direct attack';

    if (!this._tutorialMode) {
      StatsManager.recordRunEnd();
      SaveManager.clear();
    }

    this.add.text(W / 2, H / 2 - 4, `${battlesWon} battle${battlesWon !== 1 ? 's' : ''} survived`, {
      fontSize: '17px', color: '#8aaabb',
    }).setOrigin(0.5).setDepth(81);

    this.add.text(W / 2, H / 2 + 22, `defeated by  ${this.enemyDef.name.toUpperCase()}`, {
      fontSize: '14px', color: this.enemyDef.color,
    }).setOrigin(0.5).setDepth(81);

    this.add.text(W / 2, H / 2 + 44, `cause: ${cause}`, {
      fontSize: '12px', color: '#5a7a8a',
    }).setOrigin(0.5).setDepth(81);

    this.add.text(W / 2, H / 2 + 80, 'tap to restart', {
      fontSize: '15px', color: '#445566',
    }).setOrigin(0.5).setDepth(81);

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(82).setInteractive()
      .on('pointerdown', () => {
        if (!this._tutorialMode) StatsManager.recordRunStart();
        this.scene.start('BattleScene',
          this._tutorialMode
            ? { enemyKey: 'training_dummy', tutorial: true,
                playerDiceConfig: this.playerDiceConfig,
                playerHp: this.playerMaxHp, playerMaxHp: this.playerMaxHp }
            : {}
        );
      });
  }

  // ─── UI HELPERS ───────────────────────────────────────────────────────────

  _setPhase(txt) {
    if (!this.phaseTxt || this.phaseTxt.text === txt) return;
    this.tweens.killTweensOf(this.phaseTxt);
    this.tweens.add({
      targets: this.phaseTxt, alpha: 0, duration: 80,
      onComplete: () => {
        this.phaseTxt.setText(txt);
        this.tweens.add({ targets: this.phaseTxt, alpha: 1, duration: 160 });
      },
    });
  }
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
      if (d.crackGfx?.active) d.crackGfx.setPosition(d.img.x, d.img.y);

      if (!d._rolling) {
        // An already-settled die can get knocked again later (e.g. a shatter-chain
        // collision) without going through the normal reroll-on-collision path.
        // Without this it'd slide around with nothing tracking it — never re-queued,
        // its motion never resolving into an effect. Re-arm it like a fresh reroll.
        if (d.isPlayer) {
          const v = d.img.body?.velocity;
          // Use MIN_REROLL_VEL, not SETTLE_VEL — Matter.js keeps tiny residual
          // jitter on settled bodies that would otherwise trigger a reroll every frame.
          const speed = Math.hypot(v.x, v.y);
          if (speed >= MIN_REROLL_VEL) {
            this._rerollDie(d);
          }
        }
        return;
      }

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
          if (this._omenValue !== null) {
            const active = this._getActiveFaceIndices(d.data);
            let bestIdx = active[0], bestDiff = Infinity;
            for (const idx of active) {
              const v    = Math.floor(idx / 2) + 1;
              const diff = Math.abs(v - this._omenValue);
              if (diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
            }
            d.data.currentFaceIdx = bestIdx;
            d._finalFaceIdx       = bestIdx;
            this._omenValue       = null;
            this._floatText(d.img.x, d.img.y - 32, 'OMEN', '#f0c040');
          }
          this.playerSettleCount++;
          d._settleOrder = this.playerSettleCount;
          this._addToEffectQueue(d);
          if (!this._queueActive) this._startQueue();
          this.bus.emit('ON_SETTLE', { die: d });
        } else if (d.data.faces) {
          const finalFace   = FACES[d.data.faces[d._finalFaceIdx]];
          const fShowVal    = finalFace?.effect === 'enemy_damage' || finalFace?.effect === 'enemy_block';
          d.lbl.setText((fShowVal && finalFace.value !== undefined) ? String(finalFace.value) : (finalFace ? finalFace.sym : '--'));
          d.lbl.setColor(finalFace ? finalFace.color : '#ffffff');
          d.valLbl.setText(fShowVal ? '' : (finalFace?.value !== undefined ? String(finalFace.value) : ''));
        } else if (d.data.type && !d.data.isObstacle) {
          // Enemy combat die — lock in final value display
          d.lbl.setText(ENEMY_DIE_TYPE_SYMS[d.data.type] ?? '?');
          d.lbl.setColor(ENEMY_DIE_TYPE_COLORS[d.data.type] ?? '#ffffff');
          d.valLbl.setText(String((Math.floor(d._finalFaceIdx / 2) + 1) * 2));
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
            if (d.data.type && !d.data.isObstacle) {
              // Enemy combat die — cycle value, keep type sym fixed
              const randIdx = Phaser.Math.Between(0, (d.data.sides ?? 6) - 1);
              d.lbl.setText(ENEMY_DIE_TYPE_SYMS[d.data.type] ?? '?');
              d.lbl.setColor(ENEMY_DIE_TYPE_COLORS[d.data.type] ?? '#ffffff');
              d.valLbl.setText(String(Math.floor(randIdx / 2) + 1));
            } else if (d.data.faces) {
              const randFace  = FACES[d.data.faces[Phaser.Math.Between(0, d.data.faces.length - 1)]];
              const rShowVal  = randFace?.effect === 'enemy_damage' || randFace?.effect === 'enemy_block';
              d.lbl.setText((rShowVal && randFace.value !== undefined) ? String(randFace.value) : (randFace ? randFace.sym : '--'));
              d.lbl.setColor(randFace ? randFace.color : '#ffffff');
              d.valLbl.setText(rShowVal ? '' : (randFace?.value !== undefined ? String(randFace.value) : ''));
            }
            // else: obstacle die — no cycling
          }
        }
      }
    });
  }

  // ─── TUTORIAL ─────────────────────────────────────────────────────────────

  _initTutorial() {
    this._tutStep         = -1;
    this._tutPanel        = null;
    this._tutFirstSettled = false;
    this._tutIntentViewed = false;
    this._tutTurnCount    = 0;
    this._throwLocked     = true;

    this.time.delayedCall(700, () => this._showTutPanel(0));

    this._tutPollTimer = this.time.addEvent({ delay: 350, loop: true, callback: () => {
      if (this._tutPanel) return;
      if (this._tutStep === 2 && this._tutIntentViewed)                                         this._showTutPanel(3);
      if (this._tutStep === 4 && this._tutFirstSettled)                                         this._showTutPanel(5);
      if (this._tutStep === 5 && !this._queueActive && this.throwCount >= this.trayCards.length) this._showTutPanel(6);
      if (this._tutStep === 6 && this.phase === PHASE.COMMIT)                                   this._showTutPanel(7);
      if (this._tutStep === 7 && this._tutTurnCount >= 2)                                       this._showTutPanel(8);
    }});
  }

  _showTutPanel(step) {
    this._closeTutPanel();
    this._tutStep = step;

    const STEPS = [
      {
        title: 'Welcome to Dicemore!',
        body:  'Defeat the enemy by throwing your dice at them. Tap anywhere to step through this guide.',
        y:     H / 2,
      },
      {
        title: 'Your Enemy',
        body:  'That glowing circle above is the enemy. The arc around it shows their remaining HP — drain it to zero to win.',
        y:     490,
      },
      {
        title: 'Enemy Dice',
        body:  'The enemy also rolls dice! Their dice land on the table alongside yours. Tap the enemy circle to see what their dice rolled.',
        y:     490,
      },
      {
        title: 'Throwing Dice',
        body:  'Tap and drag from anywhere on the screen to aim, then release to throw. Hitting the enemy deals extra damage!',
        y:     580,
      },
      {
        title: 'Bonus Tip — Rerolls!',
        body:  'If your die collides with another die mid-air, it rerolls and may land on a higher value. Use your throws to chain collisions for bonus results!',
        y:     580,
        onDismiss: () => { this._throwLocked = false; },
      },
      {
        title: 'Nice Throw!',
        body:  'The number the die lands on is its effect value. ATK dice deal that much damage. BLK dice give you that much shield. Throw your remaining dice!',
        y:     H / 2,
      },
      {
        title: 'End of Turn',
        body:  'Once all your dice have resolved, the turn ends automatically — the enemy will then act on their intent.',
        y:     H / 2,
      },
      {
        title: 'Enemy Turn',
        body:  'The enemy acted! Your shield absorbs damage first. Once it\'s gone, the damage hits your HP. Shield resets at the start of each turn.',
        y:     490,
      },
      {
        title: "You've got it!",
        body:  'Throw dice, build shield, deal damage, watch the enemy intent — repeat until one side falls. Good luck!',
        y:     H / 2,
        onDismiss: () => { this._tutorialMode = false; this._tutPollTimer?.remove(); },
      },
    ];

    const cfg = STEPS[step];
    if (!cfg) return;

    const advance = () => {
      cfg.onDismiss?.();
      this._closeTutPanel();
      if (step === 0 || step === 1 || step === 3) this._showTutPanel(step + 1);
    };

    const panW = W - 40, panH = 148;
    const panY = cfg.y;

    this._tutPanel = this.add.container(0, 0).setDepth(85);

    // Full-screen dim — tap anywhere advances
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
    dim.on('pointerdown', advance);
    this._tutPanel.add(dim);

    const bg = this.add.rectangle(W / 2, panY, panW, panH, 0x07090f).setInteractive();
    bg.setStrokeStyle(2, 0xf0c040, 0.85);
    bg.on('pointerdown', advance);
    this._tutPanel.add(bg);

    this._tutPanel.add(this.add.text(W / 2, panY - panH / 2 + 24, cfg.title, {
      fontSize: '17px', color: '#f0c040', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    this._tutPanel.add(this.add.text(W / 2, panY, cfg.body, {
      fontSize: '13px', color: '#aabbcc', wordWrap: { width: panW - 32 }, align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0.5));

    this._tutPanel.add(this.add.text(W / 2, panY + panH / 2 - 16, 'tap anywhere to continue', {
      fontSize: '10px', color: '#567090', fontStyle: 'italic',
    }).setOrigin(0.5, 0.5));

    this._tutPanel.add(this.add.text(W / 2 + panW / 2 - 12, panY - panH / 2 + 12,
      `${step + 1}/${STEPS.length}`, {
      fontSize: '10px', color: '#2a3448',
    }).setOrigin(1, 0.5));

    this._tutPanel.setAlpha(0);
    this._tutPanel.y = 12;
    this.tweens.add({ targets: this._tutPanel, alpha: 1, y: 0, duration: 180, ease: 'Sine.Out' });
  }

  _closeTutPanel() {
    if (!this._tutPanel) return;
    const p = this._tutPanel;
    this._tutPanel = null;
    this.tweens.add({ targets: p, alpha: 0, y: -10, duration: 140,
      onComplete: () => p.destroy(true) });
  }
}
