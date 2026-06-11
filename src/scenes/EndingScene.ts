import Phaser from 'phaser';
import { AssetKey, AudioKey, SCREEN_HEIGHT } from '../data/constants';
import { applyWideViewport } from '../utils/viewport';

export class EndingScene extends Phaser.Scene {
  private endingImage?: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Rectangle;
  private pressText?: Phaser.GameObjects.Text;
  private bgm?: Phaser.Sound.BaseSound;
  private transitioning = false;

  constructor() {
    super('EndingScene');
  }

  create(): void {
    const viewport = applyWideViewport(this);
    this.textures.get(AssetKey.Ending).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
      this.bgm?.stop();
      this.bgm = undefined;
    });

    this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(0);

    this.endingImage = this.add.image(0, 0, AssetKey.Ending)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0);
    this.layoutEndingImage();

    this.pressText = this.add.text(viewport.width / 2, SCREEN_HEIGHT - 42, 'PRESS ENTER', {
      color: '#f6f1d2',
      fontFamily: 'Verdana, sans-serif',
      fontSize: '20px',
      letterSpacing: 0
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3)
      .setAlpha(0);

    this.overlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(4)
      .setAlpha(1);

    this.startEndingBgm();

    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.endingImage,
      alpha: 1,
      duration: 900,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.pressText,
      alpha: 0.7,
      delay: 1000,
      duration: 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.returnToTitle());
    this.input.once('pointerdown', () => this.returnToTitle());
  }

  private layoutScene(): void {
    const viewport = applyWideViewport(this);
    this.layoutEndingImage();
    this.pressText?.setPosition(viewport.width / 2, SCREEN_HEIGHT - 42);
    this.overlay?.setSize(viewport.width, SCREEN_HEIGHT);
  }

  private layoutEndingImage(): void {
    if (!this.endingImage) {
      return;
    }

    const viewport = applyWideViewport(this);
    this.endingImage
      .setPosition(0, 0)
      .setDisplaySize(viewport.width, SCREEN_HEIGHT);
  }

  private startEndingBgm(): void {
    this.sound.stopByKey(AudioKey.Title);
    this.sound.stopByKey(AudioKey.BgmStage1);
    this.sound.stopByKey(AudioKey.BgmStage2);
    this.sound.stopByKey(AudioKey.BgmStage3);
    this.bgm = this.sound.add(AudioKey.Ending, { loop: true, volume: 0.4 });
    this.bgm.play();
  }

  private returnToTitle(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.tweens.add({
      targets: [this.endingImage, this.pressText],
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.bgm?.stop();
        this.bgm = undefined;
        this.scene.start('TitleScene');
      }
    });
  }
}
