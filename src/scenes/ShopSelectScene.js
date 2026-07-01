import Phaser from 'phaser';
import { W, H } from '../constants.js';
import { RADIUS, hexNum } from '../ui/theme.js';

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

      const cardW = W - 32;
      const cardGfx = this.add.graphics();
      const redrawCard = (hover) => {
        cardGfx.clear();
        cardGfx.fillStyle(hover ? hexNum('#181828') : hexNum('#0d0d1c'), 1);
        cardGfx.fillRoundedRect(W / 2 - cardW / 2, cy - CARD_H / 2, cardW, CARD_H, RADIUS.soft);
        cardGfx.lineStyle(2, fc, hover ? 1 : 0.6);
        cardGfx.strokeRoundedRect(W / 2 - cardW / 2, cy - CARD_H / 2, cardW, CARD_H, RADIUS.soft);
      };
      redrawCard(false);
      const hit = this.add.rectangle(W / 2, cy, cardW, CARD_H, 0x000000, 0).setInteractive();

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

      hit.on('pointerover',  () => { redrawCard(true); arrow.setColor(shop.color); });
      hit.on('pointerout',   () => { redrawCard(false); arrow.setColor('#2a2a3a'); });
      hit.on('pointerdown',  () => this.time.delayedCall(1, () => this.scene.start('ShopScene', { ...this._data, shopType: shop.key })));
    });

    // Skip button
    const skipY = START_Y + this._available.length * (CARD_H + GAP) + 20;
    const skipW = W - 32, skipH = 44, skipCy = skipY + 22;
    const skipGfx = this.add.graphics();
    const redrawSkip = (hover) => {
      skipGfx.clear();
      skipGfx.fillStyle(hover ? hexNum('#181828') : hexNum('#0a0a14'), 1);
      skipGfx.fillRoundedRect(W / 2 - skipW / 2, skipCy - skipH / 2, skipW, skipH, RADIUS.soft);
      skipGfx.lineStyle(1, hexNum('#222233'), 0.8);
      skipGfx.strokeRoundedRect(W / 2 - skipW / 2, skipCy - skipH / 2, skipW, skipH, RADIUS.soft);
    };
    redrawSkip(false);
    const skipHit = this.add.rectangle(W / 2, skipCy, skipW, skipH, 0x000000, 0).setInteractive();
    skipHit.on('pointerover', () => redrawSkip(true));
    skipHit.on('pointerout',  () => redrawSkip(false));
    skipHit.on('pointerdown', () => this.time.delayedCall(1, () => this.scene.start('BattleScene', this._data)));
    this.add.text(W / 2, skipY + 22, 'Skip  →', {
      fontSize: '15px', color: '#2a3848',
    }).setOrigin(0.5);
  }
}
