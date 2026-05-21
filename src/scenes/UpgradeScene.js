import Phaser from 'phaser';
import { FACES, PLAYER_TOKENS } from '../data/faces.js';
import { W, H, PLAYER_MAX_HP } from '../constants.js';

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  init(data) {
    this.playerDiceConfig = JSON.parse(JSON.stringify(data.playerDiceConfig));
    this.playerHp         = data.playerHp;
    this.battleIndex      = data.battleIndex;
    this.selDie           = null;   // die index
    this.selFace          = null;   // face index within die
    this.selToken         = null;   // replacement token id
    this.selDieBg         = null;
    this.selFaceBg        = null;
    this.selTokenBg       = null;
  }

  create() {
    this._buildBackground();
    this._buildHeader();
    this._buildDicePanel();
    this._buildTokenPanel();
    this._buildButtons();
    this._buildStatusLine();
  }

  // ─── LAYOUT ───────────────────────────────────────────────────────────────

  _buildBackground() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);
  }

  _buildHeader() {
    this.add.text(W / 2, 28, 'UPGRADE', {
      fontSize: '22px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4
    }).setOrigin(0.5, 0.5);

    const hpPct = Math.max(0, this.playerHp) / PLAYER_MAX_HP;
    this.add.text(W / 2, 58, `HP: ${Math.max(0, this.playerHp)} / ${PLAYER_MAX_HP}`, {
      fontSize: '17px', color: '#2ecc71'
    }).setOrigin(0.5, 0.5);

    const hpG = this.add.graphics();
    hpG.fillStyle(0x27ae60);
    hpG.fillRect(W / 2 - 80, 68, 160 * hpPct, 5);
    hpG.lineStyle(1, 0x1a6a3a);
    hpG.strokeRect(W / 2 - 80, 68, 160, 5);

    this.add.text(W / 2, 86, 'Tap a face, then pick a token below.', {
      fontSize: '17px', color: '#555577', wordWrap: { width: W - 32 }
    }).setOrigin(0.5, 0);
  }

  _buildDicePanel() {
    this.faceObjs = [];

    const CELL  = 38, FACE = 34;
    const NET   = [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ];

    const netW   = 3 * CELL;
    const netH   = 4 * CELL;
    const n      = this.playerDiceConfig.length;
    const gap    = (W - n * netW) / (n + 1);
    const startY = 130;

    this.playerDiceConfig.forEach((dc, di) => {
      const gx = gap + di * (netW + gap);
      const gy = startY;

      this.add.text(gx + netW / 2, gy - 14, `Die ${di + 1}`, {
        fontSize: '17px', color: '#888899'
      }).setOrigin(0.5, 0.5);

      dc.faces.forEach((faceId, fi) => {
        const pos  = NET[fi] ?? { col: fi % 3, row: Math.floor(fi / 3) };
        const face = FACES[faceId];
        const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
        const fx   = gx + pos.col * CELL + CELL / 2;
        const fy   = gy + pos.row * CELL + CELL / 2;

        const bg = this.add.rectangle(fx, fy, FACE, FACE, 0x191928);
        bg.setStrokeStyle(1.5, fc, 0.7);
        bg.setInteractive();

        const sym = this.add.text(fx, fy, face ? face.sym : '--', {
          fontSize: '17px', color: face ? face.color : '#555555', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0.5);

        bg.on('pointerdown', () => this._pickFace(di, fi));
        bg.on('pointerover', () => { if (!(this.selDie === di && this.selFace === fi)) bg.setFillStyle(0x252540); });
        bg.on('pointerout',  () => { if (!(this.selDie === di && this.selFace === fi)) bg.setFillStyle(0x191928); });

        this.faceObjs.push({ bg, sym, di, fi, faceId });
      });
    });

    this._dicePanelBottom = startY + netH;
  }

  _buildTokenPanel() {
    const panelTop = this._dicePanelBottom + 20;

    this.add.text(W / 2, panelTop, 'REPLACEMENT TOKENS', {
      fontSize: '17px', color: '#333355', letterSpacing: 2
    }).setOrigin(0.5, 0);

    const tokens = PLAYER_TOKENS;
    const cols   = 5;
    const sp     = 66;
    const ox     = W / 2 - ((Math.min(tokens.length, cols) - 1) * sp) / 2;

    this.tokenObjs = [];

    tokens.forEach((tokenId, i) => {
      const face = FACES[tokenId];
      const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const tx   = ox + col * sp;
      const ty   = panelTop + 28 + row * 70;

      const bg = this.add.rectangle(tx, ty, 56, 58, 0x191928);
      bg.setStrokeStyle(1, fc, 0.5);
      bg.setInteractive();

      const sym = this.add.text(tx, ty - 12, face ? face.sym : '--', {
        fontSize: '17px', color: face ? face.color : '#555555', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0.5);

      const nm = this.add.text(tx, ty + 11, face ? face.label.substring(0, 7) : '', {
        fontSize: '17px', color: '#444466'
      }).setOrigin(0.5, 0.5);

      bg.on('pointerdown', () => this._pickToken(tokenId, i));
      bg.on('pointerover', () => { if (this.selToken !== tokenId) bg.setFillStyle(0x252540); });
      bg.on('pointerout',  () => { if (this.selToken !== tokenId) bg.setFillStyle(0x191928); });

      this.tokenObjs.push({ bg, sym, nm, tokenId });
    });

  }

  _buildButtons() {
    const y = H - 42;

    // Apply (only functional when selection complete)
    this.applyBtn = this.add.rectangle(W / 2 - 68, y, 130, 44, 0x1a3a1a).setInteractive();
    this.applyBtn.on('pointerdown', () => this._apply());
    this.applyBtn.on('pointerover',  () => { if (this._canApply()) this.applyBtn.setFillStyle(0x27ae60); });
    this.applyBtn.on('pointerout',   () => this.applyBtn.setFillStyle(this._canApply() ? 0x1e7a40 : 0x1a3a1a));
    this.applyTxt = this.add.text(W / 2 - 68, y, 'Apply', {
      fontSize: '17px', color: '#448844'
    }).setOrigin(0.5, 0.5);

    // Skip
    const skipBtn = this.add.rectangle(W / 2 + 88, y, 120, 44, 0x2a2a3a).setInteractive();
    skipBtn.on('pointerdown', () => this._continue(false));
    skipBtn.on('pointerover',  () => skipBtn.setFillStyle(0x44445a));
    skipBtn.on('pointerout',   () => skipBtn.setFillStyle(0x2a2a3a));
    this.add.text(W / 2 + 88, y, 'Skip', {
      fontSize: '17px', color: '#8888aa'
    }).setOrigin(0.5, 0.5);
  }

  _buildStatusLine() {
    this.statusTxt = this.add.text(W / 2, H - 82, 'Select a die face to begin.', {
      fontSize: '17px', color: '#556677', wordWrap: { width: W - 24 }
    }).setOrigin(0.5, 0.5);
  }

  // ─── SELECTION ────────────────────────────────────────────────────────────

  _pickFace(di, fi) {
    if (this.selFaceBg) {
      this.selFaceBg.setFillStyle(0x191928);
      this.selFaceBg.setStrokeStyle(1.5, this._selFacePrevColor, 0.7);
    }
    this.selDie  = di;
    this.selFace = fi;

    const obj  = this.faceObjs.find(o => o.di === di && o.fi === fi);
    const face = FACES[this.playerDiceConfig[di].faces[fi]];
    const fc   = face ? parseInt(face.color.replace('#', ''), 16) : 0x555555;
    this.selFaceBg         = obj.bg;
    this._selFacePrevColor = fc;
    obj.bg.setFillStyle(0x1a2e4a);
    obj.bg.setStrokeStyle(2, 0x4499ff);

    this._refreshStatus();
  }

  _pickToken(tokenId, idx) {
    if (this.selTokenBg) {
      const prev = FACES[this.selToken];
      const pfc  = prev ? parseInt(prev.color.replace('#', ''), 16) : 0x555555;
      this.selTokenBg.setFillStyle(0x191928).setStrokeStyle(1, pfc, 0.5);
    }
    this.selToken   = tokenId;
    this.selTokenBg = this.tokenObjs[idx].bg;
    this.selTokenBg.setFillStyle(0x1a2e4a).setStrokeStyle(2, 0x4499ff);

    if (this._canApply()) {
      this.applyBtn.setFillStyle(0x1e7a40);
      this.applyTxt.setColor('#aaffaa');
    }
    this._refreshStatus();
  }

  _canApply() {
    return this.selDie !== null && this.selFace !== null && this.selToken !== null;
  }

  _refreshStatus() {
    if (!this._canApply()) {
      const face = this.selDie !== null && this.selFace !== null
        ? FACES[this.playerDiceConfig[this.selDie].faces[this.selFace]]
        : null;
      this.statusTxt.setText(face
        ? `Replacing: ${face.label} — now pick a token below`
        : 'Select a die face to begin.');
    } else {
      const newFace = FACES[this.selToken];
      this.statusTxt.setText(`Ready: replace with ${newFace?.label || '?'}  →  press Apply`);
    }
  }

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  _apply() {
    if (!this._canApply()) return;
    this.playerDiceConfig[this.selDie].faces[this.selFace] = this.selToken;
    this._continue(true);
  }

  _continue(applied) {
    this.scene.start('BattleScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:         this.playerHp,
      rerollTokens:     1,
      battleIndex:      this.battleIndex,
    });
  }
}
