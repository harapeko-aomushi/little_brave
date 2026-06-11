import Phaser from 'phaser';
import { AssetKey, SCREEN_HEIGHT } from '../data/constants';
import { applyWideViewport } from '../utils/viewport';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    const viewport = applyWideViewport(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
    });

    this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x090d12).setOrigin(0);
    this.add.image(viewport.width / 2, 170, AssetKey.GameOver).setScale(1);
    this.add.text(viewport.width / 2, 320, 'PRESS ENTER', {
      color: '#f6f1d2',
      fontFamily: 'Verdana, sans-serif',
      fontSize: '22px',
      letterSpacing: 0
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('TitleScene'));
    this.input.once('pointerdown', () => this.scene.start('TitleScene'));
  }

  private configureCamera(): void {
    applyWideViewport(this);
  }
}
