import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import { ENEMY_STATS, type EnemyBulletKind, type EnemyKind } from '../data/enemies';
import { Player } from './Player';

type EnemyUpdateContext = {
  deltaMs: number;
  groundAhead: (enemy: Enemy, direction: 1 | -1) => boolean;
  player: Player;
  spaceAbove: (enemy: Enemy) => boolean;
  spawnBullet: (kind: EnemyBulletKind, x: number, y: number, velocityX: number, velocityY: number) => void;
  worldLeft: number;
  worldRight: number;
};

export type EnemyKnockback = {
  x: number;
  y: number;
};

export type EnemyDamageOptions = {
  allowDuringHurt?: boolean;
  knockback?: EnemyKnockback;
};

type ClipState = 'attack' | 'damage' | 'move' | 'wait';
type DirectionName = 'left' | 'right';
type BirdState = 'attack' | 'patrol' | 'return';

type LegacyClip = {
  count: number;
  height: number;
  waitFrames: number;
  width: number;
  x: number;
  y: number;
};

type LegacyClipSet = Partial<Record<ClipState, Record<DirectionName, LegacyClip>>>;

const clamp = Phaser.Math.Clamp;
const frameMs = (frames: number): number => Math.max(16, frames * (1000 / 60));

const clip = (
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  waitFrames: number
): LegacyClip => ({ x, y, width, height, count: Math.max(1, count), waitFrames });

const frameName = (kind: EnemyKind, state: ClipState, direction: DirectionName, frame: number): string =>
  `${kind}-${state}-${direction}-${frame}`;
const gaugeFrameName = (part: 'back' | 'front'): string => `enemy-hp-${part}`;

const SLIME_HEIGHT = 32;
const LIQUID_HEIGHT = 69;
const BIRD_ATTACK_RANGE = 260;
const BIRD_ATTACK_SPEED = 230;
const BIRD_RETURN_SPEED = 160;

