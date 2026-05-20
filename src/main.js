import Phaser from 'phaser';
import SetupScene from './scenes/SetupScene.js';
import BattleScene from './scenes/BattleScene.js';
import UpgradeScene from './scenes/UpgradeScene.js';

const config = {
  type: Phaser.AUTO,
  width: 400,
  height: 700,
  backgroundColor: '#111122',
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [SetupScene, BattleScene, UpgradeScene]
};

new Phaser.Game(config);
