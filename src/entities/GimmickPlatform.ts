import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import type { LegacyGimmickConfig } from '../data/legacyGimmicks';

const PLATFORM_W = 80;
const PLATFORM_H = 26;
const LEGACY_FRAME_MS = 1000 / 30;
const PATTERN_BLINK_BEFORE_RESET_FRAMES = 60;
const PATTERN_TABLE: { angle: number; speed: number; frames: number; continues: boolean }[][] = [
  [
    { angle: 90, speed: 1.5, frames: 180, continues: true },
    { angle: 45, speed: 1.5, frames: 180, continues: true },
    { angle: 315, speed: 1.5, frames: 100, continues: true },
    { angle: 45, speed: 1.5, frames: 100, continues: true },
    { angle: 315, speed: 1.5, frames: 100, continues: true },
    { angle: 45, speed: 1.5, frames: 100, continues: true },
    { angle: 315, speed: 1.5, frames: 140, continues: true },
    { angle: 270, speed: 1.5, frames: 300, continues: true },
    { angle: 0, speed: 1.5, frames: 300, continues: false }
  ],
  [{ angle: 0, speed: 1.5, frames: 220, continues: false }],
  [{ angle: 270, speed: 1.5, frames: 120, continues: false }],
  [{ angle: 90, speed: 1.5, frames: 140, continues: false }],
  [
    { angle: 45, speed: 1.5, frames: 600, continues: true },
    { angle: 0, speed: 1.5, frames: 50, continues: false }
  ],
  [{ angle: 270, speed: 1, frames: 160, continues: false }]
];

export class GimmickPlatform extends Phaser.GameObjects.Image {
  private readonly config: LegacyGimmickConfig;
  private angleDeg: number;
  deltaX = 0;
  deltaY = 0;
  private startX = 0;
  private startY = 0;
  private patternFrame = 0;
  private patternIndex = 0;
  private patternState: 'idle' | 'moving' | 'waiting' = 'idle';
  private straightDirectionX: 1 | -1 = 1;
  private straightDirectionY: 1 | -1 = 1;
  private suppressDeltaThisFrame = false;
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(scene: Phaser.Scene, config: LegacyGimmickConfig) {
    super(scene, 0, 0, AssetKey.Gimmick, GimmickPlatform.ensureFrame(scene, config.picNo));
    this.config = config;
    this.angleDeg = config.startAngle ?? 0;
    this.startX = config.x ?? config.centerX ?? 0;
    this.startY = config.y ?? config.centerY ?? 0;

    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setOrigin(0, 0);
    this.setScale(1);
    this.setDepth(4);
    this.syncPosition(true);
    this.body.setSize(PLATFORM_W, PLATFORM_H);
    this.body.setOffset(0, 0);
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
    this.body.checkCollision.down = false;
  }

  update(deltaMs: number): void {
    this.syncPosition(false, deltaMs);
  }

  startPattern(): void {
    if (this.config.type === 'pattern' && this.patternState === 'idle') {
      this.patternState = 'moving';
      this.patternFrame = 0;
      this.patternIndex = 0;
    }
  }

  get topY(): number {
    return this.y;
  }

  private static ensureFrame(scene: Phaser.Scene, picNo: number): string {
    const texture = scene.textures.get(AssetKey.Gimmick);
    const key = `gimmick-platform-${picNo}`;
    if (!texture.has(key)) {
      texture.add(key, 0, picNo * PLATFORM_W, 0, PLATFORM_W, PLATFORM_H);
    }
    return key;
  }

  private syncPosition(initial: boolean, deltaMs = LEGACY_FRAME_MS): void {
    const previousX = this.x;
    const previousY = this.y;
    const stepScale = deltaMs / LEGACY_FRAME_MS;

    if (this.config.type === 'circle') {
      if (!initial) {
        this.angleDeg = (this.angleDeg + this.config.speed * stepScale) % 360;
      }
      const radius = this.config.radius ?? 120;
      this.x = Math.round((this.config.centerX ?? 0) + Math.cos(Phaser.Math.DegToRad(this.angleDeg)) * radius);
      this.y = Math.round((this.config.centerY ?? 0) + Math.sin(Phaser.Math.DegToRad(this.angleDeg)) * radius);
    } else if (this.config.type === 'straight') {
      if (initial) {
        this.x = this.startX;
        this.y = this.startY;
      } else {
        const moveX = (this.config.limitX ?? 0) === 0 ? 0 : this.straightDirectionX * this.config.speed;
        const moveY = (this.config.limitY ?? 0) === 0 ? 0 : this.straightDirectionY * this.config.speed;
        this.x += moveX * stepScale;
        this.y += moveY * stepScale;
        if (this.x > this.startX + (this.config.limitX ?? 0)) {
          this.x = this.startX + (this.config.limitX ?? 0);
          this.straightDirectionX = -1;
        } else if (this.x < this.startX) {
          this.x = this.startX;
          this.straightDirectionX = 1;
        }
        if (this.y > this.startY + (this.config.limitY ?? 0)) {
          this.y = this.startY + (this.config.limitY ?? 0);
          this.straightDirectionY = -1;
        } else if (this.y < this.startY) {
          this.y = this.startY;
          this.straightDirectionY = 1;
        }
      }
    } else if (initial) {
      this.x = this.startX;
      this.y = this.startY;
    } else {
      this.updatePattern(stepScale);
    }

    this.deltaX = this.x - previousX;
    this.deltaY = this.y - previousY;

    if (initial || this.suppressDeltaThisFrame) {
      this.deltaX = 0;
      this.deltaY = 0;
      this.suppressDeltaThisFrame = false;
    }

    this.body.updateFromGameObject();
  }

  private updatePattern(stepScale: number): void {
    if (this.patternState === 'idle') {
      this.deltaX = 0;
      this.deltaY = 0;
      this.setVisible(true);
      return;
    }

    if (this.patternState === 'waiting') {
      this.patternFrame += stepScale;
      const remainingFrames = 60 - this.patternFrame;
      if (remainingFrames <= PATTERN_BLINK_BEFORE_RESET_FRAMES) {
        this.setVisible(Math.floor(this.patternFrame / 5) % 2 === 0);
      } else {
        this.setVisible(true);
      }
      if (this.patternFrame >= 60) {
        this.patternState = 'idle';
        this.patternFrame = 0;
        this.patternIndex = 0;
        this.x = this.startX;
        this.y = this.startY;
        this.suppressDeltaThisFrame = true;
        this.setVisible(true);
      }
      return;
    }

    this.setVisible(true);
    const pattern = PATTERN_TABLE[this.config.tblNo ?? 0] ?? PATTERN_TABLE[0];
    const step = pattern[this.patternIndex] ?? pattern[0];
    if (this.patternFrame >= step.frames) {
      if (!step.continues) {
        this.patternState = 'waiting';
        this.patternFrame = 0;
        return;
      }
      this.patternIndex = Math.min(this.patternIndex + 1, pattern.length - 1);
      this.patternFrame = 0;
    }

    const activeStep = pattern[this.patternIndex] ?? pattern[0];
    const speedScale = this.config.speed / 3;
    this.x += Math.cos(Phaser.Math.DegToRad(activeStep.angle)) * activeStep.speed * speedScale * stepScale;
    this.y += Math.sin(Phaser.Math.DegToRad(activeStep.angle)) * activeStep.speed * speedScale * stepScale;
    this.patternFrame += stepScale;
  }
}
