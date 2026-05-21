import Phaser from 'phaser';
import { FACES, ENEMIES, BATTLE_SEQUENCE, STARTER_DICE } from '../data/faces.js';
import {
  W, H, SURFACE_TOP, SURFACE_BOTTOM, DIE_SIZE, WALL_T, DIE_STRIP_Y,
  DIE_FRICTION, DIE_FRICTION_AIR, DIE_BOUNCE, SETTLE_VEL,
  MAX_THROW_SPEED, PLAYER_MAX_HP
} from '../constants.js';

const PHASE = { PREP: 0, ENEMY_ROLL: 1, PLAYER_ROLL: 2, COMMIT: 3 };
const THROW_ZONE_BOTTOM  = SURFACE_BOTTOM - 8;
const THROW_ORIGIN_X     = W / 2;
const THROW_ORIGIN_Y     = 605;
const ENEMY_BUMPER_R     = 26;
const PLAYER_BUMPER_R    = 22;
const BUMPER_KICK_SPEED  = 9;


export default class BattleScene extends Phaser.Scene {
  constructor() { super({ key: 'BattleScene' }); }

  init(data) {
    this.playerDiceConfig = data.playerDiceConfig
      ? JSON.parse(JSON.stringify(data.playerDiceConfig))
      : JSON.parse(JSON.stringify(STARTER_DICE));
    this.battleIndex  = data.battleIndex  ?? 0;
    this.playerHp     = data.playerHp     ?? PLAYER_MAX_HP;
    this.rerollTokens = data.rerollTokens ?? 1;
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

    const key = BATTLE_SEQUENCE[this.battleIndex % BATTLE_SEQUENCE.length];
    this.enemyDef = ENEMIES[key];
    this.enemyHp  = this.enemyDef.hp;

    this._makeTextures();
    this._buildBackground();
    this._buildWalls();
    this._buildHeaderStrip();
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
    const opt = { isStatic: true, label: 'wall', friction: 0, frictionStatic: 0, restitution: 0.85 };
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
    this.rtTxt        = this.add.text(W - 10, mid - 16, '', { fontSize: '17px', color: '#e67e22' }).setOrigin(1, 0.5);

    this._refreshStatusUI();
  }

  // ─── ENEMY CHARACTER (bumper) ─────────────────────────────────────────────

