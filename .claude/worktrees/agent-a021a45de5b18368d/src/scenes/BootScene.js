import Phaser from 'phaser';
import { loadRelics } from '../data/relics.js';
import { W, H } from '../constants.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const txt = this.add.text(W / 2, H / 2, 'Loading…', {
      fontSize: '17px', color: '#334455', letterSpacing: 2,
    }).setOrigin(0.5);

    loadRelics().then(relics => {
      this.registry.set('allRelics', relics);
      txt.destroy();
      this.scene.start('SetupScene');
    });
  }
}
