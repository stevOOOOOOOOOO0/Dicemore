import Phaser from 'phaser';
import { W, H } from '../constants.js';
import { RUNES, RUNE_KEYS, MATERIALS, MATERIAL_KEYS } from '../data/runes.js';
import { getRelics } from '../data/relics.js';
import { DIE_TYPES } from '../data/dice.js';
import LotterySystem from '../systems/LotterySystem.js';
import { RADIUS } from '../ui/theme.js';

const SHOP_DEFS = {
  trenchcoat: { name: 'Trench Coat Guy', color: '#cc8844', sec2Label: 'CHIPS',     sec2Color: '#f0c040' },
  witch:      { name: "The Witch's Corner", color: '#9b59b6', sec2Label: 'RUNES',   sec2Color: '#cc88ff' },
  forge:      { name: 'The Forge',        color: '#3498db', sec2Label: 'MATERIALS', sec2Color: '#3498db' },
};

const TAB_LABELS = {
  trenchcoat: ['BRANDS', 'CHIPS',     'SPECIAL'],
  witch:      ['BRANDS', 'RUNES',     'SPECIAL'],
  forge:      ['BRANDS', 'MATERIALS', 'SPECIAL'],
};

export default class ShopScene extends Phaser.Scene {
  constructor() { super({ key: 'ShopScene' }); }

  init(data) {
    this.playerDiceConfig = JSON.parse(JSON.stringify(data.playerDiceConfig));
    this.playerHp         = data.playerHp;
    this.playerMaxHp      = data.playerMaxHp;
    this.battleIndex      = data.battleIndex;
    this.activeRelics     = data.activeRelics ? [...data.activeRelics] : [];
    this.playerGold       = data.playerGold ?? 0;
    this.cullCount        = data.cullCount  ?? 0;
    this.witchRunes       = data.witchRunes ? [...data.witchRunes] : [];
    this.shopType         = data.shopType;
    this._witchUnlocked   = false;
    this._screenObjs      = [];
    this._activeTab       = 0;

    const ownedIds = this._buildOwnedIds();
    const ownedRelicIds = new Set(this.activeRelics.map(r => r.id));

    // Draw items via lottery for each section
    this._sec1Items = new LotterySystem(RUNE_KEYS.map(id => RUNES[id]), ownedIds).draw(10);

    if (this.shopType === 'trenchcoat') {
      const available = getRelics().filter(r => !ownedRelicIds.has(r.id) && r.rarity !== 'boss');
      this._sec2Items = new LotterySystem(available, ownedIds).draw(4);
    } else if (this.shopType === 'forge') {
      this._sec2Items = new LotterySystem(MATERIAL_KEYS.map(id => MATERIALS[id]), ownedIds).draw(4);
    } else {
      this._sec2Items = []; // witch uses dice inspector instead
    }
  }

  _buildOwnedIds() {
    const ids = [];
    this.playerDiceConfig.forEach(dc => {
      if (dc.type)     ids.push(dc.type);
      if (dc.material) ids.push(dc.material);
      Object.values(dc.runeMap ?? {}).forEach(id => ids.push(id));
    });
    this.activeRelics.forEach(r => ids.push(r.id));
    return ids;
  }

  // ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────

