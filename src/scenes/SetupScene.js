import Phaser from 'phaser';
import { FACES, ENEMIES, BATTLE_SEQUENCE } from '../data/faces.js';
import { DIE_TYPES, DIE_TYPE_KEYS, SPECIAL_DIE_KEYS, SIDES_PROGRESSION, FIGHTER_CONFIG, MAGICIAN_CONFIG, ALCHEMIST_CONFIG, BRUTE_CONFIG } from '../data/dice.js';
import { W, H, PLAYER_MAX_HP, FONT_DISPLAY } from '../constants.js';
import { RUNES, MATERIALS, RUNE_KEYS, MATERIAL_KEYS } from '../data/runes.js';
import { getRelics } from '../data/relics.js';
import { UPGRADES, UPGRADE_DESCRIPTIONS } from '../data/upgrades.js';

const ENEMY_KEYS = ['red_louse', 'cultist', 'jaw_worm'];

export default class SetupScene extends Phaser.Scene {
  constructor() { super({ key: 'SetupScene' }); }

  init(data) {
    this._mpMode     = data?.mpMode   ?? false;
    this._mpPlayer   = data?.mpPlayer ?? 1;
    this._mpP1Config = data?.p1Config ?? null;
    this._mpP1Relic  = data?.p1Relic  ?? null;
  }

