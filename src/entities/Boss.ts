import Phaser from 'phaser';
import { BOSS_STATS, type BossKind } from '../data/bosses';
import { AssetKey } from '../data/constants';
import type { EnemyBulletKind, EnemyKind } from '../data/enemies';
import type { Player } from './Player';

type BossAct = 0 | 1 | 2 | 3;
type BossState = 'attack1' | 'attack2' | 'attack3' | 'attack4' | 'attack5' | 'damage' | 'move';
type DirectionName = 'left' | 'right';

type BossUpdateContext = {
  deltaMs: number;
  canSummonEnemy: () => boolean;
  player: Player;
  spawnBullet: (
    kind: EnemyBulletKind,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    hasGravity?: boolean
  ) => void;
  playBoss1WaterMotion?: () => void;
  playBoss3AttackMotion?: () => void;
  playBoss3Water?: () => void;
  spawnEnemy: (kind: EnemyKind, x: number, y: number, velocityX: number, velocityY: number) => void;
  worldRight: number;
};

type BossDamageOptions = {
  allowDuringHurt?: boolean;
  knockback?: {
    x: number;
    y: number;
  };
};

type BossClip = {
  count: number;
  height: number;
  waitFrames: number;
  width: number;
  x: number;
  y: number;
};

type BossClipSet = Partial<Record<BossState, Record<DirectionName, BossClip>>>;

const FRAME_MS = 1000 / 60;
const frameMs = (frames: number): number => Math.max(16, frames * FRAME_MS);
const legacySpeed = (speed: number): number => speed * 60;

const clip = (
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  waitFrames: number
): BossClip => ({ x, y, width, height, count: Math.max(1, count), waitFrames });

const frameName = (kind: BossKind, state: BossState, direction: DirectionName, frame: number): string =>
  `${kind}-${state}-${direction}-${frame}`;
const gaugeFrameName = (part: 'back' | 'front'): string => `boss-hp-${part}`;

const BOSS_CLIPS: Record<BossKind, BossClipSet> = {
  boss1: {
    move: {
      right: clip(640, 0, 160, 128, 4, 10),
      left: clip(0, 0, 160, 128, 4, 10)
    },
    damage: {
      right: clip(640, 128, 160, 128, 4, 10),
      left: clip(0, 128, 160, 128, 4, 10)
    }
  },
  boss2: {
    move: {
      right: clip(0, 256, 240, 120, 4, 12),
      left: clip(0, 376, 240, 120, 4, 12)
    },
    attack1: {
      right: clip(0, 512, 240, 232, 1, 12),
      left: clip(240, 512, 240, 232, 1, 12)
    },
    attack2: {
      right: clip(480, 512, 240, 168, 1, 12),
      left: clip(720, 512, 240, 168, 1, 12)
    }
  },
  boss3: {
    move: {
      right: clip(960, 256, 32, 66, 4, 15),
      left: clip(960, 328, 32, 66, 4, 15)
    },
    attack1: {
      right: clip(1088, 256, 32, 66, 4, 10),
      left: clip(1088, 328, 32, 66, 4, 10)
    },
    attack2: {
      right: clip(960, 400, 32, 66, 4, 10),
      left: clip(960, 472, 32, 66, 4, 10)
    },
    attack3: {
      right: clip(1088, 400, 32, 66, 4, 10),
      left: clip(1088, 472, 32, 66, 4, 10)
    },
    attack4: {
      right: clip(960, 544, 32, 66, 4, 10),
      left: clip(960, 616, 32, 66, 4, 10)
    },
    attack5: {
      right: clip(1088, 544, 32, 66, 4, 10),
      left: clip(1088, 616, 32, 66, 4, 10)
    }
  }
};