const LEGACY_CLIPS: Record<EnemyKind, LegacyClipSet> = {
  bird: {
    move: {
      right: clip(240, 0, 48, 56, 5, 8),
      left: clip(0, 0, 48, 56, 5, 8)
    },
    attack: {
      right: clip(528, 0, 48, 56, 1, 8),
      left: clip(480, 0, 48, 56, 1, 8)
    }
  },
  slime1: {
    move: {
      right: clip(160, 56, 40, SLIME_HEIGHT, 4, 10),
      left: clip(0, 56, 40, SLIME_HEIGHT, 4, 10)
    },
    damage: {
      right: clip(480, 56, 40, SLIME_HEIGHT, 4, 7),
      left: clip(320, 56, 40, SLIME_HEIGHT, 4, 7)
    }
  },
  slime2: {
    move: {
      right: clip(160, 88, 40, SLIME_HEIGHT, 4, 10),
      left: clip(0, 88, 40, SLIME_HEIGHT, 4, 10)
    },
    damage: {
      right: clip(480, 88, 40, SLIME_HEIGHT, 4, 7),
      left: clip(320, 88, 40, SLIME_HEIGHT, 4, 7)
    }
  },
  slime3: {
    move: {
      right: clip(160, 120, 40, SLIME_HEIGHT, 4, 7),
      left: clip(0, 120, 40, SLIME_HEIGHT, 4, 7)
    },
    damage: {
      right: clip(480, 120, 40, SLIME_HEIGHT, 4, 7),
      left: clip(320, 120, 40, SLIME_HEIGHT, 4, 7)
    }
  },
  liquid1: {
    wait: {
      right: clip(0, 152, 40, LIQUID_HEIGHT, 4, 10),
      left: clip(0, 224, 40, LIQUID_HEIGHT, 4, 10)
    },
    attack: {
      right: clip(320, 152, 40, LIQUID_HEIGHT, 5, 8),
      left: clip(320, 224, 40, LIQUID_HEIGHT, 5, 8)
    },
    damage: {
      right: clip(520, 152, 40, LIQUID_HEIGHT, 1, 8),
      left: clip(520, 224, 40, LIQUID_HEIGHT, 1, 8)
    }
  },
  liquid2: {
    wait: {
      right: clip(0, 296, 40, LIQUID_HEIGHT, 4, 10),
      left: clip(0, 368, 40, LIQUID_HEIGHT, 4, 10)
    },
    attack: {
      right: clip(320, 296, 40, LIQUID_HEIGHT, 5, 8),
      left: clip(320, 368, 40, LIQUID_HEIGHT, 5, 8)
    },
    damage: {
      right: clip(520, 296, 40, LIQUID_HEIGHT, 1, 8),
      left: clip(520, 368, 40, LIQUID_HEIGHT, 1, 8)
    }
  },
  liquid3: {
    wait: {
      right: clip(0, 440, 40, LIQUID_HEIGHT, 4, 10),
      left: clip(0, 512, 40, LIQUID_HEIGHT, 4, 10)
    },
    attack: {
      right: clip(320, 440, 40, LIQUID_HEIGHT, 5, 8),
      left: clip(320, 512, 40, LIQUID_HEIGHT, 5, 8)
    },
    damage: {
      right: clip(520, 440, 40, LIQUID_HEIGHT, 1, 8),
      left: clip(520, 512, 40, LIQUID_HEIGHT, 1, 8)
    }
  }
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly expValue: number;

  private readonly attackCooldownMs: number;
  private readonly atk: number;
  private readonly defense: number;
  private readonly hurtDurationMs: number;
  private readonly maxHp: number;
  private readonly speed: number;
  private readonly gaugeBack: Phaser.GameObjects.Image;
  private readonly gaugeFront: Phaser.GameObjects.Image;

  private animationFrame = 0;
  private animationState: ClipState = 'move';
  private animationTimerMs = 0;
  private attackTimerMs = 0;
  private attackVisualTimerMs = 0;
  private birdState: BirdState = 'patrol';
  private birdStateTimerMs = 0;
  private direction: 1 | -1 = -1;
  private hp: number;
  private hurtTimerMs = 0;
  private hoverPhase = Math.random() * Math.PI * 2;
  private multiHitCooldownMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    const stats = ENEMY_STATS[kind];
    super(scene, x, y, AssetKey.Enemy);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.spawnX = x;
    this.spawnY = y;
    this.expValue = stats.exp;
    this.attackCooldownMs = stats.attackCooldownMs;
    this.atk = stats.atk;
    this.defense = stats.defense;
    this.hurtDurationMs = stats.hurtDurationMs;
    this.maxHp = stats.hp;
    this.speed = stats.speed;
    this.hp = stats.hp;

    this.configureBody();
    this.applyLegacyCrop(true);

    this.ensureGaugeFrames();
    this.gaugeBack = scene.add
      .image(this.x, this.y, AssetKey.Gauge, gaugeFrameName('back'))
      .setOrigin(0, 0)
      .setDepth(7);
    this.gaugeFront = scene.add
      .image(this.x, this.y, AssetKey.Gauge, gaugeFrameName('front'))
      .setOrigin(0, 0)
      .setDepth(8);
  }

  update(context: EnemyUpdateContext): void {
    if (!this.active) {
      return;
    }

    this.attackTimerMs += context.deltaMs;
    this.attackVisualTimerMs = Math.max(0, this.attackVisualTimerMs - context.deltaMs);
    this.hurtTimerMs = Math.max(0, this.hurtTimerMs - context.deltaMs);
    this.multiHitCooldownMs = Math.max(0, this.multiHitCooldownMs - context.deltaMs);
    if (this.kind === 'bird') {
      this.birdStateTimerMs += context.deltaMs;
    }

    if (this.hurtTimerMs <= 0) {
      this.clearTint();
    } else {
      this.updateHurtMovement();
      this.clampWorldEdges(context.worldLeft, context.worldRight);
      this.applyAnimationState();
      this.updateLegacyAnimation(context.deltaMs);
      this.updateGauge();
      return;
    }

    switch (this.kind) {
      case 'bird':
        this.updateBird(context);
        break;
      case 'slime1':
      case 'slime2':
      case 'slime3':
        this.updateSlime(context);
        break;
      case 'liquid1':
      case 'liquid2':
      case 'liquid3':
        this.updateLiquid(context);
        break;
    }

    this.clampWorldEdges(context.worldLeft, context.worldRight);
    this.applyAnimationState();
    this.updateLegacyAnimation(context.deltaMs);
    this.updateGauge();
  }

  updateFrozen(deltaMs: number): void {
    if (!this.active) {
      return;
    }

    this.setVelocity(0, 0);
    this.attackVisualTimerMs = Math.max(0, this.attackVisualTimerMs - deltaMs);
    this.hurtTimerMs = Math.max(0, this.hurtTimerMs - deltaMs);
    this.multiHitCooldownMs = Math.max(0, this.multiHitCooldownMs - deltaMs);
    if (this.hurtTimerMs <= 0) {
      this.clearTint();
    }
    this.applyAnimationState();
    this.updateLegacyAnimation(deltaMs);
    this.updateGauge();
  }

  damage(power = 1, options: EnemyDamageOptions = {}): { amount: number; defeated: boolean; hit: boolean } {
    if (!this.active) {
      return { amount: 0, defeated: false, hit: false };
    }
    if (this.hurtTimerMs > 0 && this.multiHitCooldownMs > 0) {
      return { amount: 0, defeated: false, hit: false };
    }

    const amount = Math.max(1, Math.round(power / this.defense));
    this.hp -= amount;
    this.hurtTimerMs = this.hurtDurationMs;
    this.multiHitCooldownMs = options.allowDuringHurt ? 90 : 0;
    if (this.kind === 'liquid1' || this.kind === 'liquid2' || this.kind === 'liquid3') {
      this.attackTimerMs = 0;
      this.attackVisualTimerMs = 0;
    }
    this.animationState = 'damage';
    this.animationFrame = 0;
    this.animationTimerMs = 0;
    this.setTint(0xfff1a8);

    const hitKnockback = options.knockback ?? {
      x: (this.direction > 0 ? 1 : -1) * 180,
      y: -180
    };
    this.setVelocity(hitKnockback.x, hitKnockback.y);
    this.applyLegacyCrop(true);

    if (this.hp <= 0) {
      this.defeat();
      return { amount, defeated: true, hit: true };
    }

    return { amount, defeated: false, hit: true };
  }

  get contactDamage(): number {
    return this.atk;
  }

  handlePlayerContact(): void {
    if (this.kind === 'bird' && this.birdState === 'attack') {
      this.startBirdReturn();
    }
  }

  forceDefeat(): void {
    if (!this.active) {
      return;
    }

    this.hp = 0;
    this.defeat();
  }

  override destroy(fromScene?: boolean): void {
    this.gaugeBack.destroy();
    this.gaugeFront.destroy();
    super.destroy(fromScene);
  }

  private applyAnimationState(): void {
    const previousState = this.animationState;

    if (this.hurtTimerMs > 0) {
      this.animationState = 'damage';
    } else if (this.attackVisualTimerMs > 0 && this.getClip('attack')) {
      this.animationState = 'attack';
    } else if (this.getClip('move') && this.kind !== 'liquid1' && this.kind !== 'liquid2' && this.kind !== 'liquid3') {
      this.animationState = 'move';
    } else {
      this.animationState = 'wait';
    }

    if (previousState !== this.animationState) {
      this.animationFrame = 0;
      this.animationTimerMs = 0;
      this.applyLegacyCrop(true);
    }
  }

  private applyLegacyCrop(resetSize = false): void {
    const activeClip = this.getClip(this.animationState) ?? this.getClip('move') ?? this.getClip('wait');
    if (!activeClip) {
      return;
    }

    const directionName: DirectionName = this.direction > 0 ? 'right' : 'left';
    const frame = Math.min(this.animationFrame, activeClip.count - 1);
    this.ensureFrame(this.animationState, directionName, activeClip, frame);
    this.setFrame(frameName(this.kind, this.animationState, directionName, frame));

    if (resetSize || this.displayWidth !== activeClip.width || this.displayHeight !== activeClip.height) {
      this.setScale(1);
    }
  }

  private configureBody(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.kind === 'bird') {
      body.allowGravity = false;
      body.setSize(34, 28);
      body.setOffset(7, 18);
    } else if (this.kind.startsWith('slime')) {
      body.allowGravity = true;
      body.setSize(30, 28);
      body.setOffset(5, 2);
    } else {
      body.allowGravity = true;
      body.setSize(24, 60);
      body.setOffset(8, 6);
    }
  }

  private defeat(): void {
    this.gaugeBack.setVisible(false);
    this.gaugeFront.setVisible(false);
    this.disableBody(true, false);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 12,
      duration: 220,
      onComplete: () => this.destroy()
    });
  }

  private getClip(state: ClipState): LegacyClip | undefined {
    const directionName: DirectionName = this.direction > 0 ? 'right' : 'left';
    return LEGACY_CLIPS[this.kind][state]?.[directionName];
  }

  private ensureFrame(state: ClipState, direction: DirectionName, activeClip: LegacyClip, frame: number): void {
    const texture = this.scene.textures.get(AssetKey.Enemy);
    const key = frameName(this.kind, state, direction, frame);
    if (texture.has(key)) {
      return;
    }

    texture.add(
      key,
      0,
      activeClip.x + frame * activeClip.width,
      activeClip.y,
      activeClip.width,
      activeClip.height
    );
  }

  private ensureGaugeFrames(): void {
    const texture = this.scene.textures.get(AssetKey.Gauge);
    if (!texture.has(gaugeFrameName('back'))) {
      texture.add(gaugeFrameName('back'), 0, 2, 48, 56, 8);
    }
    if (!texture.has(gaugeFrameName('front'))) {
      texture.add(gaugeFrameName('front'), 0, 2, 58, 52, 4);
    }
  }

  private updateBird(context: EnemyUpdateContext): void {
    const dx = context.player.x - this.x;
    const dy = context.player.y - this.y;
    const distance = Math.hypot(dx, dy);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const playerInAttackRange = distance < BIRD_ATTACK_RANGE;

    if (this.birdState === 'attack') {
      this.attackVisualTimerMs = Math.max(this.attackVisualTimerMs, 180);
      body.setSize(48, 34);
      body.setOffset(0, 24);

      const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, context.player.x, context.player.y);
      this.direction = Math.cos(targetAngle) >= 0 ? 1 : -1;
      this.setVelocityX(Math.cos(targetAngle) * BIRD_ATTACK_SPEED);
      this.setVelocityY(Math.sin(targetAngle) * BIRD_ATTACK_SPEED);

      if (this.birdStateTimerMs > 1400 || distance < 18) {
        this.startBirdReturn();
      }
      return;
    }

    body.setSize(34, 28);
    body.setOffset(7, 18);

    if (this.birdState === 'return') {
      const homeDx = this.spawnX - this.x;
      const homeDy = this.spawnY - this.y;
      const homeDistance = Math.hypot(homeDx, homeDy);
      if (homeDistance < 8) {
        this.birdState = 'patrol';
        this.birdStateTimerMs = 0;
        this.setPosition(this.spawnX, this.spawnY);
        this.setVelocity(0, 0);
        return;
      }

      const homeAngle = Math.atan2(homeDy, homeDx);
      this.direction = Math.cos(homeAngle) >= 0 ? 1 : -1;
      this.setVelocityX(Math.cos(homeAngle) * BIRD_RETURN_SPEED);
      this.setVelocityY(Math.sin(homeAngle) * BIRD_RETURN_SPEED);
      return;
    }

    const drift = Math.sin((context.player.scene.time.now / 350) + this.hoverPhase) * 24;
    this.setVelocityX(this.speed * this.direction);
    this.setVelocityY(clamp((this.spawnY + drift - this.y) * 1.5, -70, 70));

    if (Math.abs(this.x - this.spawnX) > 160 || body.blocked.left || body.blocked.right) {
      this.direction *= -1;
    }

    if (playerInAttackRange) {
      this.birdState = 'attack';
      this.birdStateTimerMs = 0;
    }
  }

  private startBirdReturn(): void {
    this.birdState = 'return';
    this.birdStateTimerMs = 0;
    this.attackVisualTimerMs = 0;
  }

  private updateLegacyAnimation(deltaMs: number): void {
    const activeClip = this.getClip(this.animationState);
    if (!activeClip) {
      return;
    }

    this.animationTimerMs += deltaMs;
    const waitMs = frameMs(activeClip.waitFrames);
    while (this.animationTimerMs >= waitMs) {
      this.animationTimerMs -= waitMs;
      this.animationFrame = (this.animationFrame + 1) % activeClip.count;
    }

    this.applyLegacyCrop();
  }

  private updateLiquid(context: EnemyUpdateContext): void {
    const dx = context.player.x - this.x;
    const dy = context.player.y - this.y;
    const distance = Math.hypot(dx, dy);

    this.direction = dx >= 0 ? 1 : -1;
    this.setVelocityX(0);

    if (this.hurtTimerMs > 0 || distance >= 250 || this.attackCooldownMs <= 0) {
      return;
    }

    if (this.attackTimerMs < this.attackCooldownMs) {
      return;
    }

    this.attackTimerMs = 0;
    this.attackVisualTimerMs = 670;
    if (this.kind === 'liquid1') {
      context.spawnBullet('cloud', context.player.x - 24, context.player.y - 216, 0, 0);
    } else if (this.kind === 'liquid2') {
      const targetX = context.player.x;
      const playerBody = context.player.body as Phaser.Physics.Arcade.Body | null;
      const targetY = playerBody?.bottom ?? context.player.y;
      this.scene.time.delayedCall(frameMs(8) * 4, () => {
        if (this.active) {
          context.spawnBullet('rose', targetX, targetY, 0, 0);
        }
      });
    } else {
      context.spawnBullet('flame', this.x + this.direction * 28, this.y -10, this.direction * 90, 0);
    }
  }

  private updateSlime(context: EnemyUpdateContext): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.kind === 'slime2') {
      this.updateJumpingSlime(context, body);
      return;
    }

    if (body.blocked.left) {
      this.direction = 1;
    } else if (body.blocked.right) {
      this.direction = -1;
    } else if ((this.kind === 'slime1' || this.kind === 'slime3') && body.blocked.down && !context.groundAhead(this, this.direction)) {
      this.direction *= -1;
    }

    if (body.blocked.down && this.hurtTimerMs <= 0) {
      this.setVelocityX(this.speed * this.direction);
    }
  }

  private updateJumpingSlime(context: EnemyUpdateContext, body: Phaser.Physics.Arcade.Body): void {
    const dx = context.player.x - this.x;
    const distance = Math.hypot(dx, context.player.y - this.y);

    if (!body.blocked.down) {
      return;
    }

    if (body.blocked.left || body.blocked.right) {
      this.setVelocityX(0);
    }

    if (distance < 250 && distance > 3) {
      if (Math.abs(dx) > 5) {
        this.direction = dx > 0 ? 1 : -1;
        this.setVelocityX(this.direction * this.speed);
      } else {
        this.setVelocityX(0);
      }

      if (this.attackTimerMs >= 3000 && context.spaceAbove(this)) {
        this.setVelocityY(-600);
        this.attackTimerMs = 0;
      }
    } else {
      this.setVelocityX(0);
    }
  }

  private updateHurtMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    this.setVelocityX(body.velocity.x * 0.94);
    if (this.kind === 'bird') {
      this.setVelocityY(body.velocity.y * 0.94);
    }
  }

  private clampWorldEdges(worldLeft: number, worldRight: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    if (body.x < worldLeft) {
      const deltaX = worldLeft - body.x;
      this.x += deltaX;
      body.x += deltaX;
      if (body.velocity.x < 0) {
        body.setVelocityX(0);
      }
      return;
    }

    const maxBodyX = worldRight - body.width;
    if (body.x > maxBodyX) {
      const deltaX = maxBodyX - body.x;
      this.x += deltaX;
      body.x += deltaX;
      if (body.velocity.x > 0) {
        body.setVelocityX(0);
      }
    }
  }

  private updateGauge(): void {
    if (!this.active) {
      return;
    }

    const percent = clamp(this.hp / this.maxHp, 0, 1);
    const gaugeX = Math.round(this.x - 28);
    const gaugeY = Math.round(this.y + this.displayHeight / 2 + 3);

    this.gaugeBack.setPosition(gaugeX, gaugeY);
    this.gaugeFront.setPosition(gaugeX + 2, gaugeY + 2);
    this.gaugeFront.setCrop(0, 0, Math.ceil(52 * percent), 4);
    this.gaugeBack.setVisible(true);
    this.gaugeFront.setVisible(percent > 0);
  }
}
