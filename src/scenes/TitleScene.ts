import Phaser from 'phaser';
import { AssetKey, AudioKey, SCREEN_HEIGHT } from '../data/constants';
import { applyWideViewport } from '../utils/viewport';

const BACKGROUND_SCROLL_SPEED = 16;
const BACKGROUND_TURN_ZONE = 10;
const BACKGROUND_VELOCITY_LERP = 0.018;
const TITLE_MAX_WIDTH_RATIO = 0.5;
const TITLE_TOP = -20;

export class TitleScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private pressText?: Phaser.GameObjects.Text;
  private scrollDirection: 1 | -1 = 1;
  private scrollVelocity = BACKGROUND_SCROLL_SPEED;
  private scrollX = 0;
  private titleLogo?: Phaser.GameObjects.Image;
  private bgm?: Phaser.Sound.BaseSound;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitioning = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.transitioning = false;
    this.scrollDirection = 1;
    this.scrollVelocity = BACKGROUND_SCROLL_SPEED;
    this.scrollX = 0;
    this.transitionOverlay = undefined;
    this.startTitleBgm();

    const viewport = applyWideViewport(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
      this.bgm?.stop();
      this.bgm = undefined;
    });


    this.background = this.add.image(0, 0, AssetKey.Bg)
      .setOrigin(0)
      .setDepth(0);
    this.layoutBackground();

    this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x071018, 0.2)
      .setOrigin(0)
      .setDepth(1);

    this.titleLogo = this.add.image(viewport.width / 2, TITLE_TOP, AssetKey.Title)
      .setOrigin(0.5, 0)
      .setDepth(3);
    this.layoutTitleLogo();
    this.tweens.add({
      targets: this.titleLogo,
      y: TITLE_TOP + 8,
      scaleX: this.titleLogo.scaleX * 1.015,
      scaleY: this.titleLogo.scaleY * 1.015,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this.pressText = this.add.text(viewport.width / 2, SCREEN_HEIGHT - 92, 'PRESS ENTER', {
      color: '#f6f1d2',
      fontFamily: 'Verdana, sans-serif',
      fontSize: '24px',
      letterSpacing: 0
    }).setOrigin(0.5).setDepth(3);
    this.tweens.add({
      targets: this.pressText,
      alpha: 0.35,
      duration: 760,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this.transitionOverlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0);

    const keyboard = this.input.keyboard;
    keyboard?.once('keydown-ENTER', () => this.startGameTransition());
    this.input.once('pointerdown', () => this.startGameTransition());
  }

  override update(_time: number, delta: number): void {
    if (!this.background) {
      return;
    }

    const viewport = applyWideViewport(this);
    const maxScrollX = this.getMaxBackgroundScroll(viewport.width);
    this.updateScrollVelocity(delta, maxScrollX);
    this.scrollX = Phaser.Math.Clamp(this.scrollX + this.scrollVelocity * (delta / 1000), 0, maxScrollX);
    this.background.setX(-this.scrollX);
  }

  private configureCamera(): void {
    const viewport = applyWideViewport(this);
    this.layoutBackground();
    const maxScrollX = this.getMaxBackgroundScroll(viewport.width);
    this.scrollX = Math.min(this.scrollX, maxScrollX);
    this.background?.setX(-this.scrollX);
    this.titleLogo?.setX(viewport.width / 2);
    this.pressText?.setPosition(viewport.width / 2, SCREEN_HEIGHT - 92);
    this.transitionOverlay?.setSize(viewport.width, SCREEN_HEIGHT);
    this.layoutTitleLogo();
  }

  private layoutTitleLogo(): void {
    if (!this.titleLogo) {
      return;
    }

    const viewport = applyWideViewport(this);
    const source = this.textures.get(AssetKey.Title).getSourceImage() as HTMLImageElement;
    const titleScale = Math.min(1.15, (viewport.width * TITLE_MAX_WIDTH_RATIO) / source.width);
    this.titleLogo
      .setScale(titleScale)
      .setPosition(viewport.width / 2, TITLE_TOP);
  }

  private layoutBackground(): void {
    if (!this.background) {
      return;
    }

    const viewport = applyWideViewport(this);
    const source = this.textures.get(AssetKey.Bg).getSourceImage() as HTMLImageElement;
    const scale = Math.max(SCREEN_HEIGHT / source.height, viewport.width / source.width);
    this.background
      .setDisplaySize(source.width * scale, source.height * scale)
      .setPosition(-this.scrollX, 0);
  }

  private getMaxBackgroundScroll(viewportWidth: number): number {
    if (!this.background) {
      return 0;
    }

    return Math.max(0, this.background.displayWidth - viewportWidth);
  }

  private updateScrollVelocity(deltaMs: number, maxScrollX: number): void {
    if (maxScrollX <= 0) {
      this.scrollVelocity = 0;
      return;
    }

    const turnZone = Math.min(BACKGROUND_TURN_ZONE, maxScrollX * 0.45);
    if (this.scrollX >= maxScrollX - turnZone) {
      this.scrollDirection = -1;
    } else if (this.scrollX <= turnZone) {
      this.scrollDirection = 1;
    }

    const targetVelocity = BACKGROUND_SCROLL_SPEED * this.scrollDirection;
    const lerpAmount = 1 - Math.pow(1 - BACKGROUND_VELOCITY_LERP, deltaMs / (1000 / 60));
    this.scrollVelocity = Phaser.Math.Linear(this.scrollVelocity, targetVelocity, lerpAmount);
  }

  private startTitleBgm(): void {
    const bgmKey = AudioKey.Title;
    if (!this.cache.audio.exists(bgmKey)) {
      console.warn(`[audio] ${bgmKey} is not available. Title BGM will be skipped.`);
      return;
    }

    this.sound.stopByKey(AudioKey.BgmStage1);
    this.sound.stopByKey(AudioKey.BgmStage2);
    this.sound.stopByKey(AudioKey.BgmStage3);
    this.bgm = this.sound.add(bgmKey, { loop: true, volume: 0.38 });
    this.bgm.play();
  }

  private startGameTransition(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.fadeOutTitleBgm(900);
    this.tweens.add({
      targets: this.transitionOverlay,
      alpha: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.bgm?.stop();
        this.bgm = undefined;
        this.scene.start('StageScene', { stageId: 0 });
      }
    });
  }

  private fadeOutTitleBgm(duration: number): void {
    if (!this.bgm) {
      return;
    }

    const volumeState = { volume: 0.38 };
    this.tweens.add({
      targets: volumeState,
      volume: 0,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.setSoundVolume(this.bgm, volumeState.volume);
      }
    });
  }

  private setSoundVolume(sound: Phaser.Sound.BaseSound | undefined, volume: number): void {
    if (!sound) {
      return;
    }

    if ('setVolume' in sound && typeof sound.setVolume === 'function') {
      sound.setVolume(volume);
    }
  }
}
