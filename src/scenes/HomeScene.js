import Phaser from 'phaser';
import { W, H, FONT_DISPLAY } from '../constants.js';

export default class HomeScene extends Phaser.Scene {
  constructor() { super({ key: 'HomeScene' }); }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x111122);
    this.add.rectangle(W / 2, 1, W, 2, 0x1a4a7a);

    this.add.text(W / 2, H / 2 - 140, 'DICEMORE', {
      fontSize: '38px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 6,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 90, 'pre-alpha-beta-0.21', {
      fontSize: '11px', color: '#2a3848',
    }).setOrigin(0.5);

    this._makeBtn(W / 2, H / 2 - 10, 'SOLO', '#d4a820', 0x1a1206, () => {
      this.scene.start('SetupScene', {});
    });

    this._makeBtn(W / 2, H / 2 + 80, 'DICE DUEL', '#00ccff', 0x06141a, () => {
      this.scene.start('SetupScene', { mpMode: true, mpPlayer: 1 });
    });

    this.add.text(W / 2, H / 2 + 136, '2 players · same device', {
      fontSize: '13px', color: '#6a8a9a',
    }).setOrigin(0.5);
  }

  _makeBtn(x, y, label, color, bg, onTap) {
    const fc  = parseInt(color.replace('#', ''), 16);
    const hit = this.add.rectangle(x, y, 240, 52, bg).setStrokeStyle(2, fc, 0.9)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: '22px', color, fontStyle: 'bold', letterSpacing: 4,
      fontFamily: FONT_DISPLAY,
    }).setOrigin(0.5);

    hit.on('pointerover',  () => hit.setFillColor(Phaser.Display.Color.HexStringToColor(color.replace('#', '')).darken(60).color));
    hit.on('pointerout',   () => hit.setFillColor(bg));
    hit.on('pointerdown',  onTap);
  }
}
