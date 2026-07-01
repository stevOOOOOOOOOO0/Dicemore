import Phaser from 'phaser';
import { W, H } from '../constants.js';
import { COLORS, TYPE, MOTION, hexNum } from '../ui/theme.js';
import { makeButton, makeModal } from '../ui/components.js';
import SaveManager from '../systems/SaveManager.js';
import StatsManager from '../systems/StatsManager.js';

export default class HomeScene extends Phaser.Scene {
  constructor() { super({ key: 'HomeScene' }); }

  create() {
    this.cameras.main.fadeIn(MOTION.sceneFadeIn, 0, 0, 0);

    this.add.rectangle(W / 2, H / 2, W, H, hexNum(COLORS.midnightBase));
    this.add.rectangle(W / 2, 1, W, 2, hexNum(COLORS.blueEdge));

    // Title — hero entrance: rises from below, fades in
    const title = this.add.text(W / 2, H / 2 - 125, 'DICEMORE', {
      ...TYPE.display, color: COLORS.goldPrimary,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: H / 2 - 140, duration: MOTION.titleEntrance, ease: 'Sine.Out' });

    this.add.text(24, 24, 'pre-alpha-beta-0.26', {
      fontSize: '11px', color: COLORS.inkGhost,
    }).setOrigin(0, 0);

    const savedRun = SaveManager.load();
    const yOff = savedRun ? 64 : 0;

    // CONTINUE — only shown when a resumable run exists, sits above SOLO
    if (savedRun) {
      const battleNum = (savedRun.battleIndex ?? 0) + 1;
      const cont = makeButton(this, W / 2, H / 2 - 64, 240, 46, {
        variant: 'confirm', label: 'CONTINUE',
        onTap: () => this._go('BattleScene', savedRun),
      });
      [cont.g, cont.txt].forEach(o => o.setAlpha(0));
      this.tweens.add({ targets: [cont.g, cont.txt], alpha: 1, duration: 300, delay: 380, ease: 'Sine.Out' });

      const contDesc = this.add.text(W / 2, H / 2 - 32, `resume run · battle ${battleNum}`, {
        ...TYPE.body, color: '#6aaa7a',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: contDesc, alpha: 1, duration: 300, delay: 450 });
    }

    // SOLO — stagger in after title
    const solo = makeButton(this, W / 2, H / 2 - 10 + yOff, 240, 52, {
      variant: 'primary', label: 'SOLO', accent: COLORS.goldWarm,
      onTap: () => this._go('SetupScene', {}),
    });
    [solo.g, solo.txt].forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: [solo.g, solo.txt], alpha: 1, duration: 300, delay: 450, ease: 'Sine.Out' });

    const soloDesc = this.add.text(W / 2, H / 2 + 24 + yOff, 'solo run · roguelike', {
      ...TYPE.body, color: '#6a8a9a',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: soloDesc, alpha: 1, duration: 300, delay: 520 });

    // DICE DUEL — stagger in after SOLO
    const duel = makeButton(this, W / 2, H / 2 + 80 + yOff, 240, 52, {
      variant: 'primary', label: 'DICE DUEL', accent: '#00ccff',
      onTap: () => this._go('SetupScene', { mpMode: true, mpPlayer: 1 }),
    });
    [duel.g, duel.txt].forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: [duel.g, duel.txt], alpha: 1, duration: 300, delay: 600, ease: 'Sine.Out' });

    const duelDesc = this.add.text(W / 2, H / 2 + 114 + yOff, '1v1 · same device', {
      ...TYPE.body, color: '#4a8a9a',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: duelDesc, alpha: 1, duration: 300, delay: 660 });

    // Stats link
    const statsTxt = this.add.text(W / 2, H - 28, 'stats', {
      ...TYPE.body, fontSize: '12px', color: COLORS.inkGhost, letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: statsTxt, alpha: 1, duration: 300, delay: 700 });
    statsTxt.on('pointerover', () => statsTxt.setColor(COLORS.inkMuted));
    statsTxt.on('pointerout',  () => statsTxt.setColor(COLORS.inkGhost));
    statsTxt.on('pointerdown', () => this._showStats());
  }

  _showStats() {
    const s = StatsManager.get();
    const rows = [
      ['Runs started',      s.runsStarted],
      ['Battles won',       s.battlesWon],
      ['Boss kills',        s.bossKills],
      ['Deaths',            s.deaths],
      ['Dice Duel matches', s.diceDuelMatches],
      ['Dice thrown',       s.diceThrown],
      ['Highest face landed', s.maxFaceLanded],
      ['Total block gained', s.totalBlockGained],
    ];

    const h = 60 + rows.length * 24;
    const modal = makeModal(this, { w: 280, h, title: 'LIFETIME STATS' });

    let y = modal.contentY + 8;
    rows.forEach(([label, value]) => {
      const labelTxt = this.add.text(W / 2 - 106, y, label, { ...TYPE.body, color: COLORS.inkSecondary }).setOrigin(0, 0.5);
      const valueTxt = this.add.text(W / 2 + 106, y, String(value), { ...TYPE.body, color: COLORS.inkPrimary, fontStyle: 'bold' }).setOrigin(1, 0.5);
      modal.container.add([labelTxt, valueTxt]);
      y += 24;
    });
  }

  _go(key, data) {
    this.cameras.main.fadeOut(MOTION.sceneFadeOut, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
