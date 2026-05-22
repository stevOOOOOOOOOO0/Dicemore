import Phaser from 'phaser';
import { DIE_TYPES, DIE_TYPE_KEYS, SIDES_PROGRESSION } from '../data/dice.js';
import { RUNES, MATERIALS, RUNE_KEYS, MATERIAL_KEYS } from '../data/runes.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  init(data) {
    this.playerDiceConfig = JSON.parse(JSON.stringify(data.playerDiceConfig));
    this.playerHp         = data.playerHp;
    this.battleIndex      = data.battleIndex;
    this._upgrades        = [];
    this._chosen          = false;
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    this._buildHeader();
    this._upgrades = this._generateUpgrades();
    this._buildOptions();
    this._buildSkipButton();
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────

  _buildHeader() {
    this.add.text(W / 2, 28, 'UPGRADE', {
      fontSize: '22px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4
    }).setOrigin(0.5);

    const hpPct = Math.max(0, this.playerHp) / PLAYER_MAX_HP;
    this.add.text(W / 2, 58, `HP: ${Math.max(0, this.playerHp)} / ${PLAYER_MAX_HP}`, {
      fontSize: '17px', color: '#2ecc71'
    }).setOrigin(0.5);

    const g = this.add.graphics();
    g.fillStyle(0x27ae60);
    g.fillRect(W / 2 - 80, 68, 160 * hpPct, 5);
    g.lineStyle(1, 0x1a6a3a);
    g.strokeRect(W / 2 - 80, 68, 160, 5);

    this.add.text(W / 2, 88, 'Choose one upgrade — or skip.', {
      fontSize: '17px', color: '#334455'
    }).setOrigin(0.5);
  }

  // ─── UPGRADE GENERATION ──────────────────────────────────────────────────

  _generateUpgrades() {
    const pool = [];

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt = DIE_TYPES[dc.type];

      // Upgrade sides
      const sidesIdx = SIDES_PROGRESSION.indexOf(dc.sides);
      if (sidesIdx >= 0 && sidesIdx < SIDES_PROGRESSION.length - 1) {
        const nextSides = SIDES_PROGRESSION[sidesIdx + 1];
        pool.push({
          type: 'upgrade_sides',
          dieIdx,
          nextSides,
          title: `${dt?.label ?? '?'} Die  →  d${nextSides}`,
          desc:  `Roll 1–${nextSides} instead of 1–${dc.sides}`,
          color: dt?.color ?? '#ffffff',
        });
      }

      // Add rune
      if (!dc.rune) {
        const runeId  = RUNE_KEYS[Phaser.Math.Between(0, RUNE_KEYS.length - 1)];
        const faceIdx = Phaser.Math.Between(0, dc.sides - 1);
        const rune = RUNES[runeId];
        pool.push({
          type: 'add_rune',
          dieIdx, runeId, faceIdx,
          title: `${dt?.label ?? '?'} Die  —  Add Rune`,
          desc:  `Add ${rune.label} rune to face ${faceIdx + 1}`,
          color: rune.color,
        });
      } else {
        // Swap rune
        const others  = RUNE_KEYS.filter(r => r !== dc.rune);
        const runeId  = others[Phaser.Math.Between(0, others.length - 1)];
        const faceIdx = Phaser.Math.Between(0, dc.sides - 1);
        const rune = RUNES[runeId];
        pool.push({
          type: 'swap_rune',
          dieIdx, runeId, faceIdx,
          title: `${dt?.label ?? '?'} Die  —  Swap Rune`,
          desc:  `Replace ${RUNES[dc.rune].label} with ${rune.label} on face ${faceIdx + 1}`,
          color: rune.color,
        });
      }

      // Add material
      if (!dc.material) {
        const matId = MATERIAL_KEYS[Phaser.Math.Between(0, MATERIAL_KEYS.length - 1)];
        const mat = MATERIALS[matId];
        pool.push({
          type: 'add_material',
          dieIdx, matId,
          title: `${dt?.label ?? '?'} Die  —  Material`,
          desc:  `Apply ${mat.label}: ${mat.desc}`,
          color: mat.color,
        });
      } else {
        // Swap material
        const others = MATERIAL_KEYS.filter(m => m !== dc.material);
        const matId  = others[Phaser.Math.Between(0, others.length - 1)];
        const mat = MATERIALS[matId];
        pool.push({
          type: 'swap_material',
          dieIdx, matId,
          title: `${dt?.label ?? '?'} Die  —  New Material`,
          desc:  `Swap ${MATERIALS[dc.material].label} for ${mat.label}`,
          color: mat.color,
        });
      }
    });

    // Add-die option (random type)
    const typeId  = DIE_TYPE_KEYS[Phaser.Math.Between(0, DIE_TYPE_KEYS.length - 1)];
    const addType = DIE_TYPES[typeId];
    pool.push({
      type: 'add_die',
      dieType: typeId,
      title: `New ${addType.label} Die`,
      desc:  `Add a d4 ${addType.label} die to your bag`,
      color: addType.color,
    });

    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, 3);
  }

  // ─── OPTION CARDS ────────────────────────────────────────────────────────

  _buildOptions() {
    const cardW = W - 32, cardH = 120;
    const startY = 116;
    const gap = 14;

    this._upgrades.forEach((upg, i) => {
      const cy  = startY + i * (cardH + gap) + cardH / 2;
      const fc  = parseInt(upg.color.replace('#', ''), 16);

      const bg = this.add.rectangle(W / 2, cy, cardW, cardH, 0x0d0d1c);
      bg.setStrokeStyle(1.5, fc, 0.55).setInteractive();

      // Left accent bar
      const bar = this.add.rectangle(16, cy, 4, cardH - 16, fc, 0.7);

      const titleTxt = this.add.text(30, cy - 26, upg.title, {
        fontSize: '17px', color: upg.color, fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      const descTxt = this.add.text(30, cy + 4, upg.desc, {
        fontSize: '17px', color: '#556677', wordWrap: { width: cardW - 48 }
      }).setOrigin(0, 0.5);

      const arrow = this.add.text(W - 24, cy, '→', {
        fontSize: '20px', color: '#2a2a3a'
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        if (this._chosen) return;
        this._chosen = true;
        this._applyUpgrade(upg);
      });
      bg.on('pointerover', () => {
        bg.setFillStyle(0x181828);
        bg.setStrokeStyle(2, fc, 0.9);
        arrow.setColor(upg.color);
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(0x0d0d1c);
        bg.setStrokeStyle(1.5, fc, 0.55);
        arrow.setColor('#2a2a3a');
      });
    });
  }

  _buildSkipButton() {
    const y = H - 44;
    const bg = this.add.rectangle(W / 2, y, W - 16, 50, 0x1a1a2e).setInteractive();
    bg.setStrokeStyle(1, 0x2a2a4a, 0.8);
    bg.on('pointerdown', () => this._continue());
    bg.on('pointerover',  () => bg.setFillStyle(0x2a2a44));
    bg.on('pointerout',   () => bg.setFillStyle(0x1a1a2e));
    this.add.text(W / 2, y, 'Skip', {
      fontSize: '17px', color: '#445566'
    }).setOrigin(0.5);
  }

  // ─── APPLY ───────────────────────────────────────────────────────────────

  _applyUpgrade(upg) {
    const dc = this.playerDiceConfig[upg.dieIdx];

    switch (upg.type) {
      case 'upgrade_sides':
        dc.sides = upg.nextSides;
        // Clear rune if face index is now out of range
        if (dc.runeFaceIdx >= dc.sides) { dc.rune = null; dc.runeFaceIdx = -1; }
        break;
      case 'add_rune':
      case 'swap_rune':
        dc.rune = upg.runeId;
        dc.runeFaceIdx = upg.faceIdx;
        break;
      case 'add_material':
      case 'swap_material':
        dc.material = upg.matId;
        break;
      case 'add_die':
        this.playerDiceConfig.push({
          id: `upg_${Date.now()}`,
          type: upg.dieType, sides: 4,
          rune: null, runeFaceIdx: -1, material: null,
        });
        break;
    }

    this._continue();
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
