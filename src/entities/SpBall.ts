import Phaser from 'phaser';
import { AssetKey, AudioKey } from '../data/constants';
import { Player } from './Player';

const FRAME_COUNT = 6;
const FRAME_MS = 100;

const frameName = (frame: number): string => `sp-ball-${frame}`;

export class SpBall extends Phaser.GameObjects.Sprite {
  private angleDeg: number;
  private animationFrame = 0;
  private animationTimerMs = 0;
  private attraction = false;
  private lifetimeMs = 0;
  private speedPerFrame = 2;

  constructor(scene: Phaser.Scene, x: number, y: number, angleDeg: number) {
    super(scene, x, y, AssetKey.Item);
    scene.add.existing(this);
    this.angleDeg = angleDeg;
    this.setOrigin(0.5);
    this.setDepth(8);
    this.setScale(1);
    this.setAlpha(0.8);
    this.ensureFrame(0);
    this.setFrame(frameName(0));
  }

  update(deltaMs: number, player: Player): void {
    const deltaFrames = deltaMs / (1000 / 60);
    this.lifetimeMs += deltaMs;
    this.updateAnimation(deltaMs);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (!this.attraction) {
      if (this.speedPerFrame >= 0) {
        this.speedPerFrame = Math.max(0, this.speedPerFrame - 0.05 * deltaFrames);
      }
      if (this.speedPerFrame <= 0.01 && distance < 200) {
        this.attraction = true;
      }
    } else {
      this.angleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
      this.speedPerFrame = Math.min(10, this.speedPerFrame + 0.1 * deltaFrames);
    }

    const angleRad = Phaser.Math.DegToRad(this.angleDeg);
    this.x += Math.cos(angleRad) * this.speedPerFrame * deltaFrames;
    this.y += Math.sin(angleRad) * this.speedPerFrame * deltaFrames;

    this.setVisible(this.lifetimeMs < 5000 || Math.floor(this.lifetimeMs / 80) % 2 === 0);

    if (distance < 18) {
      this.scene.sound.play(AudioKey.Heal, { volume: 0.45 });
      player.recoverSp(1);
      this.destroy();
      return;
    }

    if (this.lifetimeMs >= 6600) {
      this.destroy();
    }
  }

  private ensureFrame(frame: number): void {
    const texture = this.scene.textures.get(AssetKey.Item);
    const key = frameName(frame);
    if (!texture.has(key)) {
      texture.add(key, 0, 8 + frame * 8, 0, 8, 8);
    }
  }

  private updateAnimation(deltaMs: number): void {
    this.animationTimerMs += deltaMs;
    while (this.animationTimerMs >= FRAME_MS) {
      this.animationTimerMs -= FRAME_MS;
      this.animationFrame = (this.animationFrame + 1) % FRAME_COUNT;
      this.ensureFrame(this.animationFrame);
      this.setFrame(frameName(this.animationFrame));
    }
  }
}