  create() {
    this._enemyKey        = ENEMY_KEYS[0];
    this._diceCount       = 2;
    this._diceConfig      = [];
    this._usedClassPreset = false;
    this._stepGroup       = null;
    this._runeObjs        = [];
    this._picker          = null;
    this._startingRelic        = null;
    this._selectedCustomRelics = null;
    this._upgradeActiveDie     = 0;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.text(8, 8, 'pre-alpha-beta-0.20', {
      fontSize: '11px', color: '#2a3848',
    }).setOrigin(0, 0);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    if (this._mpMode) {
      this.add.text(W / 2, H - 24, `PLAYER ${this._mpPlayer} — Choose your class`, {
        fontSize: '14px', color: '#00ccff', fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    this._showClassStep();
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
      fontSize: '20px', color: '#8aaabb'
    }).setOrigin(0, 0.5).setInteractive();
    btn.on('pointerdown', () => this._transitionTo(fn));
    btn.on('pointerover',  () => btn.setColor('#b0ccdd'));
    btn.on('pointerout',   () => btn.setColor('#8aaabb'));
    g.add(btn);
  }

  // ─── STEP 1: ENEMY SELECTION ─────────────────────────────────────────────

  _showEnemyStep() {
    const g = this._stepGroup = this.add.container(0, 0);

    g.add(this.add.text(W / 2, 52, 'DICEMORE', {
      fontSize: '28px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5));

    g.add(this.add.text(W / 2, 88, 'CHOOSE YOUR ENEMY', {
      fontSize: '17px', color: '#5a7a8a', letterSpacing: 2,
      fontFamily: FONT_DISPLAY,
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
        fontSize: '17px', color: def.color, fontStyle: 'bold', letterSpacing: 1,
        fontFamily: FONT_DISPLAY,
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy - 38, `${def.hp}`, {
        fontSize: '36px', color: '#ddeeff', fontStyle: 'bold'
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 12, 'HP', {
        fontSize: '17px', color: '#567090', letterSpacing: 2
      }).setOrigin(0.5));
      g.add(this.add.text(cx, cy + 44, `${def.obstacleCount} obstacle${def.obstacleCount !== 1 ? 's' : ''}`, {
        fontSize: '17px', color: '#5a7090'
      }).setOrigin(0.5));

      const INTENT_CLR = {
        attack: '#e74c3c', block: '#3498db', strength: '#e67e22',
        vulnerable: '#bb44cc', frail: '#1abc9c',
      };
      const INTENT_LBL = { attack: 'ATK', block: 'BLK', strength: 'STR', vulnerable: 'VUL', frail: 'FRL' };
      const intentTypes = [...new Set(
        def.intents.flatMap(e => e.type === 'multi' ? e.intents.map(s => s.type) : [e.type])
      )].slice(0, 4);
      intentTypes.forEach((iType, fi) => {
        const fc    = parseInt((INTENT_CLR[iType] ?? '#555555').replace('#', ''), 16);
        const chipX = cx - ((intentTypes.length - 1) * 20) / 2 + fi * 20;
        const chip  = this.add.rectangle(chipX, cy + 79, 16, 14, 0x0a0a18);
        chip.setStrokeStyle(1.5, fc, 0.8);
        g.add(chip);
        g.add(this.add.text(chipX, cy + 93, INTENT_LBL[iType] ?? iType.slice(0, 3).toUpperCase(), {
          fontSize: '7px', color: INTENT_CLR[iType] ?? '#555555',
        }).setOrigin(0.5, 0));
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

    const title = this._mpMode ? `PLAYER ${this._mpPlayer} — CHOOSE CLASS` : 'CHOOSE YOUR CLASS';
    g.add(this.add.text(W / 2, 36, title, {
      fontSize: '20px', color: this._mpMode ? '#00ccff' : '#f0c040', fontStyle: 'bold', letterSpacing: 3,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5));
    if (!this._mpMode) {
      g.add(this.add.text(W / 2, 66, `vs. ${def.name}  ·  ${def.hp} HP`, {
        fontSize: '17px', color: '#5a7080'
      }).setOrigin(0.5));
    }

    const cardW = W - 40, cardH = 108;
    const cx = W / 2;

    // Dice Slinger card
    this._makeClassCard(g, cx, 130, cardW, cardH, {
      title: 'DICE SLINGER',
      titleColor: '#ff8844',
      borderColor: 0xff6622,
      bgColor: 0x130e08,
      bgHover: 0x1e160a,
      subtitle: 'The card sharp with a quick draw',
      dice: [
        { type: 'attack', label: 'ATK d6' },
        { type: 'pierce', label: 'BUF d4' },
        { type: 'block',  label: 'BLK d6' },
      ],
      startingRelicName: 'Lucky Coin',
      startingRelicColor: '#f0c040',
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 3;
        this._diceConfig = JSON.parse(JSON.stringify(FIGHTER_CONFIG));
        this._startingRelic = getRelics().find(r => r.id === 'lucky_coin') ?? null;
        this._startBattle();
      }
    });

    // Illusionist card
    this._makeClassCard(g, cx, 246, cardW, cardH, {
      title: 'ILLUSIONIST',
      titleColor: '#cc88ff',
      borderColor: 0x8844cc,
      bgColor: 0x100a18,
      bgHover: 0x1a1028,
      subtitle: 'A master of misdirection',
      dice: [
        { type: 'attack', label: 'ATK d6' },
        { type: 'copy',   label: 'CPY d4' },
        { type: 'block',  label: 'BLK d6' },
      ],
      startingRelicName: 'Steady Hand',
      startingRelicColor: '#f0c040',
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 3;
        this._diceConfig = JSON.parse(JSON.stringify(MAGICIAN_CONFIG));
        this._startingRelic = getRelics().find(r => r.id === 'steady_hand') ?? null;
        this._startBattle();
      }
    });

    // Pickpocket card
    this._makeClassCard(g, cx, 362, cardW, cardH, {
      title: 'PICKPOCKET',
      titleColor: '#58d68d',
      borderColor: 0x27ae60,
      bgColor: 0x081208,
      bgHover: 0x0e1e0e,
      subtitle: 'Lifts your chips while shaking your hand',
      dice: [
        { type: 'attack', label: 'ATK d6' },
        { type: 'poison', label: 'PKP d4' },
        { type: 'block',  label: 'BLK d6' },
      ],
      startingRelicName: "Pickpocket's Thumb",
      startingRelicColor: '#58d68d',
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 3;
        this._diceConfig = JSON.parse(JSON.stringify(ALCHEMIST_CONFIG));
        this._startingRelic = getRelics().find(r => r.id === 'pickpockets_thumb') ?? null;
        this._startBattle();
      }
    });

    // The Muscle card
    this._makeClassCard(g, cx, 478, cardW, cardH, {
      title: 'THE MUSCLE',
      titleColor: '#e74c3c',
      borderColor: 0xc0392b,
      bgColor: 0x130808,
      bgHover: 0x1e0e0e,
      subtitle: 'Built like a brick, moves like one too',
      dice: [
        { type: 'block', label: 'BLK d8' },
        { type: 'block', label: 'BLK d8' },
      ],
      startingRelicName: 'Spiked Bumper',
      startingRelicColor: '#e74c3c',
      onTap: () => {
        this._usedClassPreset = true;
        this._diceCount  = 2;
        this._diceConfig = JSON.parse(JSON.stringify(BRUTE_CONFIG));
        this._startingRelic = getRelics().find(r => r.id === 'spiked_bumper') ?? null;
        this._startBattle();
      }
    });

    // Separator
    g.add(this.add.rectangle(cx, 537, cardW, 1, 0x1e2840));

    // The Drifter button
    const customBg = this.add.rectangle(cx, 562, cardW - 40, 40, 0x0a0a14);
    customBg.setStrokeStyle(1, 0x2a3a5a, 0.7).setInteractive();
    g.add(customBg);
    g.add(this.add.text(cx, 562, 'The Drifter  — build custom', {
      fontSize: '14px', color: '#5a7a8a', letterSpacing: 1
    }).setOrigin(0.5));
    customBg.on('pointerdown', () => {
      this._usedClassPreset = false;
      this._transitionTo(() => this._showCountStep());
    });
    customBg.on('pointerover',  () => { customBg.setFillStyle(0x141424); customBg.setStrokeStyle(1, 0x4466aa); });
    customBg.on('pointerout',   () => { customBg.setFillStyle(0x0a0a14); customBg.setStrokeStyle(1, 0x2a3a5a, 0.7); });

    // Tutorial link
    const tutTxt = this.add.text(cx, 612, '? First time? Try the Tutorial', {
      fontSize: '13px', color: '#7aaccc',
    }).setOrigin(0.5).setInteractive();
    g.add(tutTxt);
    tutTxt.on('pointerover', () => tutTxt.setColor('#aaddf0'));
    tutTxt.on('pointerout',  () => tutTxt.setColor('#7aaccc'));
    tutTxt.on('pointerdown', () => {
      this.time.delayedCall(1, () => this.scene.start('BattleScene', {
        playerDiceConfig: JSON.parse(JSON.stringify(FIGHTER_CONFIG)),
        playerHp:    PLAYER_MAX_HP,
        playerMaxHp: PLAYER_MAX_HP,
        enemyKey:    'training_dummy',
        tutorial:    true,
        battleIndex: 0,
        activeRelics: [],
      }));
    });

    this._fadeIn(g);
  }

  _makeClassCard(g, cx, cy, cardW, cardH, opts) {
    const cardBg = this.add.rectangle(cx, cy, cardW, cardH, opts.bgColor);
    cardBg.setStrokeStyle(2, opts.borderColor, 0.65).setInteractive();
    g.add(cardBg);

    g.add(this.add.text(cx, cy - 42, opts.title, {
      fontSize: '22px', color: opts.titleColor, fontStyle: 'bold', letterSpacing: 4,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5));
    g.add(this.add.text(cx, cy - 20, opts.subtitle, {
      fontSize: '17px', color: '#6a8090'
    }).setOrigin(0.5));

    // Die type pills
    const hasRelic = !!opts.startingRelicName;
    const pillsY   = hasRelic ? cy + 2 : cy + 12;
    const pillW = 76, pillGap = 8;
    const totalW = opts.dice.length * pillW + (opts.dice.length - 1) * pillGap;
    opts.dice.forEach((d, i) => {
      const dt = DIE_TYPES[d.type];
      const fc = dt ? parseInt(dt.color.replace('#', ''), 16) : 0x555555;
      const px = cx - totalW / 2 + i * (pillW + pillGap) + pillW / 2;
      const pill = this.add.rectangle(px, pillsY, pillW, 30, 0x0a0a18);
      pill.setStrokeStyle(1, fc, 0.7);
      g.add(pill);
      g.add(this.add.text(px, pillsY, d.label, {
        fontSize: '17px', color: dt ? dt.color : '#777777', fontStyle: 'bold'
      }).setOrigin(0.5));
    });

    if (hasRelic) {
      const rc = parseInt((opts.startingRelicColor ?? '#e74c3c').replace('#', ''), 16);
      const relicPill = this.add.rectangle(cx, cy + 32, 170, 22, 0x0a0a18);
      relicPill.setStrokeStyle(1, rc, 0.7);
      g.add(relicPill);
      g.add(this.add.text(cx, cy + 32, `⬟ ${opts.startingRelicName}`, {
        fontSize: '12px', color: opts.startingRelicColor ?? '#e74c3c', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    g.add(this.add.text(cx, hasRelic ? cy + 48 : cy + 44, 'tap to play  →', {
      fontSize: '17px', color: '#4a6878'
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
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 118, `vs. ${def.name}  ·  ${def.hp} HP`, {
      fontSize: '17px', color: '#5a7080'
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
        fontSize: '17px', color: '#567090', letterSpacing: 1
      }).setOrigin(0.5));

      bg.on('pointerdown', () => {
        this._diceCount  = n;
        this._diceConfig = Array.from({ length: n }, (_, j) => ({
          id: `custom_${j}`, type: null, sides: 6,
          runeMap: {}, material: null, culledFaces: [],
          upgradeState: { takenUpgrades: [] },
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
      fontSize: '17px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5));

    const startY   = 76;
    const rowH     = 114;
    const typeW    = 70, typeH = 28, typeGap = 6;
    const sidesW   = 46, sidesH = 22, sidesGap = 4;
    const bxStart  = 52;
    const TYPE_ROWS = [DIE_TYPE_KEYS, SPECIAL_DIE_KEYS];

    this._diceConfig.forEach((dc, di) => {
      const base   = startY + di * rowH;
      const labelY = base + 10;
      const type1Y = base + 36;
      const type2Y = base + 66;
      const sidesY = base + 94;

      g.add(this.add.text(16, labelY, `Die ${di + 1}`, {
        fontSize: '13px', color: '#445566', letterSpacing: 1,
      }).setOrigin(0, 0.5));

      TYPE_ROWS.forEach((keys, rowIdx) => {
        const subY = rowIdx === 0 ? type1Y : type2Y;
        keys.forEach((typeId, ti) => {
          const dt  = DIE_TYPES[typeId];
          const fc  = parseInt(dt.color.replace('#', ''), 16);
          const bx  = bxStart + ti * (typeW + typeGap) + typeW / 2;
          const sel = dc.type === typeId;

          const bbg = this.add.rectangle(bx, subY, typeW, typeH, sel ? 0x1a2030 : 0x0d0d1c);
          bbg.setStrokeStyle(sel ? 2 : 1, fc, sel ? 1 : 0.35).setInteractive();
          g.add(bbg);
          g.add(this.add.text(bx, subY, dt.sym, {
            fontSize: '13px', color: sel ? dt.color : '#334455', fontStyle: sel ? 'bold' : 'normal',
          }).setOrigin(0.5));

          bbg.on('pointerdown', () => {
            dc.type = typeId;
            this._transitionTo(() => this._showTypeStep());
          });
          bbg.on('pointerover',  () => { if (!sel) bbg.setFillStyle(0x181828); });
          bbg.on('pointerout',   () => { if (!sel) bbg.setFillStyle(0x0d0d1c); });
        });
      });

      SIDES_PROGRESSION.forEach((sides, si) => {
        const bx  = bxStart + si * (sidesW + sidesGap) + sidesW / 2;
        const sel = dc.sides === sides;

        const sbg = this.add.rectangle(bx, sidesY, sidesW, sidesH, sel ? 0x1a2030 : 0x0d0d1c);
        sbg.setStrokeStyle(sel ? 2 : 1, 0xf0c040, sel ? 0.9 : 0.2).setInteractive();
        g.add(sbg);
        g.add(this.add.text(bx, sidesY, `d${sides}`, {
          fontSize: '12px', color: sel ? '#f0c040' : '#334455', fontStyle: sel ? 'bold' : 'normal',
        }).setOrigin(0.5));

        sbg.on('pointerdown', () => {
          dc.sides = sides;
          this._transitionTo(() => this._showTypeStep());
        });
        sbg.on('pointerover',  () => { if (!sel) sbg.setFillStyle(0x181828); });
        sbg.on('pointerout',   () => { if (!sel) sbg.setFillStyle(0x0d0d1c); });
      });

      if (di < this._diceConfig.length - 1) {
        g.add(this.add.rectangle(W / 2, base + rowH, W - 24, 1, 0x1e2840));
      }
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

    g.add(this.add.text(W / 2, 36, 'BRANDS & MATERIALS', {
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

      rBg.on('pointerdown', () => this._transitionTo(() => this._showBrandPickerStep(di)));
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

    const isCustom = !this._usedClassPreset;
    const btnBg = this.add.rectangle(W / 2, H - 44, W - 16, 50, 0x163824);
    btnBg.setStrokeStyle(1.5, 0x27ae60, 0.9).setInteractive();
    btnBg.on('pointerdown', () => this._transitionTo(() =>
      isCustom ? this._showUpgradeStep() : this._startBattle()
    ));
    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x27ae60));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x163824));
    g.add(btnBg);
    g.add(this.add.text(W / 2, H - 44, isCustom ? 'Next  →' : 'Begin Battle', {
      fontSize: '17px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5));

    this._addBackBtn(g, () => this._usedClassPreset ? this._showClassStep() : this._showTypeStep());
    this._fadeIn(g);
  }

  // ─── RUNE PICKER ─────────────────────────────────────────────────────────

  _showBrandPickerStep(di) {
    const g = this._stepGroup = this.add.container(0, 0);
    const dc = this._diceConfig[di];
    const dt = DIE_TYPES[dc.type];

    g.add(this.add.text(W / 2, 36, 'CHOOSE A BRAND', {
      fontSize: '17px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 62, `Die ${di + 1} — ${dt?.sym ?? '?'} d${dc.sides}`, {
      fontSize: '13px', color: dt ? dt.color : '#445566',
    }).setOrigin(0.5));

    const RARITY_COLOR = { common: 0x556677, uncommon: 0x2471a3, rare: 0x6c3483 };
    const ITEM_H = 96, ITEM_GAP = 8, ITEM_TOTAL = ITEM_H + ITEM_GAP;
    const LIST_TOP  = 80;
    const LIST_BTM  = H - 60;
    const LIST_H    = LIST_BTM - LIST_TOP;
    const all       = RUNE_KEYS.map(id => RUNES[id]);
    const totalH    = all.length * ITEM_TOTAL - ITEM_GAP;
    const maxScroll = Math.max(0, totalH - LIST_H);

    let scrollY = 0;
    const listCont = this.add.container(0, LIST_TOP);
    g.add(listCont);

    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillRect(0, LIST_TOP, W, LIST_H);
    listCont.setMask(maskGfx.createGeometryMask());

    all.forEach((rune, i) => {
      const iy     = i * ITEM_TOTAL;
      const cy     = iy + ITEM_H / 2;
      const rc     = parseInt(rune.color.replace('#', ''), 16);
      const rarCol = RARITY_COLOR[rune.rarity] ?? RARITY_COLOR.common;
      const active = Object.values(dc.runeMap ?? {}).includes(rune.id);

      const bg = this.add.rectangle(W / 2, cy, W - 32, ITEM_H, active ? 0x1a1a3a : 0x0d0d1c);
      bg.setStrokeStyle(1.5, rarCol, active ? 0.9 : 0.5);
      listCont.add(bg);
      listCont.add(this.add.rectangle(16, cy, 4, ITEM_H - 16, rc, 0.8));
      listCont.add(this.add.text(28, cy - 26, `${rune.sym}  ${rune.label}`, {
        fontSize: '15px', color: rune.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      listCont.add(this.add.text(28, cy - 6, rune.rarity.toUpperCase(), {
        fontSize: '11px', color: '#445566', letterSpacing: 1,
      }).setOrigin(0, 0.5));
      listCont.add(this.add.text(28, cy + 18, rune.desc, {
        fontSize: '12px', color: '#8899aa', wordWrap: { width: W - 56 },
      }).setOrigin(0, 0.5));
    });

    let ptrDownY = null, scrollAtDown = 0;
    const dragZone = this.add.rectangle(W / 2, LIST_TOP + LIST_H / 2, W, LIST_H, 0, 0).setInteractive();
    g.add(dragZone);

    dragZone.on('pointerdown', ptr => { ptrDownY = ptr.y; scrollAtDown = scrollY; });

    const onMove = ptr => {
      if (!ptr.isDown || ptrDownY === null) return;
      scrollY = Phaser.Math.Clamp(scrollAtDown + (ptrDownY - ptr.y), 0, maxScroll);
      listCont.y = LIST_TOP - scrollY;
    };
    this.input.on('pointermove', onMove);

    dragZone.on('pointerup', ptr => {
      if (ptrDownY !== null && Math.abs(ptr.y - ptrDownY) < 8) {
        const relY = ptr.y - LIST_TOP + scrollY;
        const idx  = Math.floor(relY / ITEM_TOTAL);
        if (idx >= 0 && idx < all.length) {
          this._openFaceRunePicker(di, all[idx].id, () => this._transitionTo(() => this._showRuneStep()));
        }
      }
      ptrDownY = null;
    });

    g.once('destroy', () => { this.input.off('pointermove', onMove); maskGfx.destroy(); });
    this._addBackBtn(g, () => this._showRuneStep());
    this._fadeIn(g);
  }

  _openFaceRunePicker(di, runeId, onPick = null) {
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
      panel.add(this.add.text(ax, ay, String(Math.floor(fi / 2) + 1), {
        fontSize: '17px', color: sel ? rune.color : (dt?.color ?? '#ffffff'),
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5));

      tbg.on('pointerdown', () => {
        if (!dc.runeMap) dc.runeMap = {};
        dc.runeMap[fi] = runeId;
        this._closePicker();
        if (onPick) onPick();
        else        this._refreshRuneSlot(di);
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
        // Restore faces culled by uranium if removing it
        if (dc.material === 'uranium' && dc.uraniumCulledFaces?.length) {
          dc.culledFaces = (dc.culledFaces ?? []).filter(f => !dc.uraniumCulledFaces.includes(f));
          delete dc.uraniumCulledFaces;
        }
        const newMat = dc.material === matId ? null : matId;
        dc.material = newMat;
        // Apply uranium culling when selected
        if (newMat === 'uranium') {
          const halfStart = Math.floor(dc.sides / 2) + 1;
          const newlyCulled = [];
          for (let f = halfStart; f <= dc.sides; f++) {
            if (!(dc.culledFaces ?? []).includes(f)) newlyCulled.push(f);
          }
          dc.culledFaces = [...(dc.culledFaces ?? []), ...newlyCulled];
          dc.uraniumCulledFaces = newlyCulled;
        }
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

  // ─── STARTING RELIC ───────────────────────────────────────────────────────

  _showStartingRelicStep() {
    const g = this._stepGroup = this.add.container(0, 0);

    g.add(this.add.text(W / 2, 36, 'STARTING CHIP', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 66, 'Pick one to carry into your first battle — or skip.', {
      fontSize: '13px', color: '#445566', wordWrap: { width: W - 40 }, align: 'center',
    }).setOrigin(0.5));

    const all = getRelics().filter(r => !r.exclusive);
    const choices = Phaser.Math.RND.shuffle([...all]).slice(0, 3);

    const RARITY_COLOR = { common: 0x556677, uncommon: 0x2471a3, rare: 0x6c3483, boss: 0x922b21 };
    const cardH = 116, gap = 10, startY = 90;

    choices.forEach((relic, i) => {
      const cy     = startY + i * (cardH + gap) + cardH / 2;
      const fc     = parseInt((relic.color ?? '#ffffff').replace('#', ''), 16);
      const rarCol = RARITY_COLOR[relic.rarity] ?? RARITY_COLOR.common;

      const bg = this.add.rectangle(W / 2, cy, W - 32, cardH, 0x0d0d1c);
      bg.setStrokeStyle(2, rarCol, 0.85).setInteractive();
      g.add(bg);

      const dot = this.add.circle(44, cy, 12, fc, 0.9);
      g.add(dot);
      g.add(this.add.text(44, cy, relic.name[0].toUpperCase(), {
        fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));

      g.add(this.add.text(72, cy - 22, relic.name, {
        fontSize: '17px', color: relic.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      g.add(this.add.text(72, cy - 2, relic.rarity.toUpperCase(), {
        fontSize: '11px', color: '#334455', letterSpacing: 1,
      }).setOrigin(0, 0.5));
      g.add(this.add.text(72, cy + 20, relic.description, {
        fontSize: '13px', color: '#8899aa', wordWrap: { width: W - 96 },
      }).setOrigin(0, 0.5));

      bg.on('pointerover', () => bg.setFillStyle(0x1a1a2e));
      bg.on('pointerout',  () => bg.setFillStyle(0x0d0d1c));
      bg.on('pointerdown', () => {
        this._startingRelic = relic;
        this._startBattle();
      });
    });

    const skipY = startY + choices.length * (cardH + gap) + 30;
    const skipBg = this.add.rectangle(W / 2, skipY, W - 32, 44, 0x0a0a14);
    skipBg.setStrokeStyle(1, 0x222233, 0.8).setInteractive();
    skipBg.on('pointerdown', () => this._startBattle());
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x181828));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(0x0a0a14));
    g.add(skipBg);
    g.add(this.add.text(W / 2, skipY, 'Skip  →', {
      fontSize: '15px', color: '#2a3848',
    }).setOrigin(0.5, 0.5));

    this._addBackBtn(g, () => this._showRuneStep());
    this._fadeIn(g);
  }

  // ─── UPGRADE SELECTION ────────────────────────────────────────────────────

  _showUpgradeStep() {
    if (this._upgradeActiveDie === undefined) this._upgradeActiveDie = 0;
    this._upgradeActiveDie = Phaser.Math.Clamp(this._upgradeActiveDie, 0, this._diceConfig.length - 1);

    const g          = this._stepGroup = this.add.container(0, 0);
    const activeDie  = this._upgradeActiveDie;
    const dc         = this._diceConfig[activeDie];

    const RARITY_COLOR = { common: 0x556677, uncommon: 0x2471a3, rare: 0x6c3483 };
    const ITEM_H = 96, ITEM_GAP = 8, ITEM_TOTAL = ITEM_H + ITEM_GAP;
    const LIST_TOP = 118;
    const LIST_BTM = H - 66;
    const LIST_H   = LIST_BTM - LIST_TOP;
    const allUpgr  = UPGRADES;
    const totalH   = allUpgr.length * ITEM_TOTAL - ITEM_GAP;
    const maxScroll = Math.max(0, totalH - LIST_H);

    // Title
    g.add(this.add.text(W / 2, 28, 'UPGRADES', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));

    // Die selector tabs
    const tabW = Math.floor((W - 20) / this._diceConfig.length) - 6;
    const tabsTotalW = this._diceConfig.length * (tabW + 6) - 6;
    const tabsX0 = (W - tabsTotalW) / 2;

    this._diceConfig.forEach((d, i) => {
      const dt      = DIE_TYPES[d.type];
      const isActive = i === activeDie;
      const tx      = tabsX0 + i * (tabW + 6) + tabW / 2;
      const fc      = dt ? parseInt(dt.color.replace('#', ''), 16) : 0x334455;
      const taken   = d.upgradeState?.takenUpgrades ?? [];

      const tabBg = this.add.rectangle(tx, 66, tabW, 30, isActive ? 0x1a2030 : 0x0d0d1c);
      tabBg.setStrokeStyle(isActive ? 2 : 1, fc, isActive ? 0.9 : 0.35);
      g.add(tabBg);

      const label = `D${i + 1} ${dt?.sym ?? '?'}`;
      g.add(this.add.text(tx, 61, label, {
        fontSize: '12px', color: isActive ? (dt?.color ?? '#aaaaaa') : '#334455',
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5));
      if (taken.length > 0) {
        g.add(this.add.text(tx, 75, `×${taken.length}`, {
          fontSize: '9px', color: isActive ? '#88aacc' : '#2a3848',
        }).setOrigin(0.5));
      }

      if (!isActive) {
        tabBg.setInteractive();
        tabBg.on('pointerdown', () => {
          this._upgradeActiveDie = i;
          this._transitionTo(() => this._showUpgradeStep());
        });
        tabBg.on('pointerover', () => tabBg.setFillStyle(0x141424));
        tabBg.on('pointerout',  () => tabBg.setFillStyle(0x0d0d1c));
      }
    });

    // "X selected" summary line under tabs
    const taken0    = dc.upgradeState?.takenUpgrades ?? [];
    const summaryTxt = this.add.text(W / 2, 98,
      taken0.length > 0 ? `${taken0.length} selected` : 'tap to add upgrades', {
      fontSize: '12px', color: taken0.length > 0 ? '#88aacc' : '#2a3848',
    }).setOrigin(0.5);
    g.add(summaryTxt);

    // Scrollable upgrade list
    let scrollY = 0;
    const listCont = this.add.container(0, LIST_TOP);
    g.add(listCont);

    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillRect(0, LIST_TOP, W, LIST_H);
    listCont.setMask(maskGfx.createGeometryMask());

    const items = [];

    allUpgr.forEach((upg, i) => {
      const iy     = i * ITEM_TOTAL;
      const cy     = iy + ITEM_H / 2;
      const uc     = parseInt((upg.color ?? '#ffffff').replace('#', ''), 16);
      const rarCol = RARITY_COLOR[upg.rarity] ?? RARITY_COLOR.common;
      const sel    = (dc.upgradeState?.takenUpgrades ?? []).includes(upg.id);

      const bg       = this.add.rectangle(W / 2, cy, W - 32, ITEM_H, sel ? 0x1a1a3a : 0x0d0d1c);
      bg.setStrokeStyle(1.5, rarCol, sel ? 0.9 : 0.5);
      const colorBar = this.add.rectangle(16, cy, 4, ITEM_H - 12, uc, sel ? 1 : 0.55);
      const nameTxt  = this.add.text(28, cy - 28, upg.name, {
        fontSize: '15px', color: upg.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const rarTxt   = this.add.text(28, cy - 8, upg.rarity.toUpperCase(), {
        fontSize: '11px', color: '#445566', letterSpacing: 1,
      }).setOrigin(0, 0.5);
      const descTxt  = this.add.text(28, cy + 16, UPGRADE_DESCRIPTIONS[upg.id] ?? '', {
        fontSize: '12px', color: '#8899aa', wordWrap: { width: W - 60 },
      }).setOrigin(0, 0.5);

      listCont.add([bg, colorBar, nameTxt, rarTxt, descTxt]);
      items.push({ upg, bg, colorBar, rarCol });
    });

    // Bottom next button
    const btnBg = this.add.rectangle(W / 2, H - 38, W - 16, 46, 0x163824);
    btnBg.setStrokeStyle(1.5, 0x27ae60, 0.9).setInteractive();
    btnBg.on('pointerdown', () => this._transitionTo(() => this._showCustomRelicStep()));
    btnBg.on('pointerover', () => btnBg.setFillStyle(0x27ae60));
    btnBg.on('pointerout',  () => btnBg.setFillStyle(0x163824));
    g.add(btnBg);
    g.add(this.add.text(W / 2, H - 38, 'Next  →', {
      fontSize: '17px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5));

    // Drag zone: scroll + tap
    let ptrDownY = null, scrollAtDown = 0;
    const dragZone = this.add.rectangle(W / 2, LIST_TOP + LIST_H / 2, W, LIST_H, 0, 0).setInteractive();
    g.add(dragZone);

    dragZone.on('pointerdown', ptr => { ptrDownY = ptr.y; scrollAtDown = scrollY; });

    const onMove = ptr => {
      if (!ptr.isDown || ptrDownY === null) return;
      scrollY = Phaser.Math.Clamp(scrollAtDown + (ptrDownY - ptr.y), 0, maxScroll);
      listCont.y = LIST_TOP - scrollY;
    };
    this.input.on('pointermove', onMove);

    dragZone.on('pointerup', ptr => {
      if (ptrDownY !== null && Math.abs(ptr.y - ptrDownY) < 8) {
        const relY = ptr.y - LIST_TOP + scrollY;
        const idx  = Math.floor(relY / ITEM_TOTAL);
        if (idx >= 0 && idx < items.length) {
          const { upg, bg, colorBar, rarCol } = items[idx];
          if (!dc.upgradeState) dc.upgradeState = { takenUpgrades: [] };
          const arr    = dc.upgradeState.takenUpgrades;
          const si     = arr.indexOf(upg.id);
          const nowSel = si < 0;
          if (si >= 0) arr.splice(si, 1); else arr.push(upg.id);
          bg.setFillStyle(nowSel ? 0x1a1a3a : 0x0d0d1c);
          bg.setStrokeStyle(1.5, rarCol, nowSel ? 0.9 : 0.5);
          colorBar.setAlpha(nowSel ? 1 : 0.55);
          const n = arr.length;
          summaryTxt.setText(n > 0 ? `${n} selected` : 'tap to add upgrades');
          summaryTxt.setColor(n > 0 ? '#88aacc' : '#2a3848');
        }
      }
      ptrDownY = null;
    });

    g.once('destroy', () => { this.input.off('pointermove', onMove); maskGfx.destroy(); });
    this._addBackBtn(g, () => this._showRuneStep());
    this._fadeIn(g);
  }

  // ─── CUSTOM RELIC SELECTION ───────────────────────────────────────────────

  _showCustomRelicStep() {
    const g = this._stepGroup = this.add.container(0, 0);
    if (this._selectedCustomRelics === null) this._selectedCustomRelics = [];

    const all = getRelics();
    const RARITY_COLOR = { common: 0x556677, uncommon: 0x2471a3, rare: 0x6c3483, boss: 0x922b21 };
    const ITEM_H = 96, ITEM_GAP = 8, ITEM_TOTAL = ITEM_H + ITEM_GAP;
    const LIST_TOP  = 100;
    const LIST_BTM  = H - 66;
    const LIST_H    = LIST_BTM - LIST_TOP;
    const totalH    = all.length * ITEM_TOTAL - ITEM_GAP;
    const maxScroll = Math.max(0, totalH - LIST_H);

    g.add(this.add.text(W / 2, 36, 'CHOOSE CHIPS', {
      fontSize: '20px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));
    g.add(this.add.text(W / 2, 68, 'Select any to take into battle.', {
      fontSize: '13px', color: '#445566',
    }).setOrigin(0.5));

    let scrollY = 0;
    const listCont = this.add.container(0, LIST_TOP);
    g.add(listCont);

    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillRect(0, LIST_TOP, W, LIST_H);
    listCont.setMask(maskGfx.createGeometryMask());

    const items = [];

    all.forEach((relic, i) => {
      const iy     = i * ITEM_TOTAL;
      const cy     = iy + ITEM_H / 2;
      const fc     = parseInt((relic.color ?? '#ffffff').replace('#', ''), 16);
      const rarCol = RARITY_COLOR[relic.rarity] ?? RARITY_COLOR.common;

      const bg      = this.add.rectangle(W / 2, cy, W - 32, ITEM_H, 0x0d0d1c);
      const dot     = this.add.circle(44, cy, 12, fc, 0.8);
      const dotLtr  = this.add.text(44, cy, relic.name[0].toUpperCase(), {
        fontSize: '12px', color: '#dddddd', fontStyle: 'bold',
      }).setOrigin(0.5);
      const nameTxt = this.add.text(72, cy - 22, relic.name, {
        fontSize: '15px', color: relic.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const rarTxt  = this.add.text(72, cy - 3, relic.rarity.toUpperCase(), {
        fontSize: '11px', color: '#445566', letterSpacing: 1,
      }).setOrigin(0, 0.5);
      const descTxt = this.add.text(72, cy + 18, relic.description, {
        fontSize: '12px', color: '#8899aa', wordWrap: { width: W - 96 },
      }).setOrigin(0, 0.5);

      listCont.add([bg, dot, dotLtr, nameTxt, rarTxt, descTxt]);

      const refresh = (sel) => {
        bg.setFillStyle(sel ? 0x1a1a3a : 0x0d0d1c);
        bg.setStrokeStyle(2, rarCol, sel ? 0.9 : 0.5);
        dot.setAlpha(sel ? 1 : 0.8);
        dotLtr.setColor(sel ? '#ffffff' : '#dddddd');
        nameTxt.setColor(relic.color);
        rarTxt.setColor(sel ? '#667788' : '#445566');
        descTxt.setColor(sel ? '#8899aa' : '#6677aa');
      };
      refresh(this._selectedCustomRelics.some(r => r.id === relic.id));
      items.push({ relic, refresh });
    });

    // Begin Battle button
    const btnBg = this.add.rectangle(W / 2, H - 38, W - 16, 46, 0x163824);
    btnBg.setStrokeStyle(1.5, 0x27ae60, 0.9).setInteractive();
    const btnTxt = this.add.text(W / 2, H - 38,
      `Begin Battle · ${this._selectedCustomRelics.length} chips`, {
        fontSize: '17px', color: '#aaffaa', fontStyle: 'bold', letterSpacing: 2,
      }).setOrigin(0.5);
    btnBg.on('pointerdown', () => this._startBattle());
    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x27ae60));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x163824));
    g.add(btnBg);
    g.add(btnTxt);

    // Transparent drag zone sits above the list to capture scroll + tap
    let ptrDownY = null, scrollAtDown = 0;

    const dragZone = this.add.rectangle(W / 2, LIST_TOP + LIST_H / 2, W, LIST_H, 0, 0)
      .setInteractive();
    g.add(dragZone);

    dragZone.on('pointerdown', ptr => {
      ptrDownY     = ptr.y;
      scrollAtDown = scrollY;
    });

    const onMove = ptr => {
      if (!ptr.isDown || ptrDownY === null) return;
      scrollY = Phaser.Math.Clamp(scrollAtDown + (ptrDownY - ptr.y), 0, maxScroll);
      listCont.y = LIST_TOP - scrollY;
    };
    this.input.on('pointermove', onMove);

    dragZone.on('pointerup', ptr => {
      if (ptrDownY !== null && Math.abs(ptr.y - ptrDownY) < 8) {
        const relY = ptr.y - LIST_TOP + scrollY;
        const idx  = Math.floor(relY / ITEM_TOTAL);
        if (idx >= 0 && idx < items.length) {
          const { relic, refresh } = items[idx];
          const si = this._selectedCustomRelics.findIndex(r => r.id === relic.id);
          if (si >= 0) this._selectedCustomRelics.splice(si, 1);
          else         this._selectedCustomRelics.push(relic);
          refresh(this._selectedCustomRelics.some(r => r.id === relic.id));
          btnTxt.setText(`Begin Battle · ${this._selectedCustomRelics.length} chips`);
        }
      }
      ptrDownY = null;
    });

    g.once('destroy', () => {
      this.input.off('pointermove', onMove);
      maskGfx.destroy();
    });

    this._addBackBtn(g, () => this._showUpgradeStep());
    this._fadeIn(g);
  }

  // ─── LAUNCH ───────────────────────────────────────────────────────────────

  _startBattle() {
    if (this._mpMode) {
      if (this._mpPlayer === 1) {
        // P1 done — run setup for P2
        this.time.delayedCall(1, () => this.scene.start('SetupScene', {
          mpMode: true, mpPlayer: 2,
          p1Config: this._diceConfig,
          p1Relic:  this._startingRelic?.id ?? null,
        }));
      } else {
        // Both done — start Dice Duel
        this.time.delayedCall(1, () => this.scene.start('DiceDuelScene', {
          p1Config:    this._mpP1Config,
          p2Config:    this._diceConfig,
          p1Relic:     this._mpP1Relic,
          p2Relic:     this._startingRelic?.id ?? null,
          p1Hp:        30,
          p2Hp:        30,
          p1Wins:      0,
          p2Wins:      0,
          gameNum:     1,
          firstPlayer: Math.random() < 0.5 ? 'p1' : 'p2',
        }));
      }
      return;
    }
    const relics = this._selectedCustomRelics !== null
      ? this._selectedCustomRelics
      : (this._startingRelic ? [this._startingRelic] : []);
    this.time.delayedCall(1, () => this.scene.start('BattleScene', {
      playerDiceConfig: this._diceConfig,
      playerHp:         PLAYER_MAX_HP,
      playerMaxHp:      PLAYER_MAX_HP,
      battleIndex:      BATTLE_SEQUENCE.indexOf(this._enemyKey),
      activeRelics:     relics,
    }));
  }
}
