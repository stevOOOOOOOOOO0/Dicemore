import Phaser from 'phaser';
import { FACES, PLAYER_TOKENS, ENEMIES } from '../data/faces.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';
import { RUNES, MATERIALS, RUNE_KEYS, MATERIAL_KEYS } from '../data/runes.js';

const ENEMY_KEYS = ['grunt', 'soldier', 'captain'];

export default class SetupScene extends Phaser.Scene {
  constructor() { super({ key: 'SetupScene' }); }

  create() {
    this._enemyKey   = null;
    this._diceCount  = 2;
    this._diceConfig = [];
    this._stepGroup  = null;
    this._faceObjs   = [];
    this._runeObjs   = [];
    this._picker     = null;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    this._showEnemyStep();
  }

  // ─── TRANSITIONS ─────────────────────────────────────────────────────────

  _clearStep() {
    if (this._picker)    { this._picker.destroy(true);    this._picker    = null; }
    if (this._stepGroup) { this._stepGroup.destroy(true); this._stepGroup = null; }
    this._faceObjs = [];
    this._runeObjs = [];
  }

  _transitionTo(nextFn) {
    this._closePicker();
    this.tweens.add({
      targets: this._stepGroup, alpha: 0, duration: 160,
      onComplete: () => { this._clearStep(); nextFn(); }
    });
  }

  _fadeIn(group) {
    group.setAlpha(0);
    this.tweens.add({ targets: group, alpha: 1, duration: 220, ease: 'Sine.Out' });
  }

  _addBackBtn(g, fn) {
    const btn = this.add.text(20, H - 44, '←', {
      fontSize: '20px', color: '#2a3a4a'
    }).setOrigin(0, 0.5).setInteractive();
    btn.on('pointerdown', () => this._transitionTo(fn));
    btn.on('pointerover',  () => btn.setColor('#8899aa'));
    btn.on('pointerout',   () => btn.setColor('#2a3a4a'));
    g.add(btn);
  }

  // ─── STEP 1: ENEMY SELECTION ─────────────────────────────────────────────

