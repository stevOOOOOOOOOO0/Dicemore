import Phaser from 'phaser';
import { loadRelics } from '../data/relics.js';
import { W, H } from '../constants.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const txt = this.add.text(W / 2, H / 2, 'Loading…', {
      fontSize: '17px', color: '#5a7a8a', letterSpacing: 2,
    }).setOrigin(0.5);

    Promise.all([
      loadRelics(),
      document.fonts.load('bold 16px "Cinzel"').catch(() => null),
    ]).then(([relics]) => {
      this.registry.set('allRelics', relics);
      txt.destroy();
      this.scene.start('HomeScene');
    });
  }
}
