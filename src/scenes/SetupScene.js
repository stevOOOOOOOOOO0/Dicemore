import Phaser from 'phaser';
import { FACES, ENEMIES, BATTLE_SEQUENCE } from '../data/faces.js';
import { DIE_TYPES, DIE_TYPE_KEYS, FIGHTER_CONFIG, MAGICIAN_CONFIG } from '../data/dice.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';
import { RUNES, MATERIALS, RUNE_KEYS, MATERIAL_KEYS } from '../data/runes.js';

const ENEMY_KEYS = ['red_louse', 'cultist', 'jaw_worm'];

export default class SetupScene extends Phaser.Scene {
  constructor() { super({ key: 'SetupScene' }); }

  create() {
    this._enemyKey        = null;
    this._diceCount       = 2;
    this._diceConfig      = [];
    this._usedClassPreset = false;
    this._stepGroup       = null;
    this._runeObjs        = [];
    this._picker          = null;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    this._showEnemyStep();
  }

  // ─── TRANSITIONS ─────────────────────────────────────────────────────────

  _clearStep() {
    if (this._picker)    { this._picker.destroy(true);    this._picker    = null; }
    if (this._stepGroup) { this._stepGroup.destroy(true); this._stepGroup = null; }
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

    g.add(this.add.text(W / 2, 88, 'CHOOSE YOUR ENEMY', {
      fontSize: '17px', color: '#2a3848', letterSpacing: 2
    }).setOrigin(0.5));

    const cardW = 108, cardH = 220;
    const hGap  = (W - ENEMY_KEYS.length * cardW) / (ENEMY_KEYS.length + 1);

    ENEMY_KEYS.forEach((key, i) => {
      const def = ENEMIES[key];
      const col = parseInt(def.color.replace('#', ''), 16);
      const cx  = hGap + i * (cardW + hGap) + cardW / 2;
      const cy  = 350;

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x131320);
      bg.setStrokeStyle(1.5, col, 0.55).setInteractive();
      g.add(bg);

      g.add(this.add.text(cx, cy - 94, def.name.toUpperCase(), {
        fontSize: '17px', color: def.color, fontStyle: 'bold', letterSpacing: 1
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy - 38, `${def.hp}`, {
        fontSize: '36px', color: '#ddeeff', fontStyle: 'bold'
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 12, 'HP', {
        fontSize: '17px', color: '#334455', letterSpacing: 2
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 44, `${def.obstacleCount} obstacle${def.obstacleCount !== 1 ? 's' : ''}`, {
        fontSize: '17px', color: '#445566'
      }).setOrigin(0.5));

      const INTENT_CLR = {
        attack: '#e74c3c', block: '#3498db', strength: '#e67e22',
        vulnerable: '#bb44cc', frail: '#1abc9c',
      };
      const intentTypes = [...new Set(
        def.intents.flatMap(e => e.type === 'multi' ? e.intents.map(s => s.type) : [e.type])
      )].slice(0, 4);
      intentTypes.forEach((iType, fi) => {
        const fc    = parseInt((INTENT_CLR[iType] ?? '#555555').replace('#', ''), 16);
        const chipX = cx - ((intentTypes.length - 1) * 20) / 2 + fi * 20;
        const chip  = this.add.rectangle(chipX, cy + 82, 16, 16, 0x0a0a18);
        chip.setStrokeStyle(1.5, fc, 0.8);
        g.add(chip);
      });

      bg.on('pointerdown', () => {
        this._enemyKey = key;
        this._transitionTo(() => this._showClassStep());
      });
      bg.on('pointerover',  () => bg.setFillStyle(0x1c1c2e));
      bg.on('pointerout',   () => bg.setFillStyle(0x131320));
    });

    this._fadeIn(g);
  }

  // ─── STEP 1b: CLASS SELECTION ────────────────────────────────────────────

  _showClassStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    const def = ENEMIES[this._enemyKey];

    g.add(this.add.text(W / 2, 36, 'CHOOSE YOUR CLASS', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 66, `vs. ${def.name}  ·  ${def.hp} HP`, {
      fontSize: '17px', color: '#2a3848'
    }).setOrigin(0.5));

    const cardW = W - 40, cardH = 120;
    const cx = W / 2;

    // Fighter card
    const fy = 180;
    this._makeClassCard(g, cx, fy, cardW, cardH, {
      title: 'FIGHTER',
      titleColor: '#ff8844',
      borderColor: 0xff6622,
      bgColor: 0x130e08,
      bgHover: 0x1e160a,
      subtitle: 'The relentless brawler',
      dice: [
        { type: 'attack', label: 'ATK d4' },
        { type: 'block',  label: 'BLK d4' },
        { type: 'pierce', label: 'PRC d4' },
      ],
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 3;
        this._diceConfig = JSON.parse(JSON.stringify(FIGHTER_CONFIG));
        this._transitionTo(() => this._showRuneStep());
      }
    });

    // Magician card
    const my = 340;
    this._makeClassCard(g, cx, my, cardW, cardH, {
      title: 'MAGICIAN',
      titleColor: '#cc88ff',
      borderColor: 0x8844cc,
      bgColor: 0x100a18,
      bgHover: 0x1a1028,
      subtitle: 'The arcane trickster',
      dice: [
        { type: 'attack', label: 'ATK d4' },
        { type: 'block',  label: 'BLK d4' },
        { type: 'copy',   label: 'CPY d4' },
      ],
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 3;
        this._diceConfig = JSON.parse(JSON.stringify(MAGICIAN_CONFIG));
        this._transitionTo(() => this._showRuneStep());
      }
    });

