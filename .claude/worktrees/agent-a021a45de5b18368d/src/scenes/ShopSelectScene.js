import Phaser from 'phaser';
import { W, H } from '../constants.js';

const SHOPS = [
  {
    key:     'trenchcoat',
    name:    'Trench Coat Guy',
    tagline: 'A shady figure in a very large coat.',
    color:   '#cc8844',
    sections: ['10 Brands', '4 Chips', 'Cull a Face'],
  },
  {
    key:     'witch',
    name:    "The Witch's Corner",
    tagline: 'She knows things. Probably.',
    color:   '#9b59b6',
    sections: ['10 Brands', 'Rune Management', 'Cull a Face'],
  },
  {
    key:     'forge',
    name:    'The Forge',
    tagline: 'Specialising in convincing replicas.',
    color:   '#3498db',
    sections: ['10 Brands', '4 Materials', 'Cull a Face'],
  },
];

export default class ShopSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'ShopSelectScene' }); }

  init(data) {
    this._data = data;
    // Pick 2 of 3 shops at random
    const shuffled = Phaser.Utils.Array.Shuffle([...SHOPS]);
    this._available = shuffled.slice(0, 2);
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0d1a);

    this.add.text(W / 2, 36, 'CHOOSE A SHOP', {
      fontSize: '22px', color: '#f0c040', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 64, 'Two are available. Visit one, then move on.', {
      fontSize: '13px', color: '#445566',
    }).setOrigin(0.5);

    const CARD_H = 180, GAP = 16, START_Y = 100;

    this._available.forEach((shop, i) => {
      const cy = START_Y + i * (CARD_H + GAP) + CARD_H / 2;
      const fc = parseInt(shop.color.replace('#', ''), 16);

      const bg = this.add.rectangle(W / 2, cy, W - 32, CARD_H, 0x0d0d1c);
      bg.setStrokeStyle(2, fc, 0.6).setInteractive();

      this.add.rectangle(16, cy, 4, CARD_H - 20, fc, 0.8);

      this.add.text(30, cy - 60, shop.name, {
        fontSize: '18px', color: shop.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      this.add.text(30, cy - 36, shop.tagline, {
        fontSize: '12px', color: '#556677',
      }).setOrigin(0, 0.5);

      shop.sections.forEach((sec, si) => {
        this.add.text(38, cy - 8 + si * 20, `• ${sec}`, {
          fontSize: '13px', color: '#8899aa',
        }).setOrigin(0, 0.5);
      });

      const arrow = this.add.text(W - 24, cy, '→', {
        fontSize: '22px', color: '#2a2a3a',
      }).setOrigin(0.5);

      bg.on('pointerover',  () => { bg.setFillStyle(0x181828); bg.setStrokeStyle(2, fc, 1); arrow.setColor(shop.color); });
      bg.on('pointerout',   () => { bg.setFillStyle(0x0d0d1c); bg.setStrokeStyle(2, fc, 0.6); arrow.setColor('#2a2a3a'); });
      bg.on('pointerdown',  () => this.time.delayedCall(1, () => this.scene.start('ShopScene', { ...this._data, shopType: shop.key })));
    });

    // Skip button
    const skipY = START_Y + this._available.length * (CARD_H + GAP) + 20;
    const skipBg = this.add.rectangle(W / 2, skipY + 22, W - 32, 44, 0x0a0a14).setInteractive();
    skipBg.setStrokeStyle(1, 0x222233, 0.8);
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x181828));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(0x0a0a14));
    skipBg.on('pointerdown', () => this.time.delayedCall(1, () => this.scene.start('BattleScene', this._data)));
    this.add.text(W / 2, skipY + 22, 'Skip  →', {
      fontSize: '15px', color: '#2a3848',
    }).setOrigin(0.5);
  }
}
