import Phaser from 'phaser';
import { W, H, FONT_DISPLAY } from '../constants.js';

export default class HomeScene extends Phaser.Scene {
  constructor() { super({ key: 'HomeScene' }); }

  create() {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    // Title — hero entrance: rises from below, fades in
    const title = this.add.text(W / 2, H / 2 - 125, 'DICEMORE', {
      fontSize: '38px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 6,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: H / 2 - 140, duration: 700, ease: 'Sine.Out' });

    this.add.text(W / 2, H / 2 - 90, 'pre-alpha-beta-0.23', {
      fontSize: '11px', color: '#2a3848',
    }).setOrigin(0.5);

    // SOLO — stagger in after title
    const [soloHit, soloLbl] = this._makeBtn(W / 2, H / 2 - 10, 'SOLO', '#d4a820', 0x1a1206, () => {
      this.scene.start('SetupScene', {});
    });
    this.tweens.add({ targets: [soloHit, soloLbl], alpha: 1, duration: 300, delay: 450, ease: 'Sine.Out' });

    const soloDesc = this.add.text(W / 2, H / 2 + 24, 'solo run · roguelike', {
      fontSize: '13px', color: '#6a8a9a',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: soloDesc, alpha: 1, duration: 300, delay: 520 });

    // DICE DUEL — stagger in after SOLO
    const [duelHit, duelLbl] = this._makeBtn(W / 2, H / 2 + 80, 'DICE DUEL', '#00ccff', 0x06141a, () => {
      this.scene.start('SetupScene', { mpMode: true, mpPlayer: 1 });
    });
    this.tweens.add({ targets: [duelHit, duelLbl], alpha: 1, duration: 300, delay: 600, ease: 'Sine.Out' });

    const duelDesc = this.add.text(W / 2, H / 2 + 114, '1v1 · same device', {
      fontSize: '13px', color: '#4a8a9a',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: duelDesc, alpha: 1, duration: 300, delay: 660 });
  }

  _makeBtn(x, y, label, color, bg, onTap) {
    const fc  = parseInt(color.replace('#', ''), 16);
    const hit = this.add.rectangle(x, y, 240, 52, bg).setStrokeStyle(2, fc, 0.9)
      .setInteractive({ useHandCursor: true }).setAlpha(0);
    const lbl = this.add.text(x, y, label, {
      fontSize: '22px', color, fontStyle: 'bold', letterSpacing: 3,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5).setAlpha(0);

    hit.on('pointerover',  () => hit.setFillColor(Phaser.Display.Color.HexStringToColor(color.replace('#', '')).darken(60).color));
    hit.on('pointerout',   () => hit.setFillColor(bg));
    hit.on('pointerdown',  () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', onTap);
    });

    return [hit, lbl];
  }
}
