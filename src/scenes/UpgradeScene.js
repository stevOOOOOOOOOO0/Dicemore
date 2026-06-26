import Phaser from 'phaser';
import { DIE_TYPES } from '../data/dice.js';
import { MATERIALS } from '../data/runes.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';
import { UPGRADES, UPGRADE_DESCRIPTIONS } from '../data/upgrades.js';
import LotterySystem from '../systems/LotterySystem.js';

const CARD_W    = W - 32;
const CARD_H    = 110;
const CARD_GAP  = 12;
const CARDS_TOP = 104;

const RARITY_TEXT_COLOR = {
  common:   '#aaaaaa',
  uncommon: '#58d68d',
  rare:     '#f0c040',
};

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  init(data) {
    this.playerDiceConfig = JSON.parse(JSON.stringify(data.playerDiceConfig));
    this.playerHp         = data.playerHp;
    this.playerMaxHp      = data.playerMaxHp ?? PLAYER_MAX_HP;
    this.battleIndex      = data.battleIndex;
    this.isBossReward     = data.isBossReward ?? false;
    this.activeRelics     = data.activeRelics ? [...data.activeRelics] : [];
    this.playerGold       = data.playerGold   ?? 0;
    this.cullCount        = data.cullCount    ?? 0;
    this.witchRunes       = data.witchRunes   ?? [];
    this._returnScene     = data.returnScene  ?? null;
    this._returnData      = data.returnData   ?? null;
    this._screenObjects   = [];
    this._stepLbl         = null;
    this._navigating      = false;
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);
    this._buildHeader();
    if (this.isBossReward) {
      this._showBossRewardStep();
    } else {
      this._showCardStep();
    }
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────

  _buildHeader() {
    this.add.text(W / 2, 26, 'UPGRADE', {
      fontSize: '22px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);

    const hpPct = Math.max(0, this.playerHp) / this.playerMaxHp;
    this.add.text(W / 2, 52, `HP: ${Math.max(0, this.playerHp)} / ${this.playerMaxHp}`, {
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

  // ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────

  _nav(fn) { this.time.delayedCall(1, fn); }

  _clearScreen() {
    this._screenObjects.forEach(o => { try { o?.destroy(); } catch (_) {} });
    this._screenObjects = [];
  }

  _track(obj) {
    this._screenObjects.push(obj);
    return obj;
  }

  // ─── UPGRADE POOL LOGIC ──────────────────────────────────────────────────

  _drawUpgrades() {
    // Count how many upgrades have been received so far to gate rarity.
    const totalTaken = this.playerDiceConfig.reduce(
      (sum, dc) => sum + (dc.upgradeState?.takenUpgrades?.length ?? 0), 0
    );

    if (totalTaken < 3) {
      // First 3 upgrades: common and uncommon only
      const pool = UPGRADES.filter(u => u.rarity === 'common' || u.rarity === 'uncommon');
      return new LotterySystem(pool, []).draw(3);
    }

    // Later upgrades: draw 1 from the full pool (may be rare), then 2 from
    // common/uncommon only — guaranteeing at most 1 rare per offer.
    const first      = new LotterySystem(UPGRADES, []).draw(1);
    const usedIds    = new Set(first.map(u => u.id));
    const nonRarePl  = UPGRADES.filter(u =>
      (u.rarity === 'common' || u.rarity === 'uncommon') && !usedIds.has(u.id)
    );
    const rest = new LotterySystem(nonRarePl, []).draw(2);
    return Phaser.Math.RND.shuffle([...first, ...rest]);
  }

  // ─── STEP 1: CARD SELECTION ──────────────────────────────────────────────

  _showCardStep() {
    this._clearScreen();
    this._stepLbl?.setText('Choose an upgrade.');

    const options = this._drawUpgrades();

    options.forEach((upg, i) => {
      const cy   = CARDS_TOP + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      const fc   = parseInt(upg.color.replace('#', ''), 16);
      const desc = UPGRADE_DESCRIPTIONS[upg.id] ?? '';
      const rarityColor = RARITY_TEXT_COLOR[upg.rarity] ?? '#aaaaaa';

      const bg = this._track(this.add.rectangle(W / 2, cy, CARD_W, CARD_H, 0x0d0d1c));
      bg.setStrokeStyle(1.5, fc, 0.55).setInteractive();

      // Left accent bar
      this._track(this.add.rectangle(16, cy, 4, CARD_H - 16, fc, 0.7));

      // Rarity tag
      this._track(this.add.text(30, cy - 38, upg.rarity.toUpperCase(), {
        fontSize: '10px', color: rarityColor, letterSpacing: 2,
      }).setOrigin(0, 0.5));

      // Upgrade name
      this._track(this.add.text(30, cy - 18, upg.name, {
        fontSize: '17px', color: upg.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      // Description
      this._track(this.add.text(30, cy + 18, desc, {
        fontSize: '13px', color: '#556677', wordWrap: { width: CARD_W - 60 },
      }).setOrigin(0, 0.5));

      const arrow = this._track(this.add.text(W - 24, cy, '→', {
        fontSize: '20px', color: '#2a2a3a',
      }).setOrigin(0.5));

      bg.on('pointerdown', () => this._nav(() => this._showDiePicker(upg.id)));
      bg.on('pointerover',  () => { bg.setFillStyle(0x181828); bg.setStrokeStyle(2, fc, 0.9); arrow.setColor(upg.color); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x0d0d1c); bg.setStrokeStyle(1.5, fc, 0.55); arrow.setColor('#2a2a3a'); });
    });

    this._addHealButton();
  }

  // ─── STEP 2: DIE PICKER ──────────────────────────────────────────────────

  _showDiePicker(upgradeId) {
    this._clearScreen();
    const upg = UPGRADES.find(u => u.id === upgradeId);
    this._stepLbl?.setText('Choose a die to receive this upgrade.');

    if (upg) {
      const fc = parseInt(upg.color.replace('#', ''), 16);
      this._track(this.add.text(W / 2, CARDS_TOP - 16, upg.name, {
        fontSize: '17px', color: upg.color, fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));
    }

    const sz = 64, gap = 10;
    const total  = this.playerDiceConfig.length;
    const totW   = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY   = CARDS_TOP + 68;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt      = DIE_TYPES[dc.type];
      const tcol    = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x       = startX + dieIdx * (sz + gap);
      const alreadyHas = dc.upgradeState?.takenUpgrades?.includes(upgradeId) ?? false;

      const bg = this._track(this.add.rectangle(x, rowY, sz, sz, 0x0d0d1c));
      bg.setStrokeStyle(2, tcol, alreadyHas ? 0.18 : 0.8);
      if (!alreadyHas) bg.setInteractive();

      this._track(this.add.text(x, rowY - 14, dt ? dt.sym : '?', {
        fontSize: '15px', color: alreadyHas ? '#333344' : (dt ? dt.color : '#ffffff'),
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5));

      this._track(this.add.text(x, rowY + 8, `d${dc.sides}`, {
        fontSize: '13px', color: alreadyHas ? '#333344' : '#aaaaaa',
      }).setOrigin(0.5, 0.5));

      // Upgrade count badge
      const takenCount = dc.upgradeState?.takenUpgrades?.length ?? 0;
      if (takenCount > 0) {
        this._track(this.add.text(x + sz / 2 - 4, rowY - sz / 2 + 4, `+${takenCount}`, {
          fontSize: '10px', color: '#f0c040',
        }).setOrigin(1, 0));
      }

      if (dc.material) {
        const m = MATERIALS[dc.material];
        this._track(this.add.text(x - sz / 2 + 2, rowY - sz / 2 + 6, m ? m.sym : '?', {
          fontSize: '9px', color: m ? m.color : '#aaaaaa',
        }).setOrigin(0, 0));
      }

      if (alreadyHas) {
        this._track(this.add.text(x, rowY + sz / 2 - 8, 'taken', {
          fontSize: '9px', color: '#445566',
        }).setOrigin(0.5, 1));
      } else {
        bg.on('pointerdown', () => this._nav(() => this._applyUpgrade(dieIdx, upgradeId)));
        bg.on('pointerover',  () => { bg.setFillStyle(0x181828); bg.setStrokeStyle(2, tcol, 1); });
        bg.on('pointerout',   () => { bg.setFillStyle(0x0d0d1c); bg.setStrokeStyle(2, tcol, 0.8); });
      }
    });

    this._addBackButton(() => this._showCardStep());
  }

  // ─── APPLY UPGRADE ───────────────────────────────────────────────────────

  _applyUpgrade(dieIdx, upgradeId) {
    const dc = this.playerDiceConfig[dieIdx];
    if (!dc.upgradeState) dc.upgradeState = { takenUpgrades: [] };
    if (!dc.upgradeState.takenUpgrades) dc.upgradeState.takenUpgrades = [];
    if (!dc.upgradeState.takenUpgrades.includes(upgradeId)) {
      dc.upgradeState.takenUpgrades.push(upgradeId);
    }
    this._continue();
  }

  // ─── BOSS REWARD ─────────────────────────────────────────────────────────

  _showBossRewardStep() {
    this._clearScreen();
    this._stepLbl?.setText('BOSS CLEARED — add a special die to your bag.');

    const SPECIAL_DICE = [
      {
        type: 'poison', color: '#58d68d',
        title: 'Pickpocket Die',
        desc:  'Stacks a slow drain on the opponent — they lose money each turn and it decays slowly',
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
      id: `boss_${Date.now()}`, type: dieType, sides: 10,
      runeMap: {}, material: null, culledFaces: [],
      upgradeState: { takenUpgrades: [] },
    });
    this._continue();
  }

  // ─── NAV HELPERS ─────────────────────────────────────────────────────────

  _addHealButton() {
    const y   = H - 44;
    const amt = 5;
    const bg  = this._track(this.add.rectangle(W / 2, y, W - 16, 50, 0x0e1a12));
    bg.setStrokeStyle(1, 0x1a6a3a, 0.8).setInteractive();
    bg.on('pointerdown', () => {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + amt);
      this._continue();
    });
    bg.on('pointerover', () => bg.setFillStyle(0x163824));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1a12));
    this._track(this.add.text(W / 2, y, `Rest — Recover ${amt} chips`, {
      fontSize: '17px', color: '#2ecc71',
    }).setOrigin(0.5));
  }

  _addSkipButton() {
    const y  = H - 44;
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
    const y  = H - 44;
    const bg = this._track(this.add.rectangle(W / 2, y, W - 16, 50, 0x1a1a2e).setInteractive());
    bg.setStrokeStyle(1, 0x2a2a4a, 0.8);
    bg.on('pointerdown', () => this._nav(onBack));
    bg.on('pointerover',  () => bg.setFillStyle(0x2a2a44));
    bg.on('pointerout',   () => bg.setFillStyle(0x1a1a2e));
    this._track(this.add.text(W / 2, y, '← Back', {
      fontSize: '17px', color: '#445566',
    }).setOrigin(0.5));
  }

  _continue() {
    if (this._navigating) return;
    this._navigating = true;
    this._clearScreen();
    this.time.delayedCall(1, () => this._goToNextBattle());
  }

  _goToNextBattle() {
    if (this._returnScene) {
      this.scene.start(this._returnScene, {
        ...this._returnData,
        updatedConfig: this.playerDiceConfig,
      });
      return;
    }
    const base = {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      playerMaxHp:      this.playerMaxHp,
      battleIndex:      this.battleIndex,
      activeRelics:     this.activeRelics,
      playerGold:       this.playerGold,
      cullCount:        this.cullCount,
      witchRunes:       this.witchRunes,
    };
    if (this.battleIndex > 0 && this.battleIndex % 3 === 0) {
      this.scene.start('ShopSelectScene', base);
    } else {
      this.scene.start('BattleScene', base);
    }
  }
}
