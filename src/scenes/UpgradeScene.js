import Phaser from 'phaser';
import { DIE_TYPES, SIDES_PROGRESSION } from '../data/dice.js';
import { RUNES, MATERIALS, RUNE_KEYS, MATERIAL_KEYS } from '../data/runes.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';

const CARD_W      = W - 32;
const CARD_H      = 110;
const CARD_GAP    = 12;
const CARDS_TOP   = 104;

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  init(data) {
    this.playerDiceConfig = JSON.parse(JSON.stringify(data.playerDiceConfig));
    this.playerHp         = data.playerHp;
    this.battleIndex      = data.battleIndex;
    this.isBossReward     = data.isBossReward ?? false;
    this._upgrades        = [];
    this._screenObjects   = [];
    this._stepLbl         = null;
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);
    this._buildHeader();
    if (this.isBossReward) {
      this._showBossRewardStep();
    } else {
      this._upgrades = this._buildPool();
      this._showCardStep();
    }
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────

  _buildHeader() {
    this.add.text(W / 2, 26, 'UPGRADE', {
      fontSize: '22px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);

    const hpPct = Math.max(0, this.playerHp) / PLAYER_MAX_HP;
    this.add.text(W / 2, 52, `HP: ${Math.max(0, this.playerHp)} / ${PLAYER_MAX_HP}`, {
      fontSize: '15px', color: '#2ecc71',
    }).setOrigin(0.5);

    const g = this.add.graphics();
    g.fillStyle(0x27ae60);
    g.fillRect(W / 2 - 80, 62, 160 * hpPct, 5);
    g.lineStyle(1, 0x1a6a3a);
    g.strokeRect(W / 2 - 80, 62, 160, 5);

    this._stepLbl = this.add.text(W / 2, 82, '', {
      fontSize: '15px', color: '#334455',
    }).setOrigin(0.5);
  }

  // ─── POOL GENERATION ─────────────────────────────────────────────────────

  _buildPool() {
    const pool = [];

    // increase_tier — only if at least one die is below max tier
    const canTier = this.playerDiceConfig.some(
      dc => SIDES_PROGRESSION.indexOf(dc.sides) < SIDES_PROGRESSION.length - 1
    );
    if (canTier) {
      pool.push({
        type: 'increase_tier', color: '#f0c040',
        title: 'Increase Dice Tier',
        desc:  'Choose a die to advance to the next tier',
      });
    }

    // cull — always available
    pool.push({
      type: 'cull', color: '#ff6644',
      title: 'Cull a Face',
      desc:  'Permanently remove one face value from a die',
    });

    // add_rune — random rune
    const runeId = RUNE_KEYS[Phaser.Math.Between(0, RUNE_KEYS.length - 1)];
    const rune   = RUNES[runeId];
    pool.push({
      type: 'add_rune', runeId, color: rune.color,
      title: `Add Rune: ${rune.label}`,
      desc:  rune.desc,
    });

    // add_material — random material
    const matId = MATERIAL_KEYS[Phaser.Math.Between(0, MATERIAL_KEYS.length - 1)];
    const mat   = MATERIALS[matId];
    pool.push({
      type: 'add_material', matId, color: mat.color,
      title: `Material: ${mat.label}`,
      desc:  mat.desc,
    });

    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, 3);
  }

  // ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────

  _clearScreen() {
    this._screenObjects.forEach(o => { try { o?.destroy(); } catch (_) {} });
    this._screenObjects = [];
  }

  _track(obj) {
    this._screenObjects.push(obj);
    return obj;
  }

  // ─── STEP 1: CARD SELECTION ──────────────────────────────────────────────

  _showCardStep() {
    this._clearScreen();
    this._stepLbl?.setText('Choose an upgrade — or skip.');

    this._upgrades.forEach((upg, i) => {
      const cy = CARDS_TOP + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      const fc = parseInt(upg.color.replace('#', ''), 16);

      const bg = this._track(this.add.rectangle(W / 2, cy, CARD_W, CARD_H, 0x0d0d1c));
      bg.setStrokeStyle(1.5, fc, 0.55).setInteractive();

      this._track(this.add.rectangle(16, cy, 4, CARD_H - 16, fc, 0.7));

      this._track(this.add.text(30, cy - 24, upg.title, {
        fontSize: '17px', color: upg.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      this._track(this.add.text(30, cy + 8, upg.desc, {
        fontSize: '14px', color: '#556677', wordWrap: { width: CARD_W - 56 },
      }).setOrigin(0, 0.5));

      const arrow = this._track(this.add.text(W - 24, cy, '→', {
        fontSize: '20px', color: '#2a2a3a',
      }).setOrigin(0.5));

      bg.on('pointerdown', () => this._onCardSelected(upg));
      bg.on('pointerover',  () => { bg.setFillStyle(0x181828); bg.setStrokeStyle(2, fc, 0.9); arrow.setColor(upg.color); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x0d0d1c); bg.setStrokeStyle(1.5, fc, 0.55); arrow.setColor('#2a2a3a'); });
    });

    this._addSkipButton();
  }

  _onCardSelected(upg) {
    this._showDiePicker(upg);
  }

  // ─── STEP 2: DIE PICKER ──────────────────────────────────────────────────

  _showDiePicker(upg) {
    this._clearScreen();
    this._stepLbl?.setText('Choose a die.');

    const fc = parseInt(upg.color.replace('#', ''), 16);

    this._track(this.add.text(W / 2, CARDS_TOP, upg.title, {
      fontSize: '17px', color: upg.color, fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const sz = 64, gap = 10;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY   = CARDS_TOP + 80;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt    = DIE_TYPES[dc.type];
      const tcol  = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const isDisabled = upg.type === 'increase_tier'
        && SIDES_PROGRESSION.indexOf(dc.sides) >= SIDES_PROGRESSION.length - 1;

      const x = startX + dieIdx * (sz + gap);

      const bg = this._track(this.add.rectangle(x, rowY, sz, sz, 0x0d0d1c));
      bg.setStrokeStyle(2, tcol, isDisabled ? 0.18 : 0.8);
      if (!isDisabled) bg.setInteractive();

      this._track(this.add.text(x, rowY - 12, dt ? dt.sym : '?', {
        fontSize: '15px', color: isDisabled ? '#333344' : (dt ? dt.color : '#ffffff'),
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5));

      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '13px', color: isDisabled ? '#333344' : '#aaaaaa',
      }).setOrigin(0.5, 0.5));

      if (dc.culledFaces?.length > 0) {
        this._track(this.add.text(x + sz / 2 - 6, rowY - sz / 2 + 6, `✕${dc.culledFaces.length}`, {
          fontSize: '10px', color: '#ff6644',
        }).setOrigin(1, 0));
      }

      if (dc.material) {
        const m = MATERIALS[dc.material];
        this._track(this.add.text(x - sz / 2 + 2, rowY - sz / 2 + 6, m ? m.sym : '?', {
          fontSize: '9px', color: m ? m.color : '#aaaaaa',
        }).setOrigin(0, 0));
      }

      if (!isDisabled) {
        bg.on('pointerdown', () => this._onDieSelected(upg, dieIdx));
        bg.on('pointerover',  () => bg.setFillStyle(0x181828));
        bg.on('pointerout',   () => bg.setFillStyle(0x0d0d1c));
      }
    });

    this._addBackButton(() => this._showCardStep());
  }

  _onDieSelected(upg, dieIdx) {
    if (upg.type === 'add_rune' || upg.type === 'cull') {
      this._showFacePicker(upg, dieIdx);
    } else {
      this._applyUpgrade(upg, dieIdx, -1);
    }
  }

  // ─── STEP 3: FACE PICKER ─────────────────────────────────────────────────

  _showFacePicker(upg, dieIdx) {
    this._clearScreen();
    const dc = this.playerDiceConfig[dieIdx];
    const dt = DIE_TYPES[dc.type];

    this._stepLbl?.setText(
      upg.type === 'cull' ? 'Choose a face to cull.' : 'Choose a face for the rune.'
    );

    this._track(this.add.text(W / 2, CARDS_TOP, `${dt?.label ?? '?'}  d${dc.sides}`, {
      fontSize: '17px', color: dt ? dt.color : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const CELL = 46, FACE = 41;
    let facePositions, netW, netH;

    if (dc.sides === 6) {
      const NET = [
        { col: 1, row: 0 },
        { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
        { col: 1, row: 2 },
        { col: 1, row: 3 },
      ];
      netW = 3 * CELL;
      netH = 4 * CELL;
      facePositions = NET.map(({ col, row }) => ({
        fx: col * CELL + CELL / 2, fy: row * CELL + CELL / 2,
      }));
    } else {
      const cols = 4;
      const rows = Math.ceil(dc.sides / cols);
      netW = cols * CELL;
      netH = rows * CELL;
      facePositions = Array.from({ length: dc.sides }, (_, fi) => {
        const col = fi % cols, row = Math.floor(fi / cols);
        const rowCount = Math.min(cols, dc.sides - row * cols);
        const rowOx = (netW - (rowCount - 1) * CELL) / 2;
        return { fx: rowOx + col * CELL, fy: row * CELL + CELL / 2 };
      });
    }

    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;
    const originX   = W / 2 - netW / 2;
    const originY   = CARDS_TOP + 30;

    const activeCount = dc.sides - (dc.culledFaces?.length ?? 0);

    facePositions.forEach(({ fx, fy }, fi) => {
      const ax         = originX + fx;
      const ay         = originY + fy;
      const faceValue  = fi + 1;
      const isCulled   = (dc.culledFaces ?? []).includes(faceValue);
      const runeOnFace = !isCulled ? dc.runeMap?.[fi] : null;
      // Can't cull: already culled, or would leave 0 active faces
      const isSelectable = !isCulled && !(upg.type === 'cull' && activeCount <= 1);

      const fb = this._track(this.add.rectangle(ax, ay, FACE, FACE,
        isCulled ? 0x0a0a14 : 0x141428
      ));
      fb.setStrokeStyle(
        1,
        isCulled ? 0x333344 : (runeOnFace ? 0xf0c040 : typeColor),
        isCulled ? 0.2 : 0.6
      );
      if (isSelectable) fb.setInteractive();

      this._track(this.add.text(ax, ay, isCulled ? '✕' : String(faceValue), {
        fontSize: '17px',
        color: isCulled ? '#2a2a3a' : '#aaaaaa',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5, 0.5));

      if (runeOnFace) {
        const r = RUNES[runeOnFace];
        this._track(this.add.text(ax + 14, ay - 14, r?.sym ?? '◆', {
          fontSize: '9px', color: r?.color ?? '#f0c040',
        }).setOrigin(0.5, 0.5));
      }

      if (isSelectable) {
        fb.on('pointerdown', () => this._onFaceSelected(upg, dieIdx, faceValue));
        fb.on('pointerover',  () => { fb.setFillStyle(0x1a2e4a); fb.setStrokeStyle(2, typeColor, 0.9); });
        fb.on('pointerout',   () => { fb.setFillStyle(0x141428); fb.setStrokeStyle(1, runeOnFace ? 0xf0c040 : typeColor, 0.6); });
      }
    });

    this._addBackButton(() => this._showDiePicker(upg));
  }

  _onFaceSelected(upg, dieIdx, faceValue) {
    const dc = this.playerDiceConfig[dieIdx];
    if (upg.type === 'cull' && dc.runeMap?.[faceValue - 1]) {
      this._showCullWarning(upg, dieIdx, faceValue);
    } else {
      this._applyUpgrade(upg, dieIdx, faceValue);
    }
  }

  // ─── CULL WARNING ────────────────────────────────────────────────────────

  _showCullWarning(upg, dieIdx, faceValue) {
    const dc   = this.playerDiceConfig[dieIdx];
    const rune = RUNES[dc.runeMap[faceValue - 1]];

    const dim = this._track(
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive()
    );

    const panelH = 188;
    const py     = H / 2;

    this._track(this.add.rectangle(W / 2, py, W - 40, panelH, 0x0d0d1c))
      .setStrokeStyle(1.5, 0xff6644, 0.9);

    this._track(this.add.text(W / 2, py - 70, '⚠  Rune Will Be Removed', {
      fontSize: '15px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    this._track(this.add.text(W / 2, py - 24, [
      `Face ${faceValue} carries the ${rune?.label ?? '?'} rune.`,
      'Culling it will permanently remove the rune.',
    ].join('\n'), {
      fontSize: '14px', color: '#aaaaaa', align: 'center',
      wordWrap: { width: W - 72 },
    }).setOrigin(0.5, 0.5));

    const cancelBg = this._track(
      this.add.rectangle(W / 2 - 72, py + 56, 120, 40, 0x1a1a2e).setInteractive()
    );
    cancelBg.setStrokeStyle(1, 0x446688, 0.8);
    cancelBg.on('pointerdown', () => this._showFacePicker(upg, dieIdx));
    cancelBg.on('pointerover',  () => cancelBg.setFillStyle(0x2a2a44));
    cancelBg.on('pointerout',   () => cancelBg.setFillStyle(0x1a1a2e));
    this._track(this.add.text(W / 2 - 72, py + 56, 'Cancel', {
      fontSize: '15px', color: '#446688',
    }).setOrigin(0.5, 0.5));

    const cullBg = this._track(
      this.add.rectangle(W / 2 + 72, py + 56, 120, 40, 0x3a1000).setInteractive()
    );
    cullBg.setStrokeStyle(1, 0xff6644, 0.8);
    cullBg.on('pointerdown', () => this._applyUpgrade(upg, dieIdx, faceValue));
    cullBg.on('pointerover',  () => cullBg.setFillStyle(0x6a2200));
    cullBg.on('pointerout',   () => cullBg.setFillStyle(0x3a1000));
    this._track(this.add.text(W / 2 + 72, py + 56, 'Cull Anyway', {
      fontSize: '15px', color: '#ff6644',
    }).setOrigin(0.5, 0.5));
  }

  // ─── APPLY ───────────────────────────────────────────────────────────────

  _applyUpgrade(upg, dieIdx, faceValue) {
    const dc = dieIdx >= 0 ? this.playerDiceConfig[dieIdx] : null;

    switch (upg.type) {
      case 'increase_tier': {
        const sIdx = SIDES_PROGRESSION.indexOf(dc.sides);
        dc.sides   = SIDES_PROGRESSION[sIdx + 1];
        break;
      }
      case 'cull': {
        if (!dc.culledFaces) dc.culledFaces = [];
        dc.culledFaces.push(faceValue);
        delete dc.runeMap[faceValue - 1];
        break;
      }
      case 'add_rune': {
        if (!dc.runeMap) dc.runeMap = {};
        dc.runeMap[faceValue - 1] = upg.runeId;
        break;
      }
      case 'add_material': {
        dc.material = upg.matId;
        break;
      }
    }

    this._continue();
  }

  // ─── BOSS REWARD ─────────────────────────────────────────────────────────

  _showBossRewardStep() {
    this._clearScreen();
    this._stepLbl?.setText('BOSS CLEARED — add a special die to your bag.');

    const SPECIAL_DICE = [
      {
        type: 'leech',  color: '#aa44ff',
        title: 'Leech Die',
        desc:  'Deals piercing damage and heals you for every point drained',
      },
      {
        type: 'poison', color: '#58d68d',
        title: 'Poison Die',
        desc:  'Stacks poison on the enemy — they take damage each turn and it decays slowly',
      },
      {
        type: 'hex',    color: '#9b59b6',
        title: 'Hex Die',
        desc:  'Curses the enemy this turn, halving all damage they deal when they commit',
      },
      {
        type: 'bomb',   color: '#ff6622',
        title: 'Bomb Die',
        desc:  'Deals double damage — but the explosion recoils back onto you',
      },
    ];

    SPECIAL_DICE.forEach((sd, i) => {
      const cy = CARDS_TOP + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      const fc = parseInt(sd.color.replace('#', ''), 16);

      const bg = this._track(this.add.rectangle(W / 2, cy, CARD_W, CARD_H, 0x0d0d1c));
      bg.setStrokeStyle(1.5, fc, 0.55).setInteractive();

      this._track(this.add.rectangle(16, cy, 4, CARD_H - 16, fc, 0.7));

      this._track(this.add.text(30, cy - 24, sd.title, {
        fontSize: '17px', color: sd.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      this._track(this.add.text(30, cy + 8, sd.desc, {
        fontSize: '14px', color: '#556677', wordWrap: { width: CARD_W - 56 },
      }).setOrigin(0, 0.5));

      const arrow = this._track(this.add.text(W - 24, cy, '→', {
        fontSize: '20px', color: '#2a2a3a',
      }).setOrigin(0.5));

      bg.on('pointerdown', () => this._onSpecialDieSelected(sd.type));
      bg.on('pointerover',  () => { bg.setFillStyle(0x181828); bg.setStrokeStyle(2, fc, 0.9); arrow.setColor(sd.color); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x0d0d1c); bg.setStrokeStyle(1.5, fc, 0.55); arrow.setColor('#2a2a3a'); });
    });

    this._addSkipButton();
  }

  _onSpecialDieSelected(dieType) {
    this.playerDiceConfig.push({
      id: `boss_${Date.now()}`, type: dieType, sides: 6,
      runeMap: {}, material: null, culledFaces: [],
    });
    this._continue();
  }

  // ─── NAV HELPERS ─────────────────────────────────────────────────────────

  _addSkipButton() {
    const y = H - 44;
    const bg = this._track(this.add.rectangle(W / 2, y, W - 16, 50, 0x1a1a2e).setInteractive());
    bg.setStrokeStyle(1, 0x2a2a4a, 0.8);
    bg.on('pointerdown', () => this._continue());
    bg.on('pointerover',  () => bg.setFillStyle(0x2a2a44));
    bg.on('pointerout',   () => bg.setFillStyle(0x1a1a2e));
    this._track(this.add.text(W / 2, y, 'Skip', {
      fontSize: '17px', color: '#445566',
    }).setOrigin(0.5));
  }

  _addBackButton(onBack) {
    const y = H - 44;
    const bg = this._track(this.add.rectangle(W / 2, y, W - 16, 50, 0x1a1a2e).setInteractive());
    bg.setStrokeStyle(1, 0x2a2a4a, 0.8);
    bg.on('pointerdown', onBack);
    bg.on('pointerover',  () => bg.setFillStyle(0x2a2a44));
    bg.on('pointerout',   () => bg.setFillStyle(0x1a1a2e));
    this._track(this.add.text(W / 2, y, '← Back', {
      fontSize: '17px', color: '#445566',
    }).setOrigin(0.5));
  }

  _continue() {
    this.scene.start('BattleScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      rerollTokens:     1,
      battleIndex:      this.battleIndex,
    });
  }
}