  get _headerH() { return 60; }
  get _tabBarH()  { return 40; }
  get _footerH()  { return 54; }
  get _contentY() { return this._headerH + this._tabBarH; }
  get _contentH() { return H - this._contentY - this._footerH; }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0d1a);
    this._buildHeader();
    this._buildTabBar();
    this._buildFooter();
    this._showTab(0);
  }

  // ─── HEADER ───────────────────────────────────────────────────────────────

  _buildHeader() {
    const def = SHOP_DEFS[this.shopType];
    const fc  = parseInt(def.color.replace('#', ''), 16);

    this.add.rectangle(W / 2, this._headerH / 2, W, this._headerH, 0x0a0a16);
    this.add.rectangle(W / 2, this._headerH, W, 2, fc, 0.4);

    this.add.text(W / 2, 20, def.name.toUpperCase(), {
      fontSize: '16px', color: def.color, fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5);

    this._goldTxt = this.add.text(W / 2, 44, `💰 ${this.playerGold}g`, {
      fontSize: '15px', color: '#f0c040',
    }).setOrigin(0.5);
  }

  _refreshGold() {
    this._goldTxt?.setText(`💰 ${this.playerGold}g`);
  }

  // ─── TAB BAR ──────────────────────────────────────────────────────────────

  _buildTabBar() {
    const labels   = TAB_LABELS[this.shopType];
    const tabW     = W / 3;
    const barY     = this._headerH + this._tabBarH / 2;

    this.add.rectangle(W / 2, this._headerH + this._tabBarH / 2, W, this._tabBarH, 0x0e0e1e);

    this._tabBgs  = [];
    this._tabTxts = [];

    labels.forEach((lbl, i) => {
      const cx = tabW * i + tabW / 2;
      const w  = tabW - 2, h = this._tabBarH - 4;
      const gfx = this.add.graphics();
      const redraw = (active) => {
        gfx.clear();
        gfx.fillStyle(active ? 0x161626 : 0x0a0a14, 1);
        gfx.fillRoundedRect(cx - w / 2, barY - h / 2, w, h, RADIUS.soft);
      };
      redraw(false);
      const hit = this.add.rectangle(cx, barY, w, h, 0x000000, 0).setInteractive();
      const tx = this.add.text(cx, barY, lbl, {
        fontSize: '12px', color: '#445566', fontStyle: 'bold', letterSpacing: 1,
      }).setOrigin(0.5);

      hit.on('pointerdown', () => this._showTab(i));
      hit.on('pointerover',  () => { if (this._activeTab !== i) redraw(true); });
      hit.on('pointerout',   () => { if (this._activeTab !== i) redraw(false); });

      this._tabBgs.push({ redraw });
      this._tabTxts.push(tx);
    });
  }

  _setActiveTab(idx) {
    const def = SHOP_DEFS[this.shopType];
    this._tabBgs.forEach((bg, i) => {
      bg.redraw(i === idx);
      this._tabTxts[i].setColor(i === idx ? def.color : '#445566');
    });
    this._activeTab = idx;
  }

  // ─── CONTENT AREA ─────────────────────────────────────────────────────────

  _clearContent() {
    this._screenObjs.forEach(o => { try { o?.destroy(); } catch (_) {} });
    this._screenObjs = [];
  }

  _track(obj) { this._screenObjs.push(obj); return obj; }

  _nav(fn) { this.time.delayedCall(1, fn); }

  // Rounded Graphics fill+stroke with a separate interactive hit zone. Both tracked for cleanup.
  _roundedBg(cx, cy, w, h, opts = {}) {
    const {
      fill = 0x0d0d1c, fillHover = 0x181828,
      stroke = 0xffffff, strokeWidth = 1, strokeAlpha = 0.5,
      strokeHoverWidth = strokeWidth, strokeHoverAlpha = 0.9,
      interactive = true,
    } = opts;
    const gfx = this._track(this.add.graphics());
    const redraw = (hover) => {
      gfx.clear();
      gfx.fillStyle(hover ? fillHover : fill, 1);
      gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, RADIUS.soft);
      gfx.lineStyle(hover ? strokeHoverWidth : strokeWidth, stroke, hover ? strokeHoverAlpha : strokeAlpha);
      gfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, RADIUS.soft);
    };
    redraw(false);
    const hit = this._track(this.add.rectangle(cx, cy, w, h, 0x000000, 0));
    if (interactive) hit.setInteractive();
    return { gfx, hit, redraw };
  }

  _faceCell(ax, ay, isCulled, strokeColor, onTap) {
    const FACE = 41;
    if (isCulled) {
      this._roundedBg(ax, ay, FACE, FACE, { fill: 0x0a0a14, stroke: 0x333344, strokeAlpha: 0.2, interactive: false });
      return;
    }
    const { hit } = this._roundedBg(ax, ay, FACE, FACE, {
      fill: 0x141428, fillHover: 0x1a2e4a,
      stroke: strokeColor, strokeAlpha: 0.6, strokeHoverWidth: 2, strokeHoverAlpha: 0.9,
    });
    if (onTap) hit.on('pointerdown', onTap);
  }

  _backButton(label, onTap) {
    const cy = this._contentY + this._contentH - 20;
    const { hit } = this._roundedBg(W / 2, cy, W - 32, 40, {
      fill: 0x1a1a2e, fillHover: 0x2a2a44, stroke: 0x2a2a4a, strokeAlpha: 0.8, strokeHoverAlpha: 0.8,
    });
    hit.on('pointerdown', onTap);
    this._track(this.add.text(W / 2, cy, label, { fontSize: '15px', color: '#445566' }).setOrigin(0.5));
  }

  _showTab(idx) {
    this._nav(() => {
      this._clearContent();
      this._setActiveTab(idx);
      if (idx === 0) this._showBrandsTab();
      else if (idx === 1) this._showSec2Tab();
      else                this._showSpecialTab();
    });
  }

  // ─── TAB 1: BRANDS (10 runes in 2-col grid) ───────────────────────────────

  _showBrandsTab() {
    const BRAND_PRICE = this.shopType === 'witch' ? 10 : 15;
    const COLS = 2, CELL_H = 54, CELL_W = (W - 24) / 2, PAD = 6;
    const startY = this._contentY + 8;

    this._sec1Items.forEach((rune, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = 12 + col * (CELL_W + 4) + CELL_W / 2;
      const cy  = startY + row * (CELL_H + 4) + CELL_H / 2;
      const fc  = parseInt(rune.color.replace('#', ''), 16);

      const { hit } = this._roundedBg(cx, cy, CELL_W, CELL_H, { stroke: fc, strokeAlpha: 0.5, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.9 });

      this._track(this.add.text(cx - CELL_W / 2 + PAD, cy - 12, rune.label, {
        fontSize: '13px', color: rune.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      this._track(this.add.text(cx - CELL_W / 2 + PAD, cy + 6, rune.desc, {
        fontSize: '10px', color: '#556677', wordWrap: { width: CELL_W - 40 },
      }).setOrigin(0, 0.5));

      const priceTxt = this._track(this.add.text(cx + CELL_W / 2 - PAD, cy + 14, `${BRAND_PRICE}g`, {
        fontSize: '11px', color: '#f0c040',
      }).setOrigin(1, 0.5));

      hit.on('pointerdown', () => this._buyRune(rune, priceTxt, BRAND_PRICE));
    });
  }

  _buyRune(rune, priceTxt, price) {
    if (this.playerGold < price) { this._flashCantAfford(priceTxt); return; }
    this.playerGold -= price;
    this._refreshGold();
    // Go to die picker to place the rune
    this._pendingRune = rune;
    this._nav(() => { this._clearContent(); this._showRuneDiePicker(); });
  }

  _showRuneDiePicker() {
    const rune   = this._pendingRune;
    const startY = this._contentY + 8;

    this._track(this.add.text(W / 2, startY + 14, `Place "${rune.label}" on a die`, {
      fontSize: '14px', color: rune.color, fontStyle: 'bold',
    }).setOrigin(0.5));

    const sz = 64, gap = 10;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY   = startY + 60;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt   = DIE_TYPES[dc.type];
      const tcol = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x    = startX + dieIdx * (sz + gap);

      const { hit } = this._roundedBg(x, rowY, sz, sz, { stroke: tcol, strokeWidth: 2, strokeAlpha: 0.8, strokeHoverWidth: 2, strokeHoverAlpha: 0.8 });
      this._track(this.add.text(x, rowY - 10, dt ? dt.sym : '?', {
        fontSize: '15px', color: dt ? dt.color : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));
      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '12px', color: '#aaaaaa',
      }).setOrigin(0.5));

      hit.on('pointerdown', () => this._nav(() => this._showRuneFacePicker(dieIdx)));
    });

    this._backButton('← Back', () => this._showTab(0));
  }

  _showRuneFacePicker(dieIdx) {
    this._clearContent();
    const dc   = this.playerDiceConfig[dieIdx];
    const dt   = DIE_TYPES[dc.type];
    const rune = this._pendingRune;
    const startY = this._contentY + 8;

    this._track(this.add.text(W / 2, startY + 14, `Choose a face for "${rune.label}"`, {
      fontSize: '13px', color: rune.color, fontStyle: 'bold',
    }).setOrigin(0.5));

    const CELL = 46, FACE = 41;
    const cols = 4;
    const rows = Math.ceil(dc.sides / cols);
    const netW = cols * CELL;
    const originX = W / 2 - netW / 2;
    const originY = startY + 40;
    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;

    for (let fi = 0; fi < dc.sides; fi++) {
      const col = fi % cols, row = Math.floor(fi / cols);
      const rowCount = Math.min(cols, dc.sides - row * cols);
      const rowOx = (netW - (rowCount - 1) * CELL) / 2;
      const ax = originX + rowOx + col * CELL;
      const ay = originY + row * CELL + CELL / 2;
      const slotId    = fi + 1;
      const isCulled  = (dc.culledFaces ?? []).includes(slotId);
      const runeOnFace = !isCulled ? dc.runeMap?.[fi] : null;
      const dispValue  = Math.floor(fi / 2) + 1;

      this._faceCell(ax, ay, isCulled, runeOnFace ? 0xf0c040 : typeColor, () => {
        dc.runeMap = dc.runeMap ?? {};
        dc.runeMap[fi] = rune.id;
        this._pendingRune = null;
        this._showTab(0);
      });

      this._track(this.add.text(ax, ay, isCulled ? '✕' : String(dispValue), {
        fontSize: '17px', color: isCulled ? '#2a2a3a' : '#aaaaaa',
      }).setOrigin(0.5));

      if (runeOnFace) {
        const r = RUNES[runeOnFace];
        this._track(this.add.text(ax + 14, ay - 14, r?.sym ?? '◆', {
          fontSize: '9px', color: r?.color ?? '#f0c040',
        }).setOrigin(0.5));
      }
    }

    this._backButton('← Back', () => this._nav(() => { this._clearContent(); this._showRuneDiePicker(); }));
  }

  // ─── TAB 2: SECTION 2 (varies by shop) ────────────────────────────────────

  _showSec2Tab() {
    if (this.shopType === 'trenchcoat') this._showRelicsTab();
    else if (this.shopType === 'forge')  this._showMaterialsTab();
    else                                 this._showWitchTab();
  }

  _showRelicsTab() {
    const CARD_H = 110, GAP = 8;
    const startY = this._contentY + 8;

    this._sec2Items.forEach((relic, i) => {
      const cy = startY + i * (CARD_H + GAP) + CARD_H / 2;
      const fc = parseInt((relic.color ?? '#ffffff').replace('#', ''), 16);

      const { hit, redraw } = this._roundedBg(W / 2, cy, W - 24, CARD_H, { stroke: fc, strokeWidth: 1.5, strokeAlpha: 0.5, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.9 });

      this._track(this.add.rectangle(16, cy, 4, CARD_H - 16, fc, 0.7));
      this._track(this.add.text(30, cy - 26, relic.name, {
        fontSize: '15px', color: relic.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      this._track(this.add.text(30, cy - 6, relic.rarity.toUpperCase(), {
        fontSize: '10px', color: '#334455', letterSpacing: 1,
      }).setOrigin(0, 0.5));
      this._track(this.add.text(30, cy + 14, relic.description, {
        fontSize: '12px', color: '#8899aa', wordWrap: { width: W - 80 },
      }).setOrigin(0, 0.5));

      const priceTxt = this._track(this.add.text(W - 20, cy - 26, '30g', {
        fontSize: '13px', color: '#f0c040',
      }).setOrigin(1, 0.5));

      const already = this.activeRelics.some(r => r.id === relic.id);
      if (already) { priceTxt.setText('owned').setColor('#445566'); hit.disableInteractive(); return; }

      hit.on('pointerdown', () => {
        if (this.playerGold < 30) { this._flashCantAfford(priceTxt); return; }
        this.playerGold -= 30;
        this._refreshGold();
        if (relic.effect === 'MAX_HP_UP') {
          this.playerMaxHp += relic.value;
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + relic.value);
        }
        this.activeRelics.push(relic);
        hit.disableInteractive();
        priceTxt.setText('✓').setColor('#2ecc71');
        redraw(false);
      });
    });
  }

  _showMaterialsTab() {
    const CARD_H = 110, GAP = 8;
    const startY = this._contentY + 8;

    this._sec2Items.forEach((mat, i) => {
      const cy = startY + i * (CARD_H + GAP) + CARD_H / 2;
      const fc = parseInt(mat.color.replace('#', ''), 16);

      const { hit } = this._roundedBg(W / 2, cy, W - 24, CARD_H, { stroke: fc, strokeWidth: 1.5, strokeAlpha: 0.5, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.9 });

      this._track(this.add.rectangle(16, cy, 4, CARD_H - 16, fc, 0.7));
      this._track(this.add.text(30, cy - 26, mat.label, {
        fontSize: '15px', color: mat.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      this._track(this.add.text(30, cy - 6, mat.rarity.toUpperCase(), {
        fontSize: '10px', color: '#334455', letterSpacing: 1,
      }).setOrigin(0, 0.5));
      this._track(this.add.text(30, cy + 14, mat.desc, {
        fontSize: '12px', color: '#8899aa', wordWrap: { width: W - 80 },
      }).setOrigin(0, 0.5));

      const priceTxt = this._track(this.add.text(W - 20, cy - 26, '30g', {
        fontSize: '13px', color: '#f0c040',
      }).setOrigin(1, 0.5));

      hit.on('pointerdown', () => {
        if (this.playerGold < 30) { this._flashCantAfford(priceTxt); return; }
        this._pendingMaterial = mat;
        this.playerGold -= 30;
        this._refreshGold();
        hit.disableInteractive();
        priceTxt.setText('✓').setColor('#2ecc71');
        this._nav(() => { this._clearContent(); this._showMaterialDiePicker(); });
      });
    });
  }

  _showMaterialDiePicker() {
    const mat    = this._pendingMaterial;
    const startY = this._contentY + 8;

    this._track(this.add.text(W / 2, startY + 14, `Apply "${mat.label}" to a die`, {
      fontSize: '14px', color: mat.color, fontStyle: 'bold',
    }).setOrigin(0.5));

    const sz = 64, gap = 10;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY   = startY + 60;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt   = DIE_TYPES[dc.type];
      const tcol = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x    = startX + dieIdx * (sz + gap);

      const { hit } = this._roundedBg(x, rowY, sz, sz, { stroke: tcol, strokeWidth: 2, strokeAlpha: 0.8, strokeHoverWidth: 2, strokeHoverAlpha: 0.8 });
      this._track(this.add.text(x, rowY - 10, dt ? dt.sym : '?', {
        fontSize: '15px', color: dt ? dt.color : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));
      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '12px', color: '#aaaaaa',
      }).setOrigin(0.5));
      if (dc.material) {
        const m = MATERIALS[dc.material];
        this._track(this.add.text(x - sz / 2 + 2, rowY - sz / 2 + 6, m ? m.sym : '?', {
          fontSize: '9px', color: m ? m.color : '#aaaaaa',
        }).setOrigin(0, 0));
      }

      hit.on('pointerdown', () => {
        // Restore any uranium-culled faces from old material
        if (dc.material === 'uranium' && dc.uraniumCulledFaces?.length) {
          dc.culledFaces = (dc.culledFaces ?? []).filter(f => !dc.uraniumCulledFaces.includes(f));
          delete dc.uraniumCulledFaces;
        }
        dc.material = mat.id;
        if (mat.id === 'uranium') {
          const halfStart = Math.floor(dc.sides / 2) + 1;
          const newlyCulled = [];
          for (let f = halfStart; f <= dc.sides; f++) {
            if (!(dc.culledFaces ?? []).includes(f)) newlyCulled.push(f);
          }
          dc.culledFaces = [...(dc.culledFaces ?? []), ...newlyCulled];
          dc.uraniumCulledFaces = newlyCulled;
        }
        this._pendingMaterial = null;
        this._showTab(1);
      });
    });

    this._backButton('← Back', () => this._showTab(1));
  }

  // ─── WITCH TAB ────────────────────────────────────────────────────────────

  _showWitchTab() {
    const startY = this._contentY + 8;

    if (!this._witchUnlocked) {
      this._track(this.add.text(W / 2, startY + 40, 'Rune Management', {
        fontSize: '16px', color: '#cc88ff', fontStyle: 'bold',
      }).setOrigin(0.5));

      this._track(this.add.text(W / 2, startY + 72, 'Move, remove, or place runes\nacross all your dice freely.', {
        fontSize: '13px', color: '#8899aa', align: 'center',
      }).setOrigin(0.5));

      const cost = 50;
      const priceTxt = this._track(this.add.text(W / 2, startY + 116, `50g to unlock this visit`, {
        fontSize: '14px', color: '#f0c040',
      }).setOrigin(0.5));

      const { hit: unlockHit } = this._roundedBg(W / 2, startY + 148, W - 64, 44, { fill: 0x1a0e2e, fillHover: 0x2a1a4a, stroke: 0x9b59b6, strokeWidth: 1.5, strokeAlpha: 0.8, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.8 });
      unlockHit.on('pointerdown', () => {
        if (this.playerGold < cost) { this._flashCantAfford(priceTxt); return; }
        this.playerGold -= cost;
        this._refreshGold();
        this._witchUnlocked = true;
        this._showTab(1);
      });
      this._track(this.add.text(W / 2, startY + 148, 'Unlock  →', {
        fontSize: '15px', color: '#cc88ff',
      }).setOrigin(0.5));
      return;
    }

    // Unlocked — show dice for interaction
    this._track(this.add.text(W / 2, startY + 14, 'Tap a die face to manage its rune', {
      fontSize: '12px', color: '#8899aa',
    }).setOrigin(0.5));

    if (this.witchRunes.length > 0) {
      this._track(this.add.text(16, startY + 34, `Inventory: ${this.witchRunes.map(id => RUNES[id]?.sym ?? id).join('  ')}`, {
        fontSize: '11px', color: '#cc88ff',
      }).setOrigin(0, 0.5));
    }

    const sz = 56, gap = 8;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY = startY + 60;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt   = DIE_TYPES[dc.type];
      const tcol = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x    = startX + dieIdx * (sz + gap);

      const { hit } = this._roundedBg(x, rowY, sz, sz, { stroke: tcol, strokeWidth: 2, strokeAlpha: 0.8, strokeHoverWidth: 2, strokeHoverAlpha: 0.8 });
      this._track(this.add.text(x, rowY - 10, dt ? dt.sym : '?', {
        fontSize: '14px', color: dt ? dt.color : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));
      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));

      hit.on('pointerdown', () => this._nav(() => this._showWitchFacePicker(dieIdx)));
    });
  }

  _showWitchFacePicker(dieIdx) {
    this._clearContent();
    const dc      = this.playerDiceConfig[dieIdx];
    const dt      = DIE_TYPES[dc.type];
    const startY  = this._contentY + 8;
    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;

    this._track(this.add.text(W / 2, startY + 14, 'Tap a face — then choose action', {
      fontSize: '12px', color: '#8899aa',
    }).setOrigin(0.5));

    const CELL = 46, FACE = 41;
    const cols  = 4;
    const netW  = cols * CELL;
    const originX = W / 2 - netW / 2;
    const originY = startY + 36;

    for (let fi = 0; fi < dc.sides; fi++) {
      const col = fi % cols, row = Math.floor(fi / cols);
      const rowCount = Math.min(cols, dc.sides - row * cols);
      const rowOx = (netW - (rowCount - 1) * CELL) / 2;
      const ax = originX + rowOx + col * CELL;
      const ay = originY + row * CELL + CELL / 2;
      const slotId    = fi + 1;
      const isCulled  = (dc.culledFaces ?? []).includes(slotId);
      const runeOnFace = !isCulled ? (dc.runeMap?.[fi] ?? null) : null;
      const dispValue  = Math.floor(fi / 2) + 1;

      this._faceCell(ax, ay, isCulled, runeOnFace ? 0xf0c040 : typeColor, () => this._nav(() => this._showWitchFaceActions(dieIdx, fi, runeOnFace)));

      this._track(this.add.text(ax, ay, isCulled ? '✕' : String(dispValue), {
        fontSize: '17px', color: isCulled ? '#2a2a3a' : '#aaaaaa',
      }).setOrigin(0.5));

      if (runeOnFace) {
        const r = RUNES[runeOnFace];
        this._track(this.add.text(ax + 14, ay - 14, r?.sym ?? '◆', {
          fontSize: '9px', color: r?.color ?? '#f0c040',
        }).setOrigin(0.5));
      }
    }

    this._backButton('← Back', () => this._showTab(1));
  }

  _showWitchFaceActions(dieIdx, faceIdx, currentRuneId) {
    this._clearContent();
    const dc      = this.playerDiceConfig[dieIdx];
    const startY  = this._contentY + 8;
    let y = startY + 20;

    this._track(this.add.text(W / 2, y, 'What would you like to do?', {
      fontSize: '14px', color: '#cc88ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    y += 36;

    const addBtn = (label, color, action) => {
      const { hit } = this._roundedBg(W / 2, y + 20, W - 48, 44, { stroke: parseInt(color.replace('#', ''), 16), strokeWidth: 1.5, strokeAlpha: 0.7, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.7 });
      hit.on('pointerdown', action);
      this._track(this.add.text(W / 2, y + 20, label, { fontSize: '14px', color }).setOrigin(0.5));
      y += 56;
    };

    if (currentRuneId) {
      const r = RUNES[currentRuneId];
      addBtn(`Remove "${r?.label ?? currentRuneId}" to inventory`, '#cc88ff', () => {
        dc.runeMap = dc.runeMap ?? {};
        delete dc.runeMap[faceIdx];
        this.witchRunes.push(currentRuneId);
        this._nav(() => this._showWitchFacePicker(dieIdx));
      });

      // Move to another face on any die
      addBtn('Move to another face', '#f0c040', () => {
        this._witchMovingRune   = currentRuneId;
        this._witchMoveFromDie  = dieIdx;
        this._witchMoveFromFace = faceIdx;
        dc.runeMap = dc.runeMap ?? {};
        delete dc.runeMap[faceIdx];
        this._nav(() => this._showWitchMovePicker());
      });
    }

    if (this.witchRunes.length > 0) {
      this._track(this.add.text(W / 2, y + 4, 'Place from inventory:', {
        fontSize: '12px', color: '#8899aa',
      }).setOrigin(0.5));
      y += 24;

      this.witchRunes.forEach((runeId, invIdx) => {
        const r = RUNES[runeId];
        addBtn(`Place "${r?.label ?? runeId}"`, r?.color ?? '#cc88ff', () => {
          dc.runeMap = dc.runeMap ?? {};
          if (currentRuneId) this.witchRunes.push(currentRuneId); // swap: old rune back to inv
          dc.runeMap[faceIdx] = runeId;
          this.witchRunes.splice(invIdx, 1);
          this._nav(() => this._showWitchFacePicker(dieIdx));
        });
      });
    }

    if (!currentRuneId && this.witchRunes.length === 0) {
      this._track(this.add.text(W / 2, y + 20, 'No rune here and inventory is empty.', {
        fontSize: '13px', color: '#445566', align: 'center', wordWrap: { width: W - 48 },
      }).setOrigin(0.5));
      y += 40;
    }

    this._backButton('← Back', () => this._nav(() => this._showWitchFacePicker(dieIdx)));
  }

  _showWitchMovePicker() {
    this._clearContent();
    const startY = this._contentY + 8;
    const rune   = RUNES[this._witchMovingRune];

    this._track(this.add.text(W / 2, startY + 14, `Moving "${rune?.label ?? this._witchMovingRune}" — pick destination`, {
      fontSize: '13px', color: rune?.color ?? '#cc88ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    const sz = 56, gap = 8;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY = startY + 60;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt   = DIE_TYPES[dc.type];
      const tcol = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x    = startX + dieIdx * (sz + gap);

      const { hit } = this._roundedBg(x, rowY, sz, sz, { stroke: tcol, strokeWidth: 2, strokeAlpha: 0.8, strokeHoverWidth: 2, strokeHoverAlpha: 0.8 });
      this._track(this.add.text(x, rowY - 10, dt ? dt.sym : '?', {
        fontSize: '14px', color: dt ? dt.color : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));
      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));

      hit.on('pointerdown', () => this._nav(() => this._showWitchMoveTargetFace(dieIdx)));
    });

    this._backButton('← Cancel', () => {
      // Restore the rune to its original face
      const dc = this.playerDiceConfig[this._witchMoveFromDie];
      dc.runeMap = dc.runeMap ?? {};
      dc.runeMap[this._witchMoveFromFace] = this._witchMovingRune;
      this._witchMovingRune = null;
      this._nav(() => this._showWitchFacePicker(this._witchMoveFromDie));
    });
  }

  _showWitchMoveTargetFace(dieIdx) {
    this._clearContent();
    const dc      = this.playerDiceConfig[dieIdx];
    const dt      = DIE_TYPES[dc.type];
    const rune    = RUNES[this._witchMovingRune];
    const startY  = this._contentY + 8;
    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;

    this._track(this.add.text(W / 2, startY + 14, 'Choose destination face', {
      fontSize: '12px', color: '#8899aa',
    }).setOrigin(0.5));

    const CELL = 46, FACE = 41;
    const cols  = 4;
    const netW  = cols * CELL;
    const originX = W / 2 - netW / 2;
    const originY = startY + 36;

    for (let fi = 0; fi < dc.sides; fi++) {
      const col = fi % cols, row = Math.floor(fi / cols);
      const rowCount = Math.min(cols, dc.sides - row * cols);
      const rowOx = (netW - (rowCount - 1) * CELL) / 2;
      const ax = originX + rowOx + col * CELL;
      const ay = originY + row * CELL + CELL / 2;
      const slotId    = fi + 1;
      const isCulled  = (dc.culledFaces ?? []).includes(slotId);
      const runeOnFace = !isCulled ? (dc.runeMap?.[fi] ?? null) : null;
      const dispValue  = Math.floor(fi / 2) + 1;

      this._faceCell(ax, ay, isCulled, runeOnFace ? 0xf0c040 : typeColor, () => {
        dc.runeMap = dc.runeMap ?? {};
        if (runeOnFace) this.witchRunes.push(runeOnFace); // displaced rune → inventory
        dc.runeMap[fi] = this._witchMovingRune;
        this._witchMovingRune = null;
        this._showTab(1);
      });

      this._track(this.add.text(ax, ay, isCulled ? '✕' : String(dispValue), {
        fontSize: '17px', color: isCulled ? '#2a2a3a' : '#aaaaaa',
      }).setOrigin(0.5));

      if (runeOnFace) {
        const r = RUNES[runeOnFace];
        this._track(this.add.text(ax + 14, ay - 14, r?.sym ?? '◆', {
          fontSize: '9px', color: r?.color ?? '#f0c040',
        }).setOrigin(0.5));
      }
    }

    this._backButton('← Back', () => this._nav(() => this._showWitchMovePicker()));
  }

  // ─── TAB 3: SPECIAL (cull a face) ─────────────────────────────────────────

  _showSpecialTab() {
    const cost   = 10 + this.cullCount * 5;
    const startY = this._contentY + 8;

    this._track(this.add.text(W / 2, startY + 40, 'Cull a Face', {
      fontSize: '18px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5));

    this._track(this.add.text(W / 2, startY + 70, 'Permanently remove all faces showing\na chosen value from one of your dice.', {
      fontSize: '13px', color: '#8899aa', align: 'center',
    }).setOrigin(0.5));

    const priceTxt = this._track(this.add.text(W / 2, startY + 110, `${cost}g`, {
      fontSize: '16px', color: '#f0c040',
    }).setOrigin(0.5));

    if (this.cullCount > 0) {
      this._track(this.add.text(W / 2, startY + 132, `(you've culled ${this.cullCount} time${this.cullCount > 1 ? 's' : ''} this run)`, {
        fontSize: '11px', color: '#445566',
      }).setOrigin(0.5));
    }

    const { hit: buyHit } = this._roundedBg(W / 2, startY + 168, W - 64, 44, { fill: 0x2a0e0e, fillHover: 0x4a1a0e, stroke: 0xff6644, strokeWidth: 1.5, strokeAlpha: 0.7, strokeHoverWidth: 1.5, strokeHoverAlpha: 0.7 });
    buyHit.on('pointerdown', () => {
      if (this.playerGold < cost) { this._flashCantAfford(priceTxt); return; }
      this.playerGold -= cost;
      this.cullCount++;
      this._refreshGold();
      buyHit.disableInteractive();
      priceTxt.setText('✓').setColor('#2ecc71');
      this._nav(() => { this._clearContent(); this._showCullDiePicker(); });
    });
    this._track(this.add.text(W / 2, startY + 168, 'Purchase  →', {
      fontSize: '15px', color: '#ff6644',
    }).setOrigin(0.5));
  }

  _showCullDiePicker() {
    const startY = this._contentY + 8;

    this._track(this.add.text(W / 2, startY + 14, 'Choose a die to cull', {
      fontSize: '14px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5));

    const sz = 64, gap = 10;
    const total = this.playerDiceConfig.length;
    const totW  = total * sz + (total - 1) * gap;
    const startX = (W - totW) / 2 + sz / 2;
    const rowY = startY + 60;

    this.playerDiceConfig.forEach((dc, dieIdx) => {
      const dt   = DIE_TYPES[dc.type];
      const tcol = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xffffff;
      const x    = startX + dieIdx * (sz + gap);

      const { hit } = this._roundedBg(x, rowY, sz, sz, { stroke: tcol, strokeWidth: 2, strokeAlpha: 0.8, strokeHoverWidth: 2, strokeHoverAlpha: 0.8 });
      this._track(this.add.text(x, rowY - 10, dt ? dt.sym : '?', {
        fontSize: '15px', color: dt ? dt.color : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));
      this._track(this.add.text(x, rowY + 10, `d${dc.sides}`, {
        fontSize: '12px', color: '#aaaaaa',
      }).setOrigin(0.5));

      hit.on('pointerdown', () => this._nav(() => this._showCullFacePicker(dieIdx)));
    });

    this._backButton('← Back', () => this._showTab(2));
  }

  _showCullFacePicker(dieIdx) {
    this._clearContent();
    const dc  = this.playerDiceConfig[dieIdx];
    const dt  = DIE_TYPES[dc.type];
    const startY  = this._contentY + 8;
    const typeColor = dt ? parseInt(dt.color.replace('#', ''), 16) : 0xd4a820;

    this._track(this.add.text(W / 2, startY + 14, 'Choose a face value to cull', {
      fontSize: '13px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5));

    const activeSlots = Array.from({ length: dc.sides }, (_, i) => i + 1)
      .filter(s => !(dc.culledFaces ?? []).includes(s));
    const uniqueValues = new Set(activeSlots.map(s => Math.floor((s - 1) / 2) + 1)).size;

    const CELL = 46, FACE = 41;
    const cols  = 4;
    const netW  = cols * CELL;
    const originX = W / 2 - netW / 2;
    const originY = startY + 36;

    for (let fi = 0; fi < dc.sides; fi++) {
      const col = fi % cols, row = Math.floor(fi / cols);
      const rowCount = Math.min(cols, dc.sides - row * cols);
      const rowOx = (netW - (rowCount - 1) * CELL) / 2;
      const ax = originX + rowOx + col * CELL;
      const ay = originY + row * CELL + CELL / 2;
      const slotId    = fi + 1;
      const isCulled  = (dc.culledFaces ?? []).includes(slotId);
      const dispValue  = Math.floor(fi / 2) + 1;
      const canCull   = !isCulled && uniqueValues > 1;

      const { hit } = this._roundedBg(ax, ay, FACE, FACE, {
        fill: isCulled ? 0x0a0a14 : 0x141428, fillHover: 0x2a1010,
        stroke: isCulled ? 0x333344 : typeColor, strokeAlpha: isCulled ? 0.2 : 0.6,
        strokeHoverWidth: 2, strokeHoverAlpha: 0.9,
        interactive: canCull,
      });
      this._track(this.add.text(ax, ay, isCulled ? '✕' : String(dispValue), {
        fontSize: '17px', color: isCulled ? '#2a2a3a' : '#aaaaaa',
      }).setOrigin(0.5));

      if (canCull) {
        hit.on('pointerdown', () => {
          const targetVal = Math.floor((slotId - 1) / 2) + 1;
          dc.culledFaces = dc.culledFaces ?? [];
          for (let s = 1; s <= dc.sides; s++) {
            if (Math.floor((s - 1) / 2) + 1 === targetVal && !dc.culledFaces.includes(s)) {
              dc.culledFaces.push(s);
              delete dc.runeMap?.[s - 1];
            }
          }
          this._showTab(2);
        });
      }
    }

    this._backButton('← Back', () => this._nav(() => this._showCullDiePicker()));
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────────

  _buildFooter() {
    const y = H - this._footerH / 2;
    this.add.rectangle(W / 2, y, W, this._footerH, 0x0a0a16);
    this.add.rectangle(W / 2, H - this._footerH, W, 2, 0x1a1a3a, 0.5);

    const w = W - 32, h = 40;
    const gfx = this.add.graphics();
    const redraw = (hover) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x2a2a44 : 0x1a1a2e, 1);
      gfx.fillRoundedRect(W / 2 - w / 2, y - h / 2, w, h, RADIUS.soft);
      gfx.lineStyle(1, 0x2a2a4a, 0.8);
      gfx.strokeRoundedRect(W / 2 - w / 2, y - h / 2, w, h, RADIUS.soft);
    };
    redraw(false);
    const hit = this.add.rectangle(W / 2, y, w, h, 0x000000, 0).setInteractive();
    hit.on('pointerdown', () => this._leaveShop());
    hit.on('pointerover', () => redraw(true));
    hit.on('pointerout',  () => redraw(false));
    this.add.text(W / 2, y, 'Leave Shop  →', {
      fontSize: '16px', color: '#445566',
    }).setOrigin(0.5);
  }

  _leaveShop() {
    this.time.delayedCall(1, () => this.scene.start('BattleScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      playerMaxHp:      this.playerMaxHp,
      battleIndex:      this.battleIndex,
      activeRelics:     this.activeRelics,
      playerGold:       this.playerGold,
      cullCount:        this.cullCount,
      witchRunes:       this.witchRunes,
    }));
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  _flashCantAfford(txt) {
    const orig = txt.style.color;
    txt.setColor('#e74c3c');
    this.time.delayedCall(500, () => txt.setColor(orig));
  }
}