    // Custom button
    const customBg = this.add.rectangle(cx, 490, cardW, 46, 0x0d0d1c);
    customBg.setStrokeStyle(1.5, 0x2a3a5a, 0.9).setInteractive();
    g.add(customBg);
    g.add(this.add.text(cx, 490, 'Build Custom  →', {
      fontSize: '17px', color: '#2a3848', letterSpacing: 1
    }).setOrigin(0.5));
    customBg.on('pointerdown', () => {
      this._usedClassPreset = false;
      this._transitionTo(() => this._showCountStep());
    });
    customBg.on('pointerover',  () => { customBg.setFillStyle(0x1e2840); customBg.setStrokeStyle(1.5, 0x4466aa); });
    customBg.on('pointerout',   () => { customBg.setFillStyle(0x0d0d1c); customBg.setStrokeStyle(1.5, 0x2a3a5a, 0.9); });

    this._addBackBtn(g, () => this._showEnemyStep());
    this._fadeIn(g);
  }

  _makeClassCard(g, cx, cy, cardW, cardH, opts) {
    const cardBg = this.add.rectangle(cx, cy, cardW, cardH, opts.bgColor);
    cardBg.setStrokeStyle(2, opts.borderColor, 0.65).setInteractive();
    g.add(cardBg);

    g.add(this.add.text(cx, cy - 42, opts.title, {
      fontSize: '22px', color: opts.titleColor, fontStyle: 'bold', letterSpacing: 4
    }).setOrigin(0.5));
    g.add(this.add.text(cx, cy - 20, opts.subtitle, {
      fontSize: '17px', color: '#445566'
    }).setOrigin(0.5));

    // Die type pills
    const pillW = 76, pillGap = 8;
    const totalW = opts.dice.length * pillW + (opts.dice.length - 1) * pillGap;
    opts.dice.forEach((d, i) => {
      const dt = DIE_TYPES[d.type];
      const fc = dt ? parseInt(dt.color.replace('#', ''), 16) : 0x555555;
      const px = cx - totalW / 2 + i * (pillW + pillGap) + pillW / 2;
      const pill = this.add.rectangle(px, cy + 12, pillW, 30, 0x0a0a18);
      pill.setStrokeStyle(1, fc, 0.7);
      g.add(pill);
      g.add(this.add.text(px, cy + 12, d.label, {
        fontSize: '17px', color: dt ? dt.color : '#777777', fontStyle: 'bold'
      }).setOrigin(0.5));
    });

    g.add(this.add.text(cx, cy + 44, 'tap to play  →', {
      fontSize: '17px', color: '#2a2a3a'
    }).setOrigin(0.5));

    cardBg.on('pointerdown', opts.onTap);
    cardBg.on('pointerover',  () => cardBg.setFillStyle(opts.bgHover));
    cardBg.on('pointerout',   () => cardBg.setFillStyle(opts.bgColor));
  }

  // ─── STEP 2: DICE COUNT ───────────────────────────────────────────────────

  _showCountStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    const def = ENEMIES[this._enemyKey];

    g.add(this.add.text(W / 2, 80, 'HOW MANY DICE?', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 118, `vs. ${def.name}  ·  ${def.hp} HP`, {
      fontSize: '17px', color: '#2a3848'
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
      g.add(this.add.text(x, y + 26, n === 1 ? 'die' : 'dice', {
        fontSize: '17px', color: '#334455', letterSpacing: 1
      }).setOrigin(0.5));

      bg.on('pointerdown', () => {
        this._diceCount  = n;
        this._diceConfig = Array.from({ length: n }, (_, j) => ({
          id: `custom_${j}`, type: null, sides: 6,
          runeMap: {}, material: null, culledFaces: [],
        }));
        this._transitionTo(() => this._showTypeStep());
      });
      bg.on('pointerover',  () => { bg.setFillStyle(0x1e2840); bg.setStrokeStyle(1.5, 0x4466aa); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x131320); bg.setStrokeStyle(1.5, 0x2a3a5a, 0.9); });
    });

    this._addBackBtn(g, () => this._showClassStep());
    this._fadeIn(g);
  }

  // ─── STEP 3: DIE TYPE SELECTION ───────────────────────────────────────────

  _showTypeStep() {
    const g = this._stepGroup = this.add.container(0, 0);

    g.add(this.add.text(W / 2, 36, 'CHOOSE DIE TYPES', {
      fontSize: '17px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));

    const startY = 76;
    const rowH   = 70;
    const btnW   = 70, btnH = 50, btnGap = 6;
    const bxStart = 52;

    this._diceConfig.forEach((dc, di) => {
      const rowCy = startY + di * rowH + rowH / 2;

      g.add(this.add.text(16, rowCy, `Die ${di + 1}`, {
        fontSize: '17px', color: '#2a3848'
      }).setOrigin(0, 0.5));

      DIE_TYPE_KEYS.forEach((typeId, ti) => {
        const dt  = DIE_TYPES[typeId];
        const fc  = parseInt(dt.color.replace('#', ''), 16);
        const bx  = bxStart + ti * (btnW + btnGap) + btnW / 2;
        const sel = dc.type === typeId;

        const bbg = this.add.rectangle(bx, rowCy, btnW, btnH, sel ? 0x1a2030 : 0x0d0d1c);
        bbg.setStrokeStyle(sel ? 2 : 1, fc, sel ? 1 : 0.35).setInteractive();
        g.add(bbg);
        g.add(this.add.text(bx, rowCy, dt.sym, {
          fontSize: '17px', color: sel ? dt.color : '#334455', fontStyle: sel ? 'bold' : 'normal'
        }).setOrigin(0.5));

        bbg.on('pointerdown', () => {
          dc.type = typeId;
          this._transitionTo(() => this._showTypeStep());
        });
        bbg.on('pointerover',  () => { if (!sel) bbg.setFillStyle(0x181828); });
        bbg.on('pointerout',   () => { if (!sel) bbg.setFillStyle(0x0d0d1c); });
      });
    });

    const allAssigned = this._diceConfig.every(dc => dc.type !== null);
    const nextBg = this.add.rectangle(W / 2, H - 44, W - 16, 50,
      allAssigned ? 0x162030 : 0x0d0d18);
    nextBg.setStrokeStyle(1.5, allAssigned ? 0x4488cc : 0x1a1a2e, 0.9);
    if (allAssigned) {
      nextBg.setInteractive();
      nextBg.on('pointerdown', () => this._transitionTo(() => this._showRuneStep()));
      nextBg.on('pointerover',  () => nextBg.setFillStyle(0x4488cc));
      nextBg.on('pointerout',   () => nextBg.setFillStyle(0x162030));
    }
    g.add(nextBg);
    g.add(this.add.text(W / 2, H - 44, 'Next  →', {
      fontSize: '17px', color: allAssigned ? '#aaccff' : '#2a2a3e',
      fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5));

    this._addBackBtn(g, () => this._showCountStep());
    this._fadeIn(g);
  }

  // ─── STEP 4: RUNES & MATERIALS ───────────────────────────────────────────

  _showRuneStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    this._runeObjs = [];

    g.add(this.add.text(W / 2, 36, 'RUNES & MATERIALS', {
      fontSize: '17px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5));

    const cardH = 64, gap = 8, startY = 64;
    const cx = W / 2;

    this._diceConfig.forEach((dc, di) => {
      const cy = startY + di * (cardH + gap) + cardH / 2;
      const dt = DIE_TYPES[dc.type];

      const cardBg = this.add.rectangle(cx, cy, W - 32, cardH, 0x0d0d1c);
      cardBg.setStrokeStyle(1, 0x1e2838, 0.8);
      g.add(cardBg);

      g.add(this.add.text(20, cy, `D${di + 1}`, {
        fontSize: '17px', color: dt ? dt.color : '#2a3848', fontStyle: 'bold'
      }).setOrigin(0, 0.5));

      // Rune slot
      const rSlotX = cx - 75;
      const rBg = this.add.rectangle(rSlotX, cy, 134, 52, 0x100f20);
      rBg.setStrokeStyle(1, 0x3a2a18, 0.8).setInteractive();
      g.add(rBg);

      const runeEntries = Object.entries(dc.runeMap ?? {});
      const firstRune   = runeEntries[0];
      const rLabel = this.add.text(rSlotX, cy - 10,
        firstRune ? RUNES[firstRune[1]].sym : 'RUNE', {
          fontSize: '17px', fontStyle: 'bold', letterSpacing: 1,
          color: firstRune ? RUNES[firstRune[1]].color : '#222233',
        }).setOrigin(0.5);
      const rSub = this.add.text(rSlotX, cy + 12,
        firstRune
          ? (runeEntries.length > 1 ? `×${runeEntries.length} runes` : `F${parseInt(firstRune[0]) + 1}`)
          : '— add —', {
          fontSize: '17px',
          color: firstRune ? '#445566' : '#1c1c2e',
        }).setOrigin(0.5);
      g.add(rLabel); g.add(rSub);

      rBg.on('pointerdown', () => this._openRunePicker(di));
      rBg.on('pointerover',  () => rBg.setFillStyle(0x181828));
      rBg.on('pointerout',   () => rBg.setFillStyle(0x100f20));

      // Material slot
      const mSlotX = cx + 75;
      const mBg = this.add.rectangle(mSlotX, cy, 134, 52, 0x100f20);
      mBg.setStrokeStyle(1, 0x182030, 0.8).setInteractive();
      g.add(mBg);

      const mLabel = this.add.text(mSlotX, cy - 10,
        dc.material ? MATERIALS[dc.material].sym : 'MAT', {
          fontSize: '17px', fontStyle: 'bold', letterSpacing: 1,
          color: dc.material ? MATERIALS[dc.material].color : '#222233'
        }).setOrigin(0.5);
      const mSub = this.add.text(mSlotX, cy + 12,
        dc.material ? MATERIALS[dc.material].label : '— add —', {
          fontSize: '17px', color: dc.material ? '#445566' : '#1c1c2e'
        }).setOrigin(0.5);
      g.add(mLabel); g.add(mSub);

      mBg.on('pointerdown', () => this._openMaterialPicker(di));
      mBg.on('pointerover',  () => mBg.setFillStyle(0x181828));
      mBg.on('pointerout',   () => mBg.setFillStyle(0x100f20));

      this._runeObjs.push({ rBg, rLabel, rSub, mBg, mLabel, mSub, di });
    });

    const btnBg = this.add.rectangle(W / 2, H - 44, W - 16, 50, 0x163824);
    btnBg.setStrokeStyle(1.5, 0x27ae60, 0.9).setInteractive();
    btnBg.on('pointerdown', () => this._startBattle());
    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x27ae60));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x163824));
    g.add(btnBg);
    g.add(this.add.text(W / 2, H - 44, 'Begin Battle', {
      fontSize: '17px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5));

    this._addBackBtn(g, () => this._usedClassPreset ? this._showClassStep() : this._showTypeStep());
    this._fadeIn(g);
  }

  // ─── RUNE PICKER ─────────────────────────────────────────────────────────

  _openRunePicker(di) {
    this._closePicker();
    const cx = W / 2;
    const sp = 62, tileW = 56, tileH = 72;
    const panelW = RUNE_KEYS.length * sp + 16;
    const panelH = tileH + 52;
    const panelY = H - 70 - panelH / 2;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, 0xe8c97a, 0.45));
    panel.add(this.add.text(cx, panelY - panelH / 2 + 18, 'choose a rune', {
      fontSize: '17px', color: '#334455', letterSpacing: 1
    }).setOrigin(0.5));

    const ox = cx - ((RUNE_KEYS.length - 1) * sp) / 2;

    RUNE_KEYS.forEach((runeId, i) => {
      const rune = RUNES[runeId];
      const rc   = parseInt(rune.color.replace('#', ''), 16);
      const tx   = ox + i * sp;
      const ty   = panelY + 10;

      const tbg = this.add.rectangle(tx, ty, tileW, tileH, 0x131320);
      tbg.setStrokeStyle(1.5, rc, 0.55).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(tx, ty - 14, rune.sym, {
        fontSize: '17px', color: rune.color, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 12, rune.label, {
        fontSize: '17px', color: '#6677aa'
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => { this._closePicker(); this._openFaceRunePicker(di, runeId); });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(0x131320));
    });
  }

  _openFaceRunePicker(di, runeId) {
    this._closePicker();
    const rune  = RUNES[runeId];
    const dc    = this._diceConfig[di];
    const sides = dc.sides;
    const cx    = W / 2;
    const dt    = DIE_TYPES[dc.type];
    const fc    = dt ? parseInt(dt.color.replace('#', ''), 16) : 0x555555;
    const runeColor = parseInt(rune.color.replace('#', ''), 16);

    // T-net for d6, grid for other sizes
    const CELL = 46;
    let facePositions, netW, netH;

    if (sides === 6) {
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
      const cols = Math.min(sides, 4);
      const rows = Math.ceil(sides / cols);
      netW = cols * CELL;
      netH = rows * CELL;
      facePositions = Array.from({ length: sides }, (_, fi) => {
        const col = fi % cols;
        const row = Math.floor(fi / cols);
        const rowCount = Math.min(cols, sides - row * cols);
        const rowOx = (netW - (rowCount - 1) * CELL) / 2;
        return { fx: rowOx + col * CELL, fy: row * CELL + CELL / 2 };
      });
    }

    const panelW = netW + 56;
    const panelH = netH + 70;
    const panelY = H / 2 + 20;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, runeColor, 0.6));
    panel.add(this.add.text(cx, panelY - panelH / 2 + 18,
      `${rune.sym}  —  pick a face`, { fontSize: '17px', color: rune.color }
    ).setOrigin(0.5));
    panel.add(this.add.text(cx, panelY - panelH / 2 + 38, `Die ${di + 1}`, {
      fontSize: '17px', color: '#2a3848'
    }).setOrigin(0.5));

    const originX = cx - netW / 2;
    const originY = panelY - panelH / 2 + 54;

    facePositions.forEach(({ fx, fy }, fi) => {
      const ax  = originX + fx;
      const ay  = originY + fy;
      const sel = !!dc.runeMap?.[fi];

      const tbg = this.add.rectangle(ax, ay, CELL - 4, CELL - 4, sel ? 0x221a10 : 0x131320);
      tbg.setStrokeStyle(sel ? 2 : 1.5, sel ? runeColor : fc, sel ? 1 : 0.55).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(ax, ay, String(fi + 1), {
        fontSize: '17px', color: sel ? rune.color : (dt?.color ?? '#ffffff'),
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => {
        if (!dc.runeMap) dc.runeMap = {};
        dc.runeMap[fi] = runeId;
        this._closePicker();
        this._refreshRuneSlot(di);
      });
      tbg.on('pointerover',  () => tbg.setFillStyle(0x252540));
      tbg.on('pointerout',   () => tbg.setFillStyle(sel ? 0x221a10 : 0x131320));
    });
  }

  // ─── MATERIAL PICKER ─────────────────────────────────────────────────────

  _openMaterialPicker(di) {
    this._closePicker();
    const dc  = this._diceConfig[di];
    const cx  = W / 2;
    const sp  = 88, tileW = 80, tileH = 70;
    const cols = 3;
    const rows = Math.ceil(MATERIAL_KEYS.length / cols);
    const panelW = cols * sp + 16;
    const panelH = rows * (tileH + 14) + 46;
    const panelY = H - 70 - panelH / 2;

    const panel = this._picker = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    dim.on('pointerdown', () => this._closePicker());
    panel.add(dim);

    panel.add(this.add.rectangle(cx, panelY, panelW, panelH, 0x0a0a1e)
      .setStrokeStyle(1.5, 0x8899aa, 0.45));
    panel.add(this.add.text(cx, panelY - panelH / 2 + 18, 'choose a material', {
      fontSize: '17px', color: '#334455', letterSpacing: 1
    }).setOrigin(0.5));

    const ox = cx - ((cols - 1) * sp) / 2;

    MATERIAL_KEYS.forEach((matId, i) => {
      const mat = MATERIALS[matId];
      const mc  = parseInt(mat.color.replace('#', ''), 16);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const tx  = ox + col * sp;
      const ty  = panelY - panelH / 2 + 46 + row * (tileH + 14) + tileH / 2;
      const sel = dc.material === matId;

      const tbg = this.add.rectangle(tx, ty, tileW, tileH, sel ? 0x1a1a30 : 0x131320);
      tbg.setStrokeStyle(sel ? 2 : 1, mc, sel ? 1 : 0.5).setInteractive();
      panel.add(tbg);
      panel.add(this.add.text(tx, ty - 14, mat.sym, {
        fontSize: '17px', color: mat.color, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5));
      panel.add(this.add.text(tx, ty + 12, mat.label, {
        fontSize: '17px', color: '#6677aa'
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

  _closePicker() {
    if (this._picker) { this._picker.destroy(true); this._picker = null; }
  }

  _refreshRuneSlot(di) {
    const obj = this._runeObjs.find(o => o.di === di);
    if (!obj) return;
    const dc          = this._diceConfig[di];
    const runeEntries = Object.entries(dc.runeMap ?? {});
    const firstRune   = runeEntries[0];
    if (firstRune) {
      const r = RUNES[firstRune[1]];
      obj.rLabel.setText(r.sym).setColor(r.color);
      obj.rSub.setText(runeEntries.length > 1 ? `×${runeEntries.length} runes` : `F${parseInt(firstRune[0]) + 1}`).setColor('#445566');
      obj.rBg.setStrokeStyle(1, parseInt(r.color.replace('#', ''), 16), 0.6);
    } else {
      obj.rLabel.setText('RUNE').setColor('#222233');
      obj.rSub.setText('— add —').setColor('#1c1c2e');
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
      obj.mLabel.setText('MAT').setColor('#222233');
      obj.mSub.setText('— add —').setColor('#1c1c2e');
      obj.mBg.setStrokeStyle(1, 0x182030, 0.8);
    }
  }

  // ─── LAUNCH ───────────────────────────────────────────────────────────────

  _startBattle() {
    this.scene.start('BattleScene', {
      playerDiceConfig: this._diceConfig,
      playerHp:         PLAYER_MAX_HP,
      rerollTokens:     1,
      battleIndex:      BATTLE_SEQUENCE.indexOf(this._enemyKey),
    });
  }
}