  _buildEnemyCharacter() {
    const col = parseInt(this.enemyDef.color.replace('#', ''), 16);
    const { x, y } = this.enemyPos;

    this.enemyCharContainer = this.add.container(x, y).setDepth(15);

    const glow = this.add.graphics();
    glow.lineStyle(4, col, 0.3);
    glow.strokeCircle(0, 0, ENEMY_BUMPER_R + 10);
    this.enemyCharContainer.add(glow);

    const body = this.add.graphics();
    body.fillStyle(col, 0.88);
    body.fillCircle(0, 0, ENEMY_BUMPER_R);
    body.lineStyle(2, 0xffffff, 0.3);
    body.strokeCircle(0, 0, ENEMY_BUMPER_R);
    this.enemyCharContainer.add(body);

    const nameTxt = this.add.text(0, -ENEMY_BUMPER_R - 16, this.enemyDef.name.toUpperCase(), {
      fontSize: '17px', color: this.enemyDef.color, fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5, 0.5);
    this.enemyCharContainer.add(nameTxt);

    this._enemyHpTxt = this.add.text(0, ENEMY_BUMPER_R + 10, '', {
      fontSize: '17px', color: '#dd9999'
    }).setOrigin(0.5, 0);
    this.enemyCharContainer.add(this._enemyHpTxt);

    this._enemyHpBarGfx = this.add.graphics();
    this.enemyCharContainer.add(this._enemyHpBarGfx);

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
    const pct   = Math.max(0, this.enemyHp) / maxHp;
    const bw    = 60;
    this._enemyHpTxt?.setText(`${Math.max(0, this.enemyHp)} / ${maxHp}`);
    this._enemyHpBarGfx?.clear();
    this._enemyHpBarGfx?.fillStyle(0xc0392b);
    this._enemyHpBarGfx?.fillRect(-bw / 2, ENEMY_BUMPER_R + 22, bw * pct, 5);
    this._enemyHpBarGfx?.lineStyle(1, 0x7b1c1c);
    this._enemyHpBarGfx?.strokeRect(-bw / 2, ENEMY_BUMPER_R + 22, bw, 5);
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
    const g = this.add.graphics().setDepth(19);
    this.playerGfx = g;

    g.fillStyle(0xd4a820, 0.18);
    g.fillCircle(THROW_ORIGIN_X, THROW_ORIGIN_Y, 22);
    g.lineStyle(2, 0xd4a820, 0.7);
    g.strokeCircle(THROW_ORIGIN_X, THROW_ORIGIN_Y, 22);
    g.lineStyle(1, 0xd4a820, 0.25);
    g.strokeCircle(THROW_ORIGIN_X, THROW_ORIGIN_Y, 32);

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
      const face = FACES[dc.faces[0]];
      const lbl  = this.add.text(x, y, face ? face.sym : '--', {
        fontSize: '17px', color: face ? face.color : '#777777', fontStyle: 'bold',
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
    this.rtTxt?.setText(`↺ ${this.rerollTokens}`);
    this.playerHpTxt?.setText(`${Math.max(0, this.playerHp)}/${PLAYER_MAX_HP}`);
    if (this.playerBlockTxt) {
      if (this.block > 0) {
        this.playerBlockTxt.setText(`BLK ${this.block}`).setVisible(true);
      } else {
        this.playerBlockTxt.setVisible(false);
      }
    }
  }

  // ─── COLLISIONS ───────────────────────────────────────────────────────────

  _setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (this.phase !== PHASE.PLAYER_ROLL && this.phase !== PHASE.ENEMY_ROLL) return;
      const rerolled = new Set();

      event.pairs.forEach(({ bodyA, bodyB }) => {
        const dA = bodyA.gameObject?.getData('dieRef');
        const dB = bodyB.gameObject?.getData('dieRef');

        // Die-die: reroll the slower one
        if (dA && dB) {
          const sA = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
          const sB = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
          const struck = sA < sB ? dA : dB;
          if (!rerolled.has(struck)) { rerolled.add(struck); this._rerollDie(struck); }
          return;
        }

        // Die-bumper: pinball kick + reroll
        const dieRef  = dA || dB;
        const dieBody = dA ? bodyA : bodyB;
        const other   = dA ? bodyB : bodyA;

        if (dieRef && other.label === 'enemyBumper') {
          this._applyBumperKick(dieBody, this.enemyPos.x, this.enemyPos.y);
          if (!rerolled.has(dieRef)) { rerolled.add(dieRef); this._rerollDie(dieRef); }
          this._flashEnemyBumper();
          if (dieRef.isPlayer) {
            this.enemyHp = Math.max(0, this.enemyHp - 1);
            this._refreshEnemyCharacter();
            this._flashEnemyDamage(1);
            if (this.enemyHp <= 0) this._triggerVictory();
          }
        }

        if (dieRef && other.label === 'playerBumper') {
          this._applyBumperKick(dieBody, THROW_ORIGIN_X, THROW_ORIGIN_Y);
          if (!rerolled.has(dieRef)) { rerolled.add(dieRef); this._rerollDie(dieRef); }
          this._flashPlayerBumper();
          if (dieRef.isPlayer) {
            this.block += 1;
            this._refreshStatusUI();
            this._floatText(THROW_ORIGIN_X + 40, THROW_ORIGIN_Y, '+1 BLK', '#3498db');
          }
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
        this._buildInspectorPanel(dc.faces, -1, 0xd4a820, null);
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
    this._autoCommitDone = false;

    this._resetTray();
    this._hideCommitOverlay();
    this._refreshStatusUI();
    this._setPhase('PREPARING...');
    this._showMsg('');

    this._moveEnemyToNewPosition(() => {
      this.time.delayedCall(400, () => this._enemyRollPhase());
    });
  }

  _enemyRollPhase() {
    this.phase = PHASE.ENEMY_ROLL;
    this._setPhase('ENEMY ROLLING');

    let thrown = 0;
    const defs = this.enemyDef.dice;
    const throwNext = () => {
      if (thrown >= defs.length) { this._waitSettle(() => this._playerRollPhase()); return; }
      const cfg   = defs[thrown];
      const fIdx  = Phaser.Math.Between(0, cfg.faces.length - 1);
      // Spread downward from enemy position
      const spread = Phaser.Math.FloatBetween(-0.6, 0.6);
      const spd    = Phaser.Math.FloatBetween(8, 13);
      const vx     = Math.sin(spread) * spd;
      const vy     = Math.cos(spread) * spd;
      const eDie = this._spawnDie({ ...cfg, currentFaceIdx: fIdx },
        this.enemyPos.x, this.enemyPos.y, vx, vy, false, -1);
      eDie._finalFaceIdx = fIdx;
      eDie._rolling      = true;
      eDie._lastCycleMs  = 0;
      eDie.img.body.collisionFilter.mask = 0xFFFFFFFF & ~0x0004;
      this.time.delayedCall(400, () => {
        if (eDie.img?.body) eDie.img.body.collisionFilter.mask = 0xFFFFFFFF;
      });
      thrown++;
      this.time.delayedCall(380, throwNext);
    };
    throwNext();
  }

  _playerRollPhase() {
    this.phase = PHASE.PLAYER_ROLL;
    this._setPhase('YOUR TURN');
    this._showMsg('Drag on the surface to throw your next die');
  }

  _onCommit() {
    if (this.phase !== PHASE.PLAYER_ROLL) return;
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

    this.time.delayedCall(600, () => {
      let eDmg = 0;

      this.enemyDice.forEach(d => {
        const f = FACES[d.data.faces[d.data.currentFaceIdx]];
        if (!f?.effect) return;
        switch (f.effect) {
          case 'enemy_damage': eDmg += (f.value || 1); break;
          case 'enemy_buff':   eDmg += (f.value || 1); break;
        }
      });

      const takenDmg = Math.max(0, eDmg - this.block);
      this.playerHp  = Math.min(PLAYER_MAX_HP, this.playerHp - takenDmg);

      if (takenDmg > 0) this._flashDamage(takenDmg);

      this._showMsg(takenDmg > 0 ? `Took ${takenDmg} dmg!` : 'No damage taken.');
      this._refreshStatusUI();

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

    const face   = FACES[data.faces[data.currentFaceIdx]];
    const lbl    = this.add.text(x, y - 8, face ? face.sym : '--', {
      fontSize: '17px', color: face ? face.color : '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(10);
    const valLbl = this.add.text(x, y + 10, face?.value !== undefined ? String(face.value) : '', {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(10);

    const dieRef = { data, img, lbl, valLbl, isPlayer, configIdx, _rolling: false, _finalFaceIdx: null, _lastCycleMs: 0, _shieldActive: false, _shieldPulseTimer: null };
    img.setData('dieRef', dieRef);
    img.setInteractive();
    img.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      const pickupRef = (isPlayer && this.rerollTokens > 0 && this.phase === PHASE.PLAYER_ROLL)
        ? dieRef : null;
      this._showInspector(dieRef, pickupRef);
    });

    this.allDice.push(dieRef);
    if (isPlayer) this.playerDice.push(dieRef); else this.enemyDice.push(dieRef);
    return dieRef;
  }

  _throwNextCard(x, y, vx, vy) {
    if (this.throwCount >= this.trayCards.length) return;

    const card      = this.trayCards[this.throwCount];
    const configIdx = card.configIdx;
    const dc        = this.playerDiceConfig[configIdx];
    const fIdx      = Phaser.Math.Between(0, dc.faces.length - 1);
    const data      = { ...dc, currentFaceIdx: fIdx };

    const die  = this._spawnDie(data, x, y, vx, vy, true, configIdx);
    die._finalFaceIdx = fIdx;
    die._rolling      = true;
    die._lastCycleMs  = 0;

    // Ignore the player bumper until the die has cleared the origin
    die.img.body.collisionFilter.mask = 0xFFFFFFFF & ~0x0002;
    this.time.delayedCall(400, () => {
      if (die.img?.body) die.img.body.collisionFilter.mask = 0xFFFFFFFF;
    });

    card.img.setVisible(false);
    card.lbl.setVisible(false);
    this.throwCount++;
    this._snapAllCards();

    if (this.throwCount >= this.trayCards.length) {
      this._showMsg('All thrown — waiting to settle...');
      this._waitSettle(() => {
        if (this.phase === PHASE.PLAYER_ROLL && !this._autoCommitDone) {
          this._autoCommitDone = true;
          this._showMsg('All dice settled — commit when ready');
          this._showCommitOverlay();
        }
      });
    } else {
      const nextCard = this.trayCards[this.throwCount];
      const nextFace = FACES[this.playerDiceConfig[nextCard.configIdx].faces[0]];
      this._showMsg(`Next: ${nextFace ? nextFace.label : '?'} — drag to throw`);
    }
  }

  _rerollDie(dieRef) {
    this._stopDieShield(dieRef);
    const { data } = dieRef;
    data.currentFaceIdx  = Phaser.Math.Between(0, data.faces.length - 1);
    dieRef._finalFaceIdx = data.currentFaceIdx;
    dieRef._rolling      = true;
    dieRef._lastCycleMs  = 0;
  }

  // ─── IMMEDIATE EFFECTS ────────────────────────────────────────────────────

  _applyDieFaceImmediate(dieRef) {
    if (this.phase === 99) return;
    const f = FACES[dieRef.data.faces[dieRef.data.currentFaceIdx]];
    if (!f?.effect) return;
    switch (f.effect) {
      case 'damage':
      case 'cleave': {
        const raw     = (f.value || 1);
        const blocked = this._getActiveEnemyBlock();
        const dmg     = Math.max(0, raw - blocked);
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xff4444);
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg);
          this._refreshEnemyCharacter();
          this._flashEnemyDamage(dmg);
        } else {
          this._floatText(this.enemyPos.x, this.enemyPos.y - ENEMY_BUMPER_R - 20, 'BLOCKED', '#3498db');
        }
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'pierce': {
        const dmg = (f.value || 2);
        this._laserBeam(dieRef.img.x, dieRef.img.y, this.enemyPos.x, this.enemyPos.y, 0xff6600);
        this.enemyHp = Math.max(0, this.enemyHp - dmg);
        this._refreshEnemyCharacter();
        this._flashEnemyDamage(dmg);
        if (this.enemyHp <= 0) this._triggerVictory();
        break;
      }
      case 'block':
      case 'brace': {
        const blk = (f.value || 1);
        this.block += blk;
        this._refreshStatusUI();
        this._flashDieImpact(dieRef, `+${blk} BLK`, '#3498db');
        break;
      }
      case 'heal': {
        const heal = f.value || 2;
        this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + heal);
        this._refreshStatusUI();
        this._flashDieImpact(dieRef, `+${heal} HP`, '#2ecc71');
        break;
      }
    }
  }

  _triggerVictory() {
    if (this.phase === 99) return;
    this.phase = 99;
    this._hideCommitOverlay();
    this.time.delayedCall(600, () => this._victory());
  }

  _getActiveEnemyBlock() {
    return this.enemyDice
      .filter(d => !d._rolling)
      .reduce((sum, d) => {
        const f = FACES[d.data.faces[d.data.currentFaceIdx]];
        return f?.effect === 'enemy_block' ? sum + (f.value || 0) : sum;
      }, 0);
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
    this.tweens.add({
      targets: dieRef.img, scaleX: 1.3, scaleY: 1.3,
      duration: 60, yoyo: true, ease: 'Sine.Out',
      onComplete: () => dieRef.img?.setScale(1),
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
  }

  // ─── TRAY RESET ───────────────────────────────────────────────────────────

  _resetTray() {
    this.throwCount = 0;
    this.trayCards.forEach((c, pos) => {
      c.img.setVisible(true).setAlpha(1).setDepth(21);
      c.lbl.setVisible(true).setDepth(22);
      const face = FACES[this.playerDiceConfig[c.configIdx].faces[0]];
      c.lbl.setText(face ? face.sym : '--');
      c.lbl.setColor(face ? face.color : '#777777');
      c.img.setX(this._cardX(pos));
      c.lbl.setX(this._cardX(pos));
    });
  }

  // ─── REROLL TOKEN ─────────────────────────────────────────────────────────

  _pickUpDie(dieRef) {
    const { configIdx, img, lbl, valLbl } = dieRef;
    this._stopDieShield(dieRef);
    img.destroy();
    lbl.destroy();
    valLbl.destroy();
    const ai = this.allDice.indexOf(dieRef);    if (ai >= 0) this.allDice.splice(ai, 1);
    const pi = this.playerDice.indexOf(dieRef); if (pi >= 0) this.playerDice.splice(pi, 1);

    const cardIdx = this.trayCards.findIndex(c => c.configIdx === configIdx);
    if (cardIdx >= 0 && cardIdx < this.throwCount) {
      const [card] = this.trayCards.splice(cardIdx, 1);
      this.throwCount--;
      this.trayCards.splice(this.throwCount, 0, card);

      card.img.setVisible(true).setAlpha(1).setDepth(21);
      card.lbl.setVisible(true).setDepth(22);
      const face = FACES[this.playerDiceConfig[card.configIdx].faces[0]];
      card.lbl.setText(face ? face.sym : '--');
      card.lbl.setColor(face ? face.color : '#777777');
      this._snapAllCards();
    }

    this.rerollTokens--;
    this._refreshStatusUI();
    this._hideInspector();
    this._autoCommitDone = false;
    this._hideCommitOverlay();
    this._showMsg('Die returned — drag to throw again');
  }

  // ─── INSPECTOR ────────────────────────────────────────────────────────────

  _showInspector(dieRef, pickupDieRef) {
    this._hideInspector();
    this._pendingPickup = pickupDieRef ?? null;
    const { data, isPlayer } = dieRef;
    this._buildInspectorPanel(data.faces, data.currentFaceIdx,
      isPlayer ? 0xd4a820 : 0x8b1a1a, pickupDieRef);
  }

  _buildInspectorPanel(faces, currentIdx, borderColor, pickupDieRef) {
    this.aimActive      = false;
    this._suppressThrow = true;
    this.aimGfx.clear();
    this._hideInspector();
    this.inspectorPanel = this.add.container(0, 0).setDepth(60);

    const dim = this.add.rectangle(W / 2, (SURFACE_TOP + SURFACE_BOTTOM) / 2,
      W, SURFACE_BOTTOM - SURFACE_TOP, 0x000000, 0.6).setInteractive();
    dim.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); });
    this.inspectorPanel.add(dim);

    const cx = W / 2;
    const cy = SURFACE_TOP + (THROW_ZONE_BOTTOM - SURFACE_TOP) / 2;

    if (faces.length === 6) {
      this._buildNetPanel(faces, currentIdx, borderColor, pickupDieRef, cx, cy);
    } else {
      this._buildRowPanel(faces, currentIdx, borderColor, pickupDieRef, cx, cy);
    }
  }

  // Lowercase-t die net for exactly 6 faces
  _buildNetPanel(faces, currentIdx, borderColor, pickupDieRef, cx, cy) {
    const CELL = 46, FACE = 41;
    // Col/row positions for the t-net:  top=0, left/mid/right=1, lower=2, bottom=3
    const NET = [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ];
    const netW = 3 * CELL, netH = 4 * CELL;
    const panelH = netH + 24 + (pickupDieRef ? 36 : 0);
    const gx = cx - netW / 2, gy = cy - netH / 2 - (pickupDieRef ? 18 : 0);

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

    if (pickupDieRef) this._addPickupButton(cx, gy + netH + 18);
  }

  // Compact grid fallback for non-6-face lists (e.g. enemy multi-die inspection)
  _buildRowPanel(faces, currentIdx, borderColor, pickupDieRef, cx, cy) {
    const cols = Math.min(faces.length, 6), sp = 48;
    const rows = Math.ceil(faces.length / cols);
    const panelW = cols * sp + 16, panelH = rows * 58 + 16 + (pickupDieRef ? 36 : 0);

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
    const oy = cy - ((rows - 1) * 58) / 2 - (pickupDieRef ? 18 : 0);

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

    if (pickupDieRef) this._addPickupButton(cx, oy + rows * 58 / 2 + 14);
  }

  _addPickupButton(cx, by) {
    const pbg = this.add.rectangle(cx, by, 200, 34, 0x3a1e00);
    pbg.setStrokeStyle(1, 0xe67e22, 0.8).setInteractive();
    pbg.on('pointerdown', () => { this._suppressThrow = true; this._hideInspector(); this._pickUpDie(this._pendingPickup); });
    pbg.on('pointerover',  () => pbg.setFillStyle(0x8a4010));
    pbg.on('pointerout',   () => pbg.setFillStyle(0x3a1e00));
    this.inspectorPanel.add(pbg);
    this.inspectorPanel.add(
      this.add.text(cx, by, `↺ Pick Up  (${this.rerollTokens} token)`, {
        fontSize: '17px', color: '#e67e22'
      }).setOrigin(0.5, 0.5)
    );
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

  // ─── WIN / LOSE ───────────────────────────────────────────────────────────

  _victory() {
    this.phase = 99;
    this._setPhase('VICTORY!');
    this._showMsg(`${this.enemyDef.name} defeated!`);
    this.time.delayedCall(1400, () => this.scene.start('UpgradeScene', {
      playerDiceConfig: this.playerDiceConfig,
      playerHp:    this.playerHp,
      battleIndex: this.battleIndex + 1,
    }));
  }

  _gameOver() {
    this.phase = 99;
    this._setPhase('GAME OVER');
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(80);
    this.add.text(W / 2, H / 2 - 28, 'GAME OVER', {
      fontSize: '34px', color: '#e74c3c', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(81);
    const t = this.add.text(W / 2, H / 2 + 28, 'Tap to restart', {
      fontSize: '17px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(81).setInteractive();
    t.on('pointerdown', () => this.scene.start('BattleScene', {}));
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
        const finalFace = FACES[d.data.faces[d._finalFaceIdx]];
        d.lbl.setText(finalFace ? finalFace.sym : '--');
        d.lbl.setColor(finalFace ? finalFace.color : '#ffffff');
        d.valLbl.setText(finalFace?.value !== undefined ? String(finalFace.value) : '');
        if (d.isPlayer) {
          this._applyDieFaceImmediate(d);
        } else if (finalFace?.effect === 'enemy_block') {
          this._startDieShield(d);
        }
      } else {
        const interval = Math.max(40, 250 / motion);
        if (now - d._lastCycleMs > interval) {
          d._lastCycleMs = now;
          const randFace = FACES[d.data.faces[Phaser.Math.Between(0, d.data.faces.length - 1)]];
          d.lbl.setText(randFace ? randFace.sym : '--');
          d.lbl.setColor(randFace ? randFace.color : '#ffffff');
          d.valLbl.setText(randFace?.value !== undefined ? String(randFace.value) : '');
        }
      }
    });
  }
}