const BOSS2_RECTS = {
  moveRight: {
    player: new Phaser.Geom.Rectangle(48, 8, 144, 48),
    weapon: new Phaser.Geom.Rectangle(16, 8, 192, 72)
  },
  moveLeft: {
    player: new Phaser.Geom.Rectangle(48, 8, 144, 48),
    weapon: new Phaser.Geom.Rectangle(32, 8, 192, 72)
  },
  attack1Right: {
    player: new Phaser.Geom.Rectangle(80, 32, 56, 160),
    weapon: new Phaser.Geom.Rectangle(80, 32, 56, 160)
  },
  attack1Left: {
    player: new Phaser.Geom.Rectangle(104, 32, 56, 160),
    weapon: new Phaser.Geom.Rectangle(104, 32, 56, 160)
  },
  attack2Right: {
    player: new Phaser.Geom.Rectangle(72, 16, 112, 144),
    weapon: new Phaser.Geom.Rectangle(72, 16, 112, 144)
  },
  attack2Left: {
    player: new Phaser.Geom.Rectangle(72, 16, 112, 144),
    weapon: new Phaser.Geom.Rectangle(72, 16, 112, 144)
  }
} as const;

const BOSS3_TARGETS = [
  { x: 7280, y: 640 },
  { x: 7152, y: 544 },
  { x: 7328, y: 448 },
  { x: 7504, y: 608 },
  { x: 7648, y: 448 },
  { x: 7824, y: 544 },
  { x: 7696, y: 640 }
] as const;

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly expValue: number;
  readonly kind: BossKind;

  private readonly atk: number;
  private readonly defense: number;
  private readonly gaugeBack: Phaser.GameObjects.Image;
  private readonly gaugeFront: Phaser.GameObjects.Image;
  private readonly maxHp: number;

  private act: BossAct = 0;
  private actCount = 0;
  private actSelectCount = 0;
  private animationFrame = 0;
  private animationState: BossState = 'move';
  private animationTimerMs = 0;
  private defeated = false;
  private direction: 1 | -1;
  private hoverDown = false;
  private hoverVelocity = 0;
  private hp: number;
  private hurtTimerMs = 0;
  private multiHitCooldownMs = 0;
  private targetChosen = false;
  private targetIndex = 0;
  private waterballDirection: 1 | -1 = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: BossKind, direction: 1 | -1) {
    const stats = BOSS_STATS[kind];
    super(scene, x, y, AssetKey.Boss);
    this.setOrigin(0, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.direction = direction;
    this.expValue = stats.exp;
    this.atk = stats.atk;
    this.defense = stats.defense;
    this.maxHp = stats.hp;
    this.hp = stats.hp;

    this.setDepth(5);
    this.configureBody();
    this.applyFrame(true);
    this.ensureGaugeFrames();

    this.gaugeBack = scene.add.image(this.x, this.y, AssetKey.Gauge, gaugeFrameName('back'))
      .setOrigin(0, 0)
      .setDepth(7);
    this.gaugeFront = scene.add.image(this.x, this.y, AssetKey.Gauge, gaugeFrameName('front'))
      .setOrigin(0, 0)
      .setDepth(8);
    this.updateGauge();
  }

  get contactDamage(): number {
    return this.atk;
  }

  damage(power = 1, options: BossDamageOptions = {}): { amount: number; defeated: boolean; hit: boolean } {
    if (!this.active || this.defeated) {
      return { amount: 0, defeated: false, hit: false };
    }
    if (this.hurtTimerMs > 0 && this.multiHitCooldownMs > 0) {
      return { amount: 0, defeated: false, hit: false };
    }

    const amount = Math.max(1, Math.round(power / this.defense));
    this.hp -= amount;
    this.hurtTimerMs = 350;
    this.multiHitCooldownMs = options.allowDuringHurt ? 80 : 0;
    this.setTint(0xfff1a8);

    if (this.hp <= 0) {
      this.defeat();
      return { amount, defeated: true, hit: true };
    }

    return { amount, defeated: false, hit: true };
  }

  getContactBounds(): Phaser.Geom.Rectangle {
    if (this.kind === 'boss1') {
      return new Phaser.Geom.Rectangle(this.x + 40, this.y + 40, 80, 88);
    }
    if (this.kind === 'boss2') {
      return this.offsetRect(this.getBoss2Rect().player);
    }
    return new Phaser.Geom.Rectangle(this.x + 8, this.y + 5, 16, 51);
  }

  getDamageBounds(): Phaser.Geom.Rectangle {
    if (this.kind === 'boss2') {
      return this.offsetRect(this.getBoss2Rect().weapon);
    }
    if (this.kind === 'boss3') {
      return new Phaser.Geom.Rectangle(this.x, this.y, 32, 66);
    }
    return new Phaser.Geom.Rectangle(this.x, this.y, 160, 128);
  }

  canCollideWithTerrain(): boolean {
    return this.kind !== 'boss2' || this.animationState === 'attack2';
  }

  setPresentationAlpha(alpha: number): void {
    this.setAlpha(alpha);
    this.gaugeBack.setAlpha(alpha);
    this.gaugeFront.setAlpha(alpha);
  }

  override destroy(fromScene?: boolean): void {
    this.gaugeBack.destroy();
    this.gaugeFront.destroy();
    super.destroy(fromScene);
  }

  update(context: BossUpdateContext): void {
    if (!this.active || this.defeated) {
      return;
    }

    const frames = context.deltaMs / FRAME_MS;
    this.hurtTimerMs = Math.max(0, this.hurtTimerMs - context.deltaMs);
    this.multiHitCooldownMs = Math.max(0, this.multiHitCooldownMs - context.deltaMs);
    if (this.hurtTimerMs <= 0) {
      this.clearTint();
    }

    switch (this.kind) {
      case 'boss1':
        this.updateBoss1(context, frames);
        this.clampBoss1RightEdge(context.worldRight);
        break;
      case 'boss2':
        this.updateBoss2(context, frames);
        break;
      case 'boss3':
        this.updateBoss3(context, frames);
        break;
    }

    this.updateAnimation(context.deltaMs);
    this.updateGauge();
  }

  updateFrozen(deltaMs: number): void {
    if (!this.active || this.defeated) {
      return;
    }

    this.updateAnimation(deltaMs);
    this.updateGauge();
  }

  private configureBody(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocity(720, 720);

    if (this.kind === 'boss1') {
      body.allowGravity = true;
      body.setSize(120, 90);
      body.setOffset(20, 38);
      return;
    }

    body.allowGravity = false;
    if (this.kind === 'boss2') {
      body.setSize(240, 120);
      body.setOffset(0, 0);
    } else {
      body.setSize(16, 51);
      body.setOffset(8, 5);
    }
  }

  private updateBoss1(context: BossUpdateContext, frames: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.actSelectCount = Math.min(100, this.actSelectCount + frames);
      if (this.act === 0 && this.actSelectCount >= 100) {
        const distance = Math.abs(context.player.x - this.x);
        const roll = Phaser.Math.Between(0, 255);
        if (distance >= 200) {
          this.startAct(2);
        } else if (roll <= 120) {
          this.startAct(context.canSummonEnemy() ? 1 : 2);
        } else {
          this.startAct(3);
          context.playBoss1WaterMotion?.();
        }
      }
    } else if (this.act === 0) {
      this.actSelectCount = Math.min(130, this.actSelectCount + frames);
      if (this.actSelectCount >= 130) {
        this.startAct(3);
        context.playBoss1WaterMotion?.();
      }
    }

    if (this.act === 0) {
      if (body.blocked.down) {
        this.setVelocityX(0);
      }
      this.setBossState('move');
      return;
    }

    if (this.act === 1) {
      this.spawnBoss1Helpers(context);
      this.resetAct();
      return;
    }

    if (this.act === 2) {
      if (this.actCount <= 0) {
        const velocityDirection = context.player.x >= this.x ? 1 : -1;
        this.setBossDirection(velocityDirection > 0 ? 1 : -1, true);
        this.setVelocity(velocityDirection * legacySpeed(3), legacySpeed(-6));
      }
      this.actCount += frames;
      if (this.actCount > 8 && body.blocked.down) {
        this.resetAct();
      }
      this.setBossState('move');
      return;
    }

    const previousCount = this.actCount;
    this.actCount += frames;
    this.setVelocityX(0);
    this.spawnBoss1Waterballs(context, previousCount, this.actCount);
    if (this.actCount >= 58) {
      this.resetAct();
    }
  }

  private updateBoss2(context: BossUpdateContext, frames: number): void {
    this.actSelectCount = Math.min(100, this.actSelectCount + frames);
    if (this.act === 0 && this.actSelectCount >= 100) {
      const nextAct: BossAct = Phaser.Math.Between(0, 1) === 0 ? 2 : 1;
      this.startAct(nextAct);
      this.setBossState(nextAct === 2 ? 'attack1' : 'attack2');
    }

    if (this.act === 0) {
      this.setBossState('move');
      this.updateHover(frames);
      this.setVelocityY(this.hoverVelocity * 60);
      return;
    }

    if (this.act === 1) {
      this.updateBoss2Crush(context, frames);
      return;
    }

    this.updateBoss2Slap(context, frames);
  }

  private updateBoss2Crush(context: BossUpdateContext, frames: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const previousCount = this.actCount;
    this.actCount += frames;

    if (previousCount < 130) {
      this.setBossState('attack2');
      const playerCenterX = context.player.x + context.player.displayWidth / 2;
      const playerCenterY = context.player.y + context.player.displayHeight / 2;
      const bossCenterX = this.x + 120;
      const bossCenterY = this.y + 84;
      const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(
        bossCenterX,
        bossCenterY,
        playerCenterX,
        playerCenterY - 300
      ));
      this.setVelocityFromDeg((angle + 360) % 360, legacySpeed(5));
    } else if (this.actCount < 280) {
      if (this.actCount < 279) {
        this.setBossState('attack2');
      } else {
        this.setBossState('move');
      }
      this.setVelocity(0, legacySpeed(8));
      if (body.blocked.down) {
        this.setVelocity(0, 0);
      }
    } else if (this.actCount < 340) {
      this.setBossState('move');
      const angleDeg = this.direction < 0 ? 290 : 250;
      this.setVelocityFromDeg(angleDeg, legacySpeed(3));
    } else {
      this.resetAct();
    }
  }

  private updateBoss2Slap(context: BossUpdateContext, frames: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const playerCenterX = context.player.x + context.player.displayWidth / 2;
    const playerCenterY = context.player.y + context.player.displayHeight / 2;
    const bossCenterX = this.x + 120;
    const bossCenterY = this.y + 116;
    const distance = Math.hypot(playerCenterX - bossCenterX, playerCenterY - bossCenterY);
    let angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(bossCenterX, bossCenterY, playerCenterX, playerCenterY));
    angle = (angle + 360) % 360;

    if (this.actCount === 0) {
      this.setBossState('attack1');
      if (this.direction < 0) {
        if (distance < 200 || ((angle >= 183 && angle <= 360) || (angle >= 0 && angle < 177))) {
          let targetAngle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(
            bossCenterX,
            bossCenterY,
            playerCenterX + 300,
            playerCenterY
          ));
          targetAngle = (targetAngle + 360) % 360;
          this.setVelocityFromDeg(targetAngle, legacySpeed(5));
        } else {
          this.actCount = 1;
          return;
        }
      } else if (distance < 200 || (angle >= 3 && angle <= 357)) {
        let targetAngle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(
          bossCenterX,
          bossCenterY,
          playerCenterX - 300,
          playerCenterY
        ));
        targetAngle = (targetAngle + 360) % 360;
        this.setVelocityFromDeg(targetAngle, legacySpeed(5));
      } else {
        this.actCount = 1;
        return;
      }
      return;
    }

    if (this.actCount === 1) {
      this.setBossState('attack1');
      this.setVelocityY(0);
      if (distance < 400) {
        body.velocity.x += this.direction < 0 ? -legacySpeed(0.3) : legacySpeed(0.3);
      } else {
        this.actCount = 2;
        this.setBossState('move');
        this.setVelocity(0, 0);
        return;
      }
      return;
    }

    this.actCount += frames;
    if (this.actCount < 100) {
      this.setBossState('move');
      this.setVelocityFromDeg(this.direction < 0 ? 290 : 250, legacySpeed(3));
    } else {
      this.resetAct();
    }
  }

  private updateBoss3(context: BossUpdateContext, frames: number): void {
    const wait = this.hp < this.maxHp * 0.3 ? 70 : 140;
    if (this.act === 0) {
      this.actSelectCount += frames;
      if (this.actSelectCount >= wait) {
        const target = this.pickBoss3Target();
        const arrived = this.moveToward(target.x, target.y, Math.max(90, this.distanceTo(target.x, target.y) * 2));
        if (arrived) {
          this.setVelocity(0, 0);
          const roll = Phaser.Math.Between(0, 299);
          if (roll % 10 <= 3) {
            this.startAct(1);
            context.playBoss3AttackMotion?.();
            this.setBossState('attack5');
          } else if (roll % 10 >= 7) {
            this.startAct(2);
            context.playBoss3AttackMotion?.();
            this.setBossState('attack4');
          } else {
            this.startAct(3);
            context.playBoss3AttackMotion?.();
            this.setBossState('attack3');
          }
        }
      } else {
        this.setBossState('move');
        this.updateHover(frames);
        this.setVelocityY(this.hoverVelocity * 60);
      }
      return;
    }

    const previousCount = this.actCount;
    this.actCount += frames;
    this.setVelocity(0, 0);
    if (this.act === 1) {
      this.spawnBoss3Lightning(context, previousCount, this.actCount);
    } else if (this.act === 2) {
      this.spawnBoss3Flames(context, previousCount, this.actCount);
    } else {
      this.spawnBoss3Waterballs(context, previousCount, this.actCount);
    }

    if (this.actCount >= 200) {
      this.resetAct();
    }
  }

  private spawnBoss1Helpers(context: BossUpdateContext): void {
    context.spawnEnemy('slime2', this.x + 35, this.y + 10, legacySpeed(-2), legacySpeed(-5));
    context.spawnEnemy('slime2', this.x + 95, this.y + 10, legacySpeed(2), legacySpeed(-5));
  }

  private spawnBoss1Waterballs(context: BossUpdateContext, previousCount: number, currentCount: number): void {
    for (let frame = Math.floor(previousCount) + 1; frame <= Math.floor(currentCount); frame += 1) {
      if (frame % 8 !== 0) {
        continue;
      }
      const angleDeg = this.waterballDirection < 0 ? 200 : 340;
      const speed = legacySpeed(Phaser.Math.FloatBetween(1, 7));
      const velocityX = Math.cos(Phaser.Math.DegToRad(angleDeg)) * speed * 1.25;
      const velocityY = Math.min(
        Math.sin(Phaser.Math.DegToRad(angleDeg)) * speed,
        -legacySpeed(4)
      );
      context.spawnBullet(
        'waterball',
        this.x + 80,
        this.y + 30,
        velocityX,
        velocityY,
        true
      );
      this.setBossDirection(this.direction > 0 ? -1 : 1, true);
      this.waterballDirection *= -1;
    }
  }

  private clampBoss1RightEdge(worldRight: number): void {
    if (this.kind !== 'boss1') {
      return;
    }

    const maxX = worldRight - this.displayWidth;
    if (this.x <= maxX) {
      return;
    }

    this.x = maxX;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.x = maxX;
      if (body.velocity.x > 0) {
        body.setVelocityX(0);
      }
    }
  }

  private spawnBoss3Lightning(context: BossUpdateContext, previousCount: number, currentCount: number): void {
    const interval = this.hp < this.maxHp * 0.3 ? 30 : 10;
    for (let frame = Math.floor(previousCount) + 1; frame <= Math.floor(currentCount); frame += 1) {
      if (frame <= 50 || frame >= 150 || frame % interval !== 9) {
        continue;
      }
      if (this.hp < this.maxHp * 0.3) {
        for (let offset = -160; offset <= 128; offset += 32) {
          context.spawnBullet('cloud', context.player.x + offset - 24, context.player.y - 216, 0, 0);
        }
      } else {
        context.spawnBullet('cloud', context.player.x - 24, context.player.y - 216, 0, 0);
      }
    }
  }

  private spawnBoss3Flames(context: BossUpdateContext, previousCount: number, currentCount: number): void {
    if (!this.passedFrame(previousCount, currentCount, 80) && !this.passedFrame(previousCount, currentCount, 160)) {
      return;
    }

    const count = this.hp < this.maxHp * 0.3 ? 8 : 4;
    const step = 360 / count;
    for (let index = 0; index < count; index += 1) {
      const angleDeg = 45 + index * step;
      context.spawnBullet(
        'flame',
        context.player.x + Math.cos(Phaser.Math.DegToRad(angleDeg)) * 80,
        context.player.y + Math.sin(Phaser.Math.DegToRad(angleDeg)) * 80,
        0,
        0
      );
    }
  }

  private spawnBoss3Waterballs(context: BossUpdateContext, previousCount: number, currentCount: number): void {
    const events = [
      { frame: 75, angle: 145 },
      { frame: 105, angle: 35 },
      { frame: 135, angle: 260 }
    ];
    const radius = this.hp < this.maxHp * 0.3 ? 150 : 80;
    const speed = legacySpeed(this.hp < this.maxHp * 0.3 ? 5 : 3);
    const centerX = this.x + 16;
    const centerY = this.y + 33;

    for (const event of events) {
      if (!this.passedFrame(previousCount, currentCount, event.frame)) {
        continue;
      }
      context.playBoss3Water?.();
      const spawnX = centerX + Math.cos(Phaser.Math.DegToRad(event.angle)) * radius;
      const spawnY = centerY + Math.sin(Phaser.Math.DegToRad(event.angle)) * radius;
      for (let angleDeg = 0; angleDeg < 360; angleDeg += 10) {
        context.spawnBullet(
          'waterball',
          spawnX,
          spawnY,
          Math.cos(Phaser.Math.DegToRad(angleDeg)) * speed,
          Math.sin(Phaser.Math.DegToRad(angleDeg)) * speed
        );
      }
    }
  }

  private updateHover(frames: number): void {
    if (!this.hoverDown) {
      this.hoverVelocity += 0.1 * frames;
      if (this.hoverVelocity > 2) {
        this.hoverVelocity = 2;
        this.hoverDown = true;
      }
    } else {
      this.hoverVelocity -= 0.1 * frames;
      if (this.hoverVelocity < -2) {
        this.hoverVelocity = -2;
        this.hoverDown = false;
      }
    }
  }

  private startAct(act: BossAct): void {
    this.act = act;
    this.actCount = 0;
  }

  private resetAct(): void {
    this.act = 0;
    this.actCount = 0;
    this.actSelectCount = 0;
    this.targetChosen = false;
    this.setVelocity(0, 0);
    this.setBossState('move');
  }

  private setBossState(state: BossState, forceReset = false): void {
    if (this.animationState === state && !forceReset) {
      return;
    }
    this.animationState = state;
    this.animationFrame = 0;
    this.animationTimerMs = 0;
    this.updateBoss2BodyForState();
    this.applyFrame(true);
  }

  private updateBoss2BodyForState(): void {
    if (this.kind !== 'boss2') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    const height = this.animationState === 'attack1'
      ? 232
      : this.animationState === 'attack2'
        ? 168
        : 120;
    body.setSize(240, height);
    body.setOffset(0, 0);
  }

  private setBossDirection(direction: 1 | -1, resetMoveAnimation = false): void {
    const changed = this.direction !== direction;
    this.direction = direction;

    if (resetMoveAnimation) {
      this.setBossState('move', true);
    } else if (changed) {
      this.applyFrame(true);
    }
  }

  private pickBoss3Target(): { x: number; y: number } {
    if (!this.targetChosen || this.targetIndex >= BOSS3_TARGETS.length) {
      let nextIndex = Phaser.Math.Between(0, BOSS3_TARGETS.length - 1);
      if (nextIndex === this.targetIndex) {
        nextIndex = (nextIndex + 1) % BOSS3_TARGETS.length;
      }
      this.targetIndex = nextIndex;
      this.targetChosen = true;
    }
    return BOSS3_TARGETS[this.targetIndex];
  }

  private moveToward(targetX: number, targetY: number, speed: number): boolean {
    const distance = this.distanceTo(targetX, targetY);
    if (distance <= 4) {
      this.setPosition(targetX, targetY);
      this.setVelocity(0, 0);
      return true;
    }
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.direction = Math.cos(angle) >= 0 ? 1 : -1;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return false;
  }

  private distanceTo(targetX: number, targetY: number): number {
    return Math.hypot(targetX - this.x, targetY - this.y);
  }

  private setVelocityFromDeg(angleDeg: number, speed: number): void {
    this.setVelocity(
      Math.cos(Phaser.Math.DegToRad(angleDeg)) * speed,
      Math.sin(Phaser.Math.DegToRad(angleDeg)) * speed
    );
  }

  private passedFrame(previousCount: number, currentCount: number, frame: number): boolean {
    return previousCount < frame && currentCount >= frame;
  }

  private getBoss2Rect(): { player: Phaser.Geom.Rectangle; weapon: Phaser.Geom.Rectangle } {
    if (this.animationState === 'attack1') {
      return this.direction > 0 ? BOSS2_RECTS.attack1Right : BOSS2_RECTS.attack1Left;
    }
    if (this.animationState === 'attack2') {
      return this.direction > 0 ? BOSS2_RECTS.attack2Right : BOSS2_RECTS.attack2Left;
    }
    return this.direction > 0 ? BOSS2_RECTS.moveRight : BOSS2_RECTS.moveLeft;
  }

  private offsetRect(rect: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x + rect.x, this.y + rect.y, rect.width, rect.height);
  }

  private updateAnimation(deltaMs: number): void {
    const activeClip = this.getClip(this.animationState) ?? this.getClip('move');
    if (!activeClip) {
      return;
    }

    this.animationTimerMs += deltaMs;
    const waitMs = frameMs(activeClip.waitFrames);
    while (this.animationTimerMs >= waitMs) {
      this.animationTimerMs -= waitMs;
      this.animationFrame = (this.animationFrame + 1) % activeClip.count;
    }

    this.applyFrame();
  }

  private applyFrame(resetSize = false): void {
    const activeClip = this.getClip(this.animationState) ?? this.getClip('move');
    if (!activeClip) {
      return;
    }

    const directionName: DirectionName = this.direction > 0 ? 'right' : 'left';
    const frame = Math.min(this.animationFrame, activeClip.count - 1);
    const texture = this.scene.textures.get(AssetKey.Boss);
    const key = frameName(this.kind, this.animationState, directionName, frame);
    if (!texture.has(key)) {
      texture.add(key, 0, activeClip.x + frame * activeClip.width, activeClip.y, activeClip.width, activeClip.height);
    }
    this.setFrame(key);

    if (resetSize) {
      this.setScale(1);
      const body = this.body as Phaser.Physics.Arcade.Body | null;
      body?.updateFromGameObject();
    }
  }

  private getClip(state: BossState): BossClip | undefined {
    const directionName: DirectionName = this.direction > 0 ? 'right' : 'left';
    return BOSS_CLIPS[this.kind][state]?.[directionName];
  }

  private ensureGaugeFrames(): void {
    const texture = this.scene.textures.get(AssetKey.Gauge);
    if (!texture.has(gaugeFrameName('back'))) {
      texture.add(gaugeFrameName('back'), 0, 2, 64, 180, 11);
    }
    if (!texture.has(gaugeFrameName('front'))) {
      texture.add(gaugeFrameName('front'), 0, 2, 77, 176, 7);
    }
  }

  private updateGauge(): void {
    if (!this.active || this.defeated) {
      return;
    }

    const percent = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const gaugeX = Math.round(this.x + this.displayWidth / 2 - 90);
    const gaugeY = Math.round(this.y + this.displayHeight + 3);
    this.gaugeBack.setPosition(gaugeX, gaugeY);
    this.gaugeFront.setPosition(gaugeX + 2, gaugeY + 2);
    this.gaugeFront.setCrop(0, 0, Math.ceil(176 * percent), 7);
    this.gaugeBack.setVisible(true);
    this.gaugeFront.setVisible(percent > 0);
  }

  private defeat(): void {
    this.defeated = true;
    this.gaugeBack.setVisible(false);
    this.gaugeFront.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
    }
    this.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 18,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }
}
