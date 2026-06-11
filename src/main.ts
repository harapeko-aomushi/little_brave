import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { GameOverScene } from './scenes/GameOverScene';
import { StageScene } from './scenes/StageScene';
import { TitleScene } from './scenes/TitleScene';
import { SCREEN_HEIGHT } from './data/constants';
import { getWideGameWidth } from './utils/viewport';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: getWideGameWidth(),
  height: SCREEN_HEIGHT,
  backgroundColor: '#101820',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1200, x: 0 },
      debug: false
    }
  },
  scene: [BootScene, TitleScene, StageScene, GameOverScene, EndingScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(getWideGameWidth(), SCREEN_HEIGHT);
});
