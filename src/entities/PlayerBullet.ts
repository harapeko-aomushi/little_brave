import Phaser from 'phaser';
import { AssetKey } from '../data/constants';

export type PlayerBulletKind = 'arrow1' | 'arrow2' | 'sword1' | 'sword2';

type Clip = {
  count: number;
  h: number;
  power: number;
  scale: number;
  waitMs: number;
  w: number;
  x: number;
  yLeft: number;
  yRight: number;
};

const CLIPS: Record<PlayerBulletKind, Clip> = {
  arrow1: { x: 144, yRight: 0, yLeft: 16, w: 32, h: 16, count: 3, waitMs: 84, power: 4, scale: 1 },
  arrow2: { x: 0, yRight: 0, yLeft: 16, w: 48, h: 16, count: 3, waitMs: 84, power: 30, scale: 1 },
  sword1: { x: 0, yRight: 32, yLeft: 80, w: 48, h: 48, count: 5, waitMs: 50, power: 6, scale: 1 },
  sword2: { x: 0, yRight: 128, yLeft: 152, w: 32, h: 24, count: 3, waitMs: 50, power: 4, scale: 1 }
};

const frameName = (kind: PlayerBulletKind, direction: 'left' | 'right', frame: number): string =>
  `player-bullet-${kind}-${direction}-${frame}`;

export class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
  readonly kind: PlayerBulletKind;
  readonly power: number;

  private readonly directionName: 'left' | 'right';
  private animationFrame = 0;
  private hitOnce = false;
  private animationTimerMs = 0;
  private hitCooldowns = new Map<Phaser.GameObjects.GameObject, number>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: PlayerBulletKind,
    angleDeg: number,
    speed: number
  ) {
    const clip = CLIPS[kind];
    super(scene, x, y, AssetKey.Bullet);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.power = clip.power;
    this.directionName = Math.cos(Phaser.Math.DegToRad(angleDeg)) < 0 ? 'left' : 'right';

    this.ensureFrame(0);
    this.setFrame(frameName(kind, this.directionName, 0));
    this.setScale(clip.scale);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setSize(clip.w, Math.max(8, clip.h - 4));
    scene.physics.velocityFromAngle(angleDeg, speed, body.velocity);

    if (kind === 'sword1' || kind === 'sword2') {
      this.setBlendMode(Phaser.BlendModes.ADD);
    }

    scene.time.delayedCall(kind === 'sword2' ? 650 : 1200, () => {
      if (this.active) {
        this.destroy();
      }
    });
  }

  update(deltaMs: number): void {
    for (const [enemy, cooldownMs] of this.hitCooldowns) {
      const nextCooldownMs = cooldownMs - deltaMs;
      if (nextCooldownMs <= 0) {
        this.hitCooldowns.delete(enemy);
      } else {
        this.hitCooldowns.set(enemy, nextCooldownMs);
      }
    }
    this.updateAnimation(deltaMs);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.kind === 'sword1') {
      body.velocity.scale(0.985);
      if (Math.abs(body.velocity.x) < 30 && Math.abs(body.velocity.y) < 30) {
        this.destroy();
      }
    }
  }

  canDamageAgain(): boolean {
    return this.kind === 'sword2' || this.kind === 'arrow2';
  }

  canDamageEnemy(enemy?: Phaser.GameObjects.GameObject): boolean {
    if (this.kind === 'sword2' || this.kind === 'arrow2') {
      return !enemy || !this.hitCooldowns.has(enemy);
    }

    return !this.hitOnce;
  }

  markHit(enemy?: Phaser.GameObjects.GameObject): void {
    this.hitOnce = true;
    if ((this.kind === 'sword2' || this.kind === 'arrow2') && enemy) {
      this.hitCooldowns.set(enemy, 80);
    }
    if (this.kind === 'arrow1') {
      this.destroy();
    }
  }

  private ensureFrame(frame: number): void {
    const clip = CLIPS[this.kind];
    const texture = this.scene.textures.get(AssetKey.Bullet);
    const key = frameName(this.kind, this.directionName, frame);
    if (texture.has(key)) {
      return;
    }

    texture.add(
      key,
      0,
      clip.x + frame * clip.w,
      this.directionName === 'right' ? clip.yRight : clip.yLeft,
      clip.w,
      clip.h
    );
  }

  private updateAnimation(deltaMs: number): void {
    const clip = CLIPS[this.kind];
    this.animationTimerMs += deltaMs;

    while (this.animationTimerMs >= clip.waitMs) {
      this.animationTimerMs -= clip.waitMs;
      this.animationFrame = (this.animationFrame + 1) % clip.count;
      this.ensureFrame(this.animationFrame);
      this.setFrame(frameName(this.kind, this.directionName, this.animationFrame));
    }
  }
}