  _showEnemyStep() {
    const g = this._stepGroup = this.add.container(0, 0);

    g.add(this.add.text(W / 2, 52, 'DICEMORE', {
      fontSize: '28px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4
    }).setOrigin(0.5));

    g.add(this.add.text(W / 2, 92, 'CHOOSE YOUR ENEMY', {
      fontSize: '10px', color: '#2a3848', letterSpacing: 3
    }).setOrigin(0.5));

    const cardW = 108, cardH = 210;
    const hGap  = (W - ENEMY_KEYS.length * cardW) / (ENEMY_KEYS.length + 1);

    ENEMY_KEYS.forEach((key, i) => {
      const def = ENEMIES[key];
      const col = parseInt(def.color.replace('#', ''), 16);
      const cx  = hGap + i * (cardW + hGap) + cardW / 2;
      const cy  = 340;

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x131320);
      bg.setStrokeStyle(1.5, col, 0.55).setInteractive();
      g.add(bg);

      g.add(this.add.text(cx, cy - 88, def.name.toUpperCase(), {
        fontSize: '13px', color: def.color, fontStyle: 'bold', letterSpacing: 1
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy - 70, def.tier.toUpperCase(), {
        fontSize: '8px', color: '#263545', letterSpacing: 2
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy - 34, `${def.hp}`, {
        fontSize: '36px', color: '#ddeeff', fontStyle: 'bold'
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 10, 'HP', {
        fontSize: '9px', color: '#334455', letterSpacing: 2
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 38, `${def.dice.length} ${def.dice.length === 1 ? 'die' : 'dice'}`, {
        fontSize: '11px', color: '#445566'
      }).setOrigin(0.5));

      // Unique face chips
      const unique = [...new Set(def.dice.flatMap(d => d.faces))].slice(0, 4);
      unique.forEach((fid, fi) => {
        const face   = FACES[fid];
        const fc     = face ? parseInt(face.color.replace('#', ''), 16) : 0x333344;
        const chipX  = cx - ((unique.length - 1) * 19) / 2 + fi * 19;
        const chip   = this.add.rectangle(chipX, cy + 76, 15, 15, 0x0a0a18);
        chip.setStrokeStyle(1, fc, 0.7);
        g.add(chip);
        g.add(this.add.text(chipX, cy + 76, face?.sym?.substring(0, 3) ?? '--', {
          fontSize: '5px', color: face?.color ?? '#444466'
        }).setOrigin(0.5));
      });

      bg.on('pointerdown', () => {
        this._enemyKey = key;
        this._transitionTo(() => this._showCountStep());
      });
      bg.on('pointerover',  () => bg.setFillStyle(0x1c1c2e));
      bg.on('pointerout',   () => bg.setFillStyle(0x131320));
    });

    g.add(this.add.text(W / 2, H - 28, 'tap to select', {
      fontSize: '9px', color: '#1c2838', letterSpacing: 1
    }).setOrigin(0.5));

    this._fadeIn(g);
  }

  // ─── STEP 2: DICE COUNT ───────────────────────────────────────────────────

  _showCountStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    const def = ENEMIES[this._enemyKey];

    g.add(this.add.text(W / 2, 80, 'HOW MANY DICE?', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 118, `vs. ${def.name}  ·  ${def.hp} HP  ·  ${def.dice.length} ${def.dice.length === 1 ? 'die' : 'dice'}`, {
      fontSize: '11px', color: '#2a3848'
    }).setOrigin(0.5));

    const btnW = 96, btnH = 86;
    const cols = 3;
    const hGap = (W - cols * btnW) / (cols + 1);
    const row1Y = H / 2 - 66;
    const row2Y = H / 2 + 36;

    [1, 2, 3, 4, 5, 6].forEach(n => {
      const col = (n - 1) % cols;
      const row = Math.floor((n - 1) / cols);
      const x   = hGap + col * (btnW + hGap) + btnW / 2;
      const y   = row === 0 ? row1Y : row2Y;

      const bg = this.add.rectangle(x, y, btnW, btnH, 0x131320);
      bg.setStrokeStyle(1.5, 0x2a3a5a, 0.9).setInteractive();
      g.add(bg);
      g.add(this.add.text(x, y - 16, `${n}`, {
        fontSize: '34px', color: '#ddeeff', fontStyle: 'bold'
      }).setOrigin(0.5));
      g.add(this.add.text(x, y + 24, n === 1 ? 'die' : 'dice', {
        fontSize: '10px', color: '#334455', letterSpacing: 1
      }).setOrigin(0.5));

      bg.on('pointerdown', () => {
        this._diceCount  = n;
        this._diceConfig = Array.from({ length: n }, (_, j) => ({
          id: `custom_${j}`, faces: Array(6).fill('blank'),
          rune: null, runeFaceIdx: -1, material: null
        }));
        this._transitionTo(() => this._showBuildStep());
      });
      bg.on('pointerover',  () => { bg.setFillStyle(0x1e2840); bg.setStrokeStyle(1.5, 0x4466aa); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x131320); bg.setStrokeStyle(1.5, 0x2a3a5a, 0.9); });
    });

    this._addBackBtn(g, () => this._showEnemyStep());
    this._fadeIn(g);
  }

  // ─── STEP 3: DICE BUILDER ─────────────────────────────────────────────────

  _showBuildStep() {
    const g = this._stepGroup = this.add.container(0, 0);

    g.add(this.add.text(W / 2, 32, 'BUILD YOUR DICE', {
      fontSize: '15px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 56, 'tap any face to set it', {
      fontSize: '9px', color: '#2a3848', letterSpacing: 1
    }).setOrigin(0.5));

    this._buildDiceNets(g);

    const btnBg = this.add.rectangle(W / 2, H - 44, W - 16, 50, 0x162030);
    btnBg.setStrokeStyle(1.5, 0x4488cc, 0.9).setInteractive();
    btnBg.on('pointerdown', () => this._transitionTo(() => this._showRuneStep()));
    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x4488cc));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x162030));
    g.add(btnBg);
    g.add(this.add.text(W / 2, H - 44, 'Next  →', {
      fontSize: '16px', color: '#aaccff', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5));

    this._addBackBtn(g, () => this._showCountStep());
    this._fadeIn(g);
  }

  _buildDiceNets(g) {
    this._faceObjs = [];
    const n = this._diceCount;

    // Scale cell size so all dice fit — up to 3 per row at full size,
    // 4–6 dice wrap into two rows with smaller cells.
    const perRow = n <= 3 ? n : Math.ceil(n / 2);
    const CELL   = Math.floor(Math.min(38, (W - 8) / (perRow * 3 + 1)));
    const FACE   = Math.round(CELL * 0.89);

    const NET = [
      { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ];
    const netW   = 3 * CELL;
    const netH   = 4 * CELL;
    const gap    = (W - perRow * netW) / (perRow + 1);
    const startY = 82;

    this._diceConfig.forEach((dc, di) => {
      const col = di % perRow;
      const row = Math.floor(di / perRow);
      const gx  = gap + col * (netW + gap);
      const gy  = startY + row * (netH + 28);

      g.add(this.add.text(gx + netW / 2, gy + 4, `Die ${di + 1}`, {
        fontSize: '9px', color: '#334455'
      }).setOrigin(0.5));

      dc.faces.forEach((faceId, fi) => {
        const pos  = NET[fi] ?? { col: fi % 3, row: Math.floor(fi / 3) };
        const face = FACES[faceId];
        const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x252538;
        const fx   = gx + pos.col * CELL + CELL / 2;
        const fy   = gy + 22 + pos.row * CELL + CELL / 2;

        const bg = this.add.rectangle(fx, fy, FACE, FACE, 0x0d0d1c);
        bg.setStrokeStyle(1.5, fc, face ? 0.7 : 0.25).setInteractive();

        const symSz = CELL >= 34 ? '11px' : '9px';
        const nmSz  = CELL >= 34 ? '7px'  : '6px';
        const nmOff = Math.round(CELL * 0.21);

        const sym = this.add.text(fx, fy - Math.round(CELL * 0.18), face ? face.sym : '--', {
          fontSize: symSz, color: face ? face.color : '#252538',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);

        const nm = this.add.text(fx, fy + nmOff, face ? face.label.substring(0, 5) : '· · ·', {
          fontSize: nmSz, color: face ? '#444466' : '#1e1e2e'
        }).setOrigin(0.5);

        bg.on('pointerdown', () => this._openFacePicker(di, fi));
        bg.on('pointerover',  () => bg.setFillStyle(0x181828));
        bg.on('pointerout',   () => bg.setFillStyle(0x0d0d1c));

        g.add([bg, sym, nm]);
        this._faceObjs.push({ bg, sym, nm, di, fi });
      });
    });
  }

  // ─── FACE PICKER ─────────────────────────────────────────────────────────

  _openFacePicker(di, fi) {
    this._closePicker();

    const cols   = 5;
    const sp     = 60;
    const rows   = Math.ceil(PLAYER_TOKENS.length / cols);
    const panelW = cols * sp + 16;
    const panelH = rows * 64 + 32;
    const cx     = W / 2;
    const cy     = H - 70 - panelH / 2;

    const panel = this._picker = this.add.container(0, 0).setDepth(50);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, cy, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, 0xf0c040, 0.45));

    panel.add(this.add.text(cx, cy - panelH / 2 + 12, 'choose a token', {
      fontSize: '8px', color: '#334455', letterSpacing: 1
    }).setOrigin(0.5));

    const ox = cx - ((Math.min(PLAYER_TOKENS.length, cols) - 1) * sp) / 2;

    PLAYER_TOKENS.forEach((tokenId, i) => {
      const face = FACES[tokenId];
      const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const tx   = ox + col * sp;
      const ty   = cy - panelH / 2 + 28 + row * 64 + 32;

      const tbg = this.add.rectangle(tx, ty, 52, 56, 0x131320);
      tbg.setStrokeStyle(1, fc, 0.5).setInteractive();

      panel.add(tbg);
      panel.add(this.add.text(tx, ty - 10, face ? face.sym : '--', {
        fontSize: '13px', color: face ? face.color : '#555555',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 8, face ? face.label.substring(0, 7) : '', {
        fontSize: '8px', color: '#444466'
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 20, face?.value ? `${face.value}` : '', {
        fontSize: '8px', color: face ? face.color : '#555555'
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => { this._applyFace(di, fi, tokenId); this._closePicker(); });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(0x131320));
    });
  }

  _closePicker() {
    if (this._picker) { this._picker.destroy(true); this._picker = null; }
  }

  _applyFace(di, fi, tokenId) {
    this._diceConfig[di].faces[fi] = tokenId;
    const obj  = this._faceObjs.find(o => o.di === di && o.fi === fi);
    if (!obj) return;
    const face = FACES[tokenId];
    const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x252538;
    obj.sym.setText(face ? face.sym : '--').setColor(face ? face.color : '#252538');
    obj.nm.setText(face ? face.label.substring(0, 5) : '· · ·')
           .setColor(face ? '#444466' : '#1e1e2e');
    obj.bg.setStrokeStyle(1.5, fc, face ? 0.7 : 0.25);
  }

  // ─── STEP 4: RUNES & MATERIALS ───────────────────────────────────────────

  _showRuneStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    this._runeObjs = [];

    g.add(this.add.text(W / 2, 32, 'RUNES & MATERIALS', {
      fontSize: '15px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 56, 'optional — tap a slot to assign', {
      fontSize: '9px', color: '#2a3848', letterSpacing: 1
    }).setOrigin(0.5));

    const cardH = 54, gap = 7, startY = 78;
    const cx = W / 2;

    this._diceConfig.forEach((dc, di) => {
      const cy = startY + di * (cardH + gap) + cardH / 2;

      const cardBg = this.add.rectangle(cx, cy, W - 32, cardH, 0x0d0d1c);
      cardBg.setStrokeStyle(1, 0x1e2838, 0.8);
      g.add(cardBg);

      g.add(this.add.text(20, cy, `D${di + 1}`, {
        fontSize: '10px', color: '#2a3848', fontStyle: 'bold'
      }).setOrigin(0, 0.5));

      // Rune slot
      const rSlotX = cx - 75;
      const rBg = this.add.rectangle(rSlotX, cy, 134, 42, 0x100f20);
      rBg.setStrokeStyle(1, 0x3a2a18, 0.8).setInteractive();
      g.add(rBg);

      const rLabel = this.add.text(rSlotX, cy - 8,
        dc.rune ? RUNES[dc.rune].sym : 'RUNE', {
          fontSize: '10px', fontStyle: 'bold', letterSpacing: 1,
          color: dc.rune ? RUNES[dc.rune].color : '#222233'
        }).setOrigin(0.5);
      const rSub = this.add.text(rSlotX, cy + 8,
        dc.rune ? `${RUNES[dc.rune].label} · Face ${dc.runeFaceIdx + 1}` : '— tap to add —', {
          fontSize: '7px', color: dc.rune ? '#445566' : '#1c1c2e'
        }).setOrigin(0.5);
      g.add(rLabel); g.add(rSub);

      rBg.on('pointerdown', () => this._openRunePicker(di));
      rBg.on('pointerover',  () => rBg.setFillStyle(0x181828));
      rBg.on('pointerout',   () => rBg.setFillStyle(0x100f20));

      // Material slot
      const mSlotX = cx + 75;
      const mBg = this.add.rectangle(mSlotX, cy, 134, 42, 0x100f20);
      mBg.setStrokeStyle(1, 0x182030, 0.8).setInteractive();
      g.add(mBg);

      const mLabel = this.add.text(mSlotX, cy - 8,
        dc.material ? MATERIALS[dc.material].sym : 'MATERIAL', {
          fontSize: '10px', fontStyle: 'bold', letterSpacing: 1,
          color: dc.material ? MATERIALS[dc.material].color : '#222233'
        }).setOrigin(0.5);
      const mSub = this.add.text(mSlotX, cy + 8,
        dc.material ? MATERIALS[dc.material].label : '— tap to add —', {
          fontSize: '7px', color: dc.material ? '#445566' : '#1c1c2e'
        }).setOrigin(0.5);
      g.add(mLabel); g.add(mSub);

      mBg.on('pointerdown', () => this._openMaterialPicker(di));
      mBg.on('pointerover',  () => mBg.setFillStyle(0x181828));
      mBg.on('pointerout',   () => mBg.setFillStyle(0x100f20));

      this._runeObjs.push({ rBg, rLabel, rSub, mBg, mLabel, mSub, di });
    });

    // Begin Battle
    const btnBg = this.add.rectangle(W / 2, H - 44, W - 16, 50, 0x163824);
    btnBg.setStrokeStyle(1.5, 0x27ae60, 0.9).setInteractive();
    btnBg.on('pointerdown', () => this._startBattle());
    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x27ae60));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x163824));
    g.add(btnBg);
    g.add(this.add.text(W / 2, H - 44, 'Begin Battle', {
      fontSize: '16px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5));

    this._addBackBtn(g, () => this._showBuildStep());
    this._fadeIn(g);
  }

  _openRunePicker(di) {
    this._closePicker();
    const cx = W / 2;
    const sp = 60, tileW = 54, tileH = 62;
    const panelW = RUNE_KEYS.length * sp + 16;
    const panelH = tileH + 48;
    const panelY = H - 70 - panelH / 2;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, 0xe8c97a, 0.45));

    panel.add(this.add.text(cx, panelY - panelH / 2 + 13, 'choose a rune', {
      fontSize: '8px', color: '#334455', letterSpacing: 1
    }).setOrigin(0.5));

    const ox = cx - ((RUNE_KEYS.length - 1) * sp) / 2;

    RUNE_KEYS.forEach((runeId, i) => {
      const rune = RUNES[runeId];
      const rc   = parseInt(rune.color.replace('#', ''), 16);
      const tx   = ox + i * sp;
      const ty   = panelY + 8;

      const tbg = this.add.rectangle(tx, ty, tileW, tileH, 0x131320);
      tbg.setStrokeStyle(1.5, rc, 0.55).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(tx, ty - 16, rune.sym, {
        fontSize: '12px', color: rune.color, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 2, rune.label, {
        fontSize: '8px', color: '#6677aa'
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 16, rune.desc.substring(0, 18), {
        fontSize: '6px', color: '#334455', wordWrap: { width: 52 }
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => {
        this._closePicker();
        this._openFaceRunePicker(di, runeId);
      });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(0x131320));
    });
  }

  _openFaceRunePicker(di, runeId) {
    this._closePicker();
    const rune = RUNES[runeId];
    const dc   = this._diceConfig[di];
    const cx   = W / 2;

    const CELL   = 42;
    const NET    = [
      { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ];
    const netW   = 3 * CELL;
    const netH   = 4 * CELL;
    const panelW = netW + 40;
    const panelH = netH + 60;
    const panelY = H / 2 + 20;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, parseInt(rune.color.replace('#', ''), 16), 0.6));

    panel.add(this.add.text(cx, panelY - panelH / 2 + 14,
      `${rune.label}  —  which face?`, {
        fontSize: '9px', color: rune.color, letterSpacing: 1
      }).setOrigin(0.5));
    panel.add(this.add.text(cx, panelY - panelH / 2 + 28, `Die ${di + 1}`, {
      fontSize: '8px', color: '#2a3848', letterSpacing: 1
    }).setOrigin(0.5));

    const netStartX = cx - netW / 2;
    const netStartY = panelY - panelH / 2 + 38;

    dc.faces.forEach((faceId, fi) => {
      const face = FACES[faceId];
      const pos  = NET[fi];
      const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x252538;
      const fx   = netStartX + pos.col * CELL + CELL / 2;
      const fy   = netStartY + pos.row * CELL + CELL / 2;
      const sel  = dc.runeFaceIdx === fi;

      const tbg = this.add.rectangle(fx, fy, CELL - 4, CELL - 4, sel ? 0x221a10 : 0x131320);
      tbg.setStrokeStyle(sel ? 2 : 1.5, fc, sel ? 1 : 0.55).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(fx, fy - 7, face ? face.sym : '--', {
        fontSize: '9px', color: face ? face.color : '#252538',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5));
      panel.add(this.add.text(fx, fy + 7, `F${fi + 1}`, {
        fontSize: '6px', color: '#334455'
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => {
        dc.rune = runeId;
        dc.runeFaceIdx = fi;
        this._closePicker();
        this._refreshRuneSlot(di);
      });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(sel ? 0x221a10 : 0x131320));
    });
  }

  _openMaterialPicker(di) {
    this._closePicker();
    const dc  = this._diceConfig[di];
    const cx  = W / 2;
    const sp  = 84, tileW = 76, tileH = 62;
    const cols = 3;
    const rows = Math.ceil(MATERIAL_KEYS.length / cols);
    const panelW = cols * sp + 16;
    const panelH = rows * (tileH + 14) + 40;
    const panelY = H - 70 - panelH / 2;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, 0x8899aa, 0.45));

    panel.add(this.add.text(cx, panelY - panelH / 2 + 13, 'choose a material', {
      fontSize: '8px', color: '#334455', letterSpacing: 1
    }).setOrigin(0.5));

    const ox = cx - ((cols - 1) * sp) / 2;

    MATERIAL_KEYS.forEach((matId, i) => {
      const mat = MATERIALS[matId];
      const mc  = parseInt(mat.color.replace('#', ''), 16);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const tx  = ox + col * sp;
      const ty  = panelY - panelH / 2 + 40 + row * (tileH + 14) + tileH / 2;
      const sel = dc.material === matId;

      const tbg = this.add.rectangle(tx, ty, tileW, tileH, sel ? 0x1a1a30 : 0x131320);
      tbg.setStrokeStyle(sel ? 2 : 1, mc, sel ? 1 : 0.5).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(tx, ty - 16, mat.sym, {
        fontSize: '12px', color: mat.color, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 2, mat.label, {
        fontSize: '8px', color: '#6677aa'
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 16, mat.desc.substring(0, 18), {
        fontSize: '6px', color: '#334455', wordWrap: { width: 72 }
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => {
        dc.material = (dc.material === matId) ? null : matId;
        this._closePicker();
        this._refreshMatSlot(di);
      });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(sel ? 0x1a1a30 : 0x131320));
    });
  }

  _refreshRuneSlot(di) {
    const obj = this._runeObjs.find(o => o.di === di);
    if (!obj) return;
    const dc = this._diceConfig[di];
    if (dc.rune) {
      obj.rLabel.setText(RUNES[dc.rune].sym).setColor(RUNES[dc.rune].color);
      obj.rSub.setText(`${RUNES[dc.rune].label} · Face ${dc.runeFaceIdx + 1}`).setColor('#445566');
      obj.rBg.setStrokeStyle(1, parseInt(RUNES[dc.rune].color.replace('#', ''), 16), 0.6);
    } else {
      obj.rLabel.setText('RUNE').setColor('#222233');
      obj.rSub.setText('— tap to add —').setColor('#1c1c2e');
      obj.rBg.setStrokeStyle(1, 0x3a2a18, 0.8);
    }
  }

  _refreshMatSlot(di) {
    const obj = this._runeObjs.find(o => o.di === di);
    if (!obj) return;
    const dc = this._diceConfig[di];
    if (dc.material) {
      obj.mLabel.setText(MATERIALS[dc.material].sym).setColor(MATERIALS[dc.material].color);
      obj.mSub.setText(MATERIALS[dc.material].label).setColor('#445566');
      obj.mBg.setStrokeStyle(1, parseInt(MATERIALS[dc.material].color.replace('#', ''), 16), 0.6);
    } else {
      obj.mLabel.setText('MATERIAL').setColor('#222233');
      obj.mSub.setText('— tap to add —').setColor('#1c1c2e');
      obj.mBg.setStrokeStyle(1, 0x182030, 0.8);
    }
  }

  // ─── LAUNCH ───────────────────────────────────────────────────────────────

  _startBattle() {
    this.scene.start('BattleScene', {
      playerDiceConfig: this._diceConfig,
      playerHp:         PLAYER_MAX_HP,
      rerollTokens:     1,
      battleIndex:      ENEMY_KEYS.indexOf(this._enemyKey),
    });
  }
}
