import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import type { EnemyBulletKind } from '../data/enemies';
import type { Player } from './Player';

type SpawnEnemyBullet = (
  kind: EnemyBulletKind,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  hasGravity?: boolean
) => void;

type BulletClip = {
  count: number;
  height: number;
  waitMs: number;
  width: number;
  x: number;
  y: number;
};

const FRAME_MS = 1000 / 60;
const clip = (x: number, y: number, width: number, height: number, count: number, waitFrames: number): BulletClip => ({
  x,
  y,
  width,
  height,
  count,
  waitMs: Math.max(16, waitFrames * FRAME_MS)
});

const CLOUD_CLIP = clip(0, 0, 48, 24, 10, 5);
const FLAME_START_CLIP = clip(0, 24, 16, 24, 5, 5);
const FLAME_CHASE_CLIP = clip(64, 24, 16, 24, 4, 5);
const FLAME_END_CLIP = clip(0, 48, 16, 24, 5, 5);
const LIGHTNING_CLIP = clip(160, 24, 24, 128, 6, 5);
const ROSE_CLIP = clip(128, 24, 24, 56, 1, 5);
const ROSE_MAGIC_CLIP = clip(129, 110, 22, 10, 1, 5);
const ROSE_SOIL_CLIPS = [
  clip(129, 85, 22, 5, 1, 5),
  clip(129, 95, 22, 5, 1, 5),
  clip(129, 105, 22, 5, 1, 5)
] as const;
const ROSE_MAGIC_FADE_MS = 420;
const ROSE_SOIL_FRAME_MS = 160;
const ROSE_HOLD_MS = 10000;
const ROSE_BLINK_MS = 2000;
const ROSE_GROW_PIXELS_PER_MS = 0.055;
const WATERBALL_MOVE_CLIP = clip(0, 72, 32, 32, 4, 3);
const WATERBALL_END_CLIP = clip(0, 104, 32, 32, 4, 3);

const frameName = (kind: EnemyBulletKind, state: string, frame: number): string =>
  `enemy-bullet-${kind}-${state}-${frame}`;

type RoseState = 'magic' | 'soil' | 'grow';
type WaterballState = 'end' | 'move';
type CloudState = 'start' | 'warn' | 'strike';
type LightningState = 'fall' | 'end';

export class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyBulletKind;
  readonly power: number;

  private animationFrame = 0;
  private animationTimerMs = 0;
  private cloudTimerMs = 0;
  private cloudState: CloudState = 'start';
  private cloudX = 0;
  private cloudY = 0;
  private flameState: 'start' | 'chase' | 'end' = 'start';
  private hasSpawnedLightning = false;
  private lifetimeFrames = 0;
  private lightningHeight = 8;
  private lightningState: LightningState = 'fall';
  private roseHoldMs = 0;
  private roseHeight = 0;
  private roseBlinkMs = 0;
  private roseSoilBase?: Phaser.GameObjects.Image;
  private roseState: RoseState = 'magic';
  private roseTimerMs = 0;
  private roseDestroying = false;
  private waterballHasGravity = false;
  private waterballReflected = false;
  private waterballVelocityX = 0;
  private waterballVelocityY = 0;
  private waterballState: WaterballState = 'move';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyBulletKind,
    velocityX: number,
    velocityY: number,
    hasGravity = false
  ) {
    const startFrame = EnemyBullet.ensureFrame(scene, kind, EnemyBullet.initialClip(kind), 0, EnemyBullet.initialState(kind));
    super(scene, x, y, AssetKey.EnemyBullet, startFrame);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.power = kind === 'cloud' ? 0 : kind === 'lightning' ? 3 : kind === 'waterball' ? 1 : 2;
    this.cloudX = x;
    this.cloudY = y;
    this.waterballHasGravity = hasGravity;
    this.waterballVelocityX = kind === 'waterball' ? velocityX : 0;
    this.waterballVelocityY = kind === 'waterball' ? velocityY : 0;

    this.setDepth(6);
    this.configureBody(velocityX, velocityY);
  }

  update(deltaMs: number, player: Player, spawnBullet: SpawnEnemyBullet): void {
    if (!this.active) {
      return;
    }

    switch (this.kind) {
      case 'cloud':
        this.updateCloud(deltaMs, spawnBullet);
        break;
      case 'lightning':
        this.updateLightning(deltaMs);
        break;
      case 'rose':
        this.updateRose(deltaMs);
        break;
      case 'flame':
        this.updateFlame(deltaMs, player);
        break;
      case 'waterball':
        this.updateWaterball(deltaMs);
        break;
    }
  }

  updateFrozen(deltaMs: number): void {
    if (!this.active) {
      return;
    }

    switch (this.kind) {
      case 'cloud':
        this.setPosition(this.cloudX, this.cloudY);
        this.updateAnimation(deltaMs, CLOUD_CLIP);
        break;
      case 'lightning':
        this.updateAnimation(deltaMs, LIGHTNING_CLIP);
        break;
      case 'rose':
        this.updateRose(deltaMs);
        break;
      case 'flame':
        this.updateFrozenFlame(deltaMs);
        break;
      case 'waterball':
        this.updateFrozenWaterball(deltaMs);
        break;
    }
  }

  canHitPlayer(): boolean {
    return this.kind !== 'cloud'
      && !(this.kind === 'flame' && this.flameState === 'end')
      && !(this.kind === 'lightning' && this.lightningState === 'end')
      && !(this.kind === 'rose' && (this.roseDestroying || this.roseState !== 'grow'))
      && !(this.kind === 'waterball' && this.waterballState === 'end');
  }

  hitPlayer(): void {
    if (this.kind === 'flame') {
      this.startFlameEnd();
    } else if (this.kind === 'lightning') {
      this.startLightningEnd();
    } else if (this.kind === 'waterball') {
      this.startWaterballEnd();
    }
  }

  hitTerrain(): void {
    if (this.kind === 'flame') {
      this.startFlameEnd();
    } else if (this.kind === 'lightning') {
      this.startLightningEnd();
    } else if (this.kind === 'waterball') {
      this.handleWaterballTerrainHit();
    }
  }

  destroyByPlayer(): void {
    if (this.kind === 'flame') {
      this.startFlameEnd();
      return;
    }

    if (this.kind === 'waterball') {
      this.startWaterballEnd();
      return;
    }

    if (this.kind !== 'rose' || this.roseDestroying || !this.active) {
      return;
    }

    this.roseDestroying = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.scene.tweens.add({
      targets: [this, this.roseSoilBase].filter(Boolean),
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }

  override destroy(fromScene?: boolean): void {
    this.roseSoilBase?.destroy();
    this.roseSoilBase = undefined;
    super.destroy(fromScene);
  }

  private static initialClip(kind: EnemyBulletKind): BulletClip {
    switch (kind) {
      case 'cloud':
        return CLOUD_CLIP;
      case 'lightning':
        return LIGHTNING_CLIP;
      case 'rose':
        return ROSE_CLIP;
      case 'flame':
        return FLAME_START_CLIP;
      case 'waterball':
        return WATERBALL_MOVE_CLIP;
    }
  }

  private static initialState(kind: EnemyBulletKind): string {
    return kind === 'flame' ? 'start' : 'main';
  }

  private static ensureFrame(
    scene: Phaser.Scene,
    kind: EnemyBulletKind,
    activeClip: BulletClip,
    frame: number,
    state = 'main'
  ): string {
    const texture = scene.textures.get(AssetKey.EnemyBullet);
    const key = frameName(kind, state, frame);
    if (!texture.has(key)) {
      texture.add(key, 0, activeClip.x + frame * activeClip.width, activeClip.y, activeClip.width, activeClip.height);
    }
    return key;
  }

  private configureBody(velocityX: number, velocityY: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocity(velocityX, velocityY);

    if (this.kind === 'cloud') {
      this.setOrigin(0, 0);
      body.enable = false;
      return;
    }

    if (this.kind === 'lightning') {
      this.setOrigin(0.5, 0);
      this.lightningHeight = LIGHTNING_CLIP.height;
      this.setScale(1, this.lightningHeight / LIGHTNING_CLIP.height);
      body.setSize(18, this.lightningHeight);
      body.setOffset(3, 0);
      body.setVelocity(velocityX, velocityY || 360);
      return;
    }

    if (this.kind === 'rose') {
      this.setOrigin(0.5, 1);
      this.setRoseEffectFrame('magic', 0);
      this.setAlpha(0);
      body.enable = false;
      body.setSize(18, 2);
      body.setOffset(3, 0);
      return;
    }

    if (this.kind === 'waterball') {
      this.setOrigin(0.5);
      this.setFlipX(velocityX < 0);
      body.setSize(20, 20);
      body.setOffset(6, 6);
      return;
    }

    if (this.kind === 'flame') {
      this.setOrigin(0.5);
      this.setFlipX(velocityX < 0);
      body.setVelocity(0, 0);
      body.setSize(14, 20);
      body.setOffset(1, 2);
      return;
    }

    this.setOrigin(0.5);
    this.setFlipX(velocityX < 0);
    body.setSize(14, 20);
    body.setOffset(1, 2);
  }

  private updateAnimation(deltaMs: number, activeClip: BulletClip, state = 'main', loop = true): boolean {
    this.animationTimerMs += deltaMs;
    let finished = false;
    while (this.animationTimerMs >= activeClip.waitMs) {
      this.animationTimerMs -= activeClip.waitMs;
      if (this.animationFrame >= activeClip.count - 1) {
        finished = true;
        this.animationFrame = loop ? 0 : activeClip.count - 1;
      } else {
        this.animationFrame += 1;
      }
    }

    const key = EnemyBullet.ensureFrame(this.scene, this.kind, activeClip, this.animationFrame, state);
    this.setFrame(key);
    return finished;
  }

  private updateAnimationRange(
    deltaMs: number,
    activeClip: BulletClip,
    startFrame: number,
    endFrame: number,
    state = 'main',
    loop = true
  ): boolean {
    if (this.animationFrame < startFrame || this.animationFrame > endFrame) {
      this.animationFrame = startFrame;
      this.animationTimerMs = 0;
    }

    this.animationTimerMs += deltaMs;
    let finished = false;
    while (this.animationTimerMs >= activeClip.waitMs) {
      this.animationTimerMs -= activeClip.waitMs;
      if (this.animationFrame >= endFrame) {
        finished = true;
        this.animationFrame = loop ? startFrame : endFrame;
      } else {
        this.animationFrame += 1;
      }
    }

    const key = EnemyBullet.ensureFrame(this.scene, this.kind, activeClip, this.animationFrame, state);
    this.setFrame(key);
    return finished;
  }

  private updateCloud(deltaMs: number, spawnBullet: SpawnEnemyBullet): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocity(0, 0);
    }
    this.setPosition(this.cloudX, this.cloudY);
    this.cloudTimerMs += deltaMs;

    if (this.cloudState === 'start') {
      const finished = this.updateAnimationRange(deltaMs, CLOUD_CLIP, 0, 2, 'main', false);
      if (finished) {
        this.cloudState = 'warn';
        this.animationFrame = 3;
        this.animationTimerMs = 0;
      }
    } else if (this.cloudState === 'warn') {
      this.updateAnimationRange(deltaMs, CLOUD_CLIP, 3, 5);
    } else {
      const finished = this.updateAnimationRange(deltaMs, CLOUD_CLIP, 6, CLOUD_CLIP.count - 1, 'main', false);
      if (finished) {
        this.destroy();
      }
    }

    if (this.cloudTimerMs >= 1000 && !this.hasSpawnedLightning) {
      this.hasSpawnedLightning = true;
      this.cloudState = 'strike';
      this.animationFrame = 6;
      this.animationTimerMs = 0;
      spawnBullet('lightning', this.x + CLOUD_CLIP.width / 4 + 10, this.y + CLOUD_CLIP.height - 1, 0, 360);
    }
  }

  private updateLightning(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.applyLightningHeight();

    if (this.lightningState === 'end') {
      body.setVelocity(0, 0);
      const finished = this.updateAnimationRange(deltaMs, LIGHTNING_CLIP, 3, 5, 'main', false);
      if (finished) {
        this.destroy();
      }
      return;
    }

    this.updateAnimationRange(deltaMs, LIGHTNING_CLIP, 0, 2);
    if (body.velocity.y === 0) {
      body.setVelocityY(360);
    }
    this.lifetimeFrames += deltaMs / FRAME_MS;
    if (this.lifetimeFrames >= 180) {
      this.startLightningEnd();
    }
  }

  private startLightningEnd(): void {
    if (this.lightningState === 'end' || !this.active) {
      return;
    }

    this.lightningState = 'end';
    this.animationFrame = 3;
    this.animationTimerMs = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  setLightningHeight(height: number): void {
    if (this.kind !== 'lightning' || !this.active) {
      return;
    }

    this.lightningHeight = Phaser.Math.Clamp(Math.round(height), 8, LIGHTNING_CLIP.height);
    this.applyLightningHeight();
  }

  private applyLightningHeight(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setScale(1, this.lightningHeight / LIGHTNING_CLIP.height);
    body.setSize(18, this.lightningHeight);
    body.setOffset(3, 0);
  }

  private updateRose(deltaMs: number): void {
    if (this.roseDestroying) {
      return;
    }

    if (this.roseState === 'magic') {
      this.roseTimerMs += deltaMs;
      this.setAlpha(Phaser.Math.Clamp(this.roseTimerMs / ROSE_MAGIC_FADE_MS, 0, 1));

      if (this.roseTimerMs >= ROSE_MAGIC_FADE_MS) {
        this.roseState = 'soil';
        this.roseTimerMs = 0;
        this.setAlpha(1);
        this.setRoseEffectFrame('soil', 0);
      }
      return;
    }

    if (this.roseState === 'soil') {
      this.roseTimerMs += deltaMs;
      const soilFrame = Math.min(
        ROSE_SOIL_CLIPS.length - 1,
        Math.floor(this.roseTimerMs / ROSE_SOIL_FRAME_MS)
      );
      this.setRoseEffectFrame('soil', soilFrame);

      if (this.roseTimerMs >= ROSE_SOIL_FRAME_MS * ROSE_SOIL_CLIPS.length) {
        this.roseState = 'grow';
        this.roseTimerMs = 0;
        this.roseHeight = 1;
        this.roseHoldMs = 0;
        this.roseBlinkMs = 0;
        const soilKey = this.setRoseEffectFrame('soil', ROSE_SOIL_CLIPS.length - 1);
        this.roseSoilBase = this.scene.add.image(this.x, this.y, AssetKey.EnemyBullet, soilKey)
          .setOrigin(0.5, 1)
          .setDepth(this.depth + 0.1);
        this.setRoseFrame(this.roseHeight);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.enable = true;
        body.setSize(18, 2);
        body.setOffset(3, 0);
      }
      return;
    }

    if (this.roseHeight < ROSE_CLIP.height) {
      this.roseHeight = Math.min(ROSE_CLIP.height, this.roseHeight + deltaMs * ROSE_GROW_PIXELS_PER_MS);
    } else if (this.roseHoldMs < ROSE_HOLD_MS) {
      this.roseHoldMs += deltaMs;
    } else if (this.roseBlinkMs < ROSE_BLINK_MS) {
      this.roseBlinkMs += deltaMs;
      const visible = Math.floor(this.roseBlinkMs / 30) % 2 === 0;
      this.setVisible(visible);
      this.roseSoilBase?.setVisible(visible);
    } else {
      this.destroy();
      return;
    }

    if (this.roseBlinkMs <= 0) {
      this.setVisible(true);
      this.roseSoilBase?.setVisible(true);
    }

    this.setRoseFrame(Math.max(1, this.roseHeight));

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, Math.max(2, this.roseHeight));
    body.setOffset(3, 0);
  }

  private setRoseEffectFrame(state: 'magic' | 'soil', frame: number): string {
    const activeClip = state === 'magic' ? ROSE_MAGIC_CLIP : ROSE_SOIL_CLIPS[frame] ?? ROSE_SOIL_CLIPS[0];
    const texture = this.scene.textures.get(AssetKey.EnemyBullet);
    const key = `enemy-bullet-rose-${state}-${frame}`;
    if (!texture.has(key)) {
      texture.add(key, 0, activeClip.x, activeClip.y, activeClip.width, activeClip.height);
    }
    this.setFrame(key);
    return key;
  }

  private setRoseFrame(height: number): void {
    const frameHeight = Math.max(1, Math.min(ROSE_CLIP.height, Math.round(height)));
    const texture = this.scene.textures.get(AssetKey.EnemyBullet);
    const key = `enemy-bullet-rose-grow-${frameHeight}`;
    if (!texture.has(key)) {
      texture.add(
        key,
        0,
        ROSE_CLIP.x,
        ROSE_CLIP.y + ROSE_CLIP.height - frameHeight,
        ROSE_CLIP.width,
        frameHeight
      );
    }
    this.setFrame(key);
  }

  private updateFlame(deltaMs: number, player: Player): void {
    if (this.flameState === 'start') {
      this.setVelocity(0, 0);
      const finished = this.updateAnimation(deltaMs, FLAME_START_CLIP, 'start', false);
      if (finished) {
        this.flameState = 'chase';
        this.animationFrame = 0;
        this.animationTimerMs = 0;
      }
      return;
    }

    if (this.flameState === 'end') {
      const finished = this.updateAnimation(deltaMs, FLAME_END_CLIP, 'end', false);
      if (finished) {
        this.destroy();
      }
      return;
    }

    this.updateAnimation(deltaMs, FLAME_CHASE_CLIP, 'chase');
    this.lifetimeFrames += 1;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y - 20);
    const speed = 90;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setFlipX(body.velocity.x < 0);

    if (this.lifetimeFrames >= 400) {
      this.startFlameEnd();
    }
  }

  private updateFrozenFlame(deltaMs: number): void {
    if (this.flameState === 'start') {
      const finished = this.updateAnimation(deltaMs, FLAME_START_CLIP, 'start', false);
      if (finished) {
        this.flameState = 'chase';
        this.animationFrame = 0;
        this.animationTimerMs = 0;
      }
      return;
    }

    if (this.flameState === 'end') {
      const finished = this.updateAnimation(deltaMs, FLAME_END_CLIP, 'end', false);
      if (finished) {
        this.destroy();
      }
      return;
    }

    this.updateAnimation(deltaMs, FLAME_CHASE_CLIP, 'chase');
  }

  private startFlameEnd(): void {
    if (this.flameState === 'end') {
      return;
    }

    this.flameState = 'end';
    this.animationFrame = 0;
    this.animationTimerMs = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  private updateWaterball(deltaMs: number): void {
    if (this.waterballState === 'end') {
      const finished = this.updateAnimation(deltaMs, WATERBALL_END_CLIP, 'end', false);
      if (finished) {
        this.destroy();
      }
      return;
    }

    this.updateAnimation(deltaMs, WATERBALL_MOVE_CLIP);
    this.lifetimeFrames += deltaMs / FRAME_MS;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.waterballHasGravity) {
      this.waterballVelocityY += 720 * (deltaMs / 1000);
    }
    body.setVelocity(this.waterballVelocityX, this.waterballVelocityY);
    this.setFlipX(body.velocity.x < 0);

    if (this.lifetimeFrames > 200) {
      this.setVisible(Math.floor(this.lifetimeFrames / 4) % 2 === 0);
    }
    if (this.lifetimeFrames > 250) {
      this.destroy();
    }
  }

  private updateFrozenWaterball(deltaMs: number): void {
    if (this.waterballState === 'end') {
      const finished = this.updateAnimation(deltaMs, WATERBALL_END_CLIP, 'end', false);
      if (finished) {
        this.destroy();
      }
      return;
    }

    this.updateAnimation(deltaMs, WATERBALL_MOVE_CLIP);
  }

  private startWaterballEnd(): void {
    if (this.waterballState === 'end' || !this.active) {
      return;
    }

    this.waterballState = 'end';
    this.animationFrame = 0;
    this.animationTimerMs = 0;
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }

  private handleWaterballTerrainHit(): void {
    if (this.waterballState === 'end' || !this.active) {
      return;
    }

    if (this.waterballHasGravity || this.waterballReflected) {
      this.startWaterballEnd();
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitHorizontal = body.blocked.left || body.blocked.right || body.touching.left || body.touching.right;
    const hitVertical = body.blocked.up || body.blocked.down || body.touching.up || body.touching.down;

    if (hitHorizontal || !hitVertical) {
      this.waterballVelocityX *= -1;
    }
    if (hitVertical || !hitHorizontal) {
      this.waterballVelocityY *= -1;
    }

    this.waterballReflected = true;
    this.setFlipX(this.waterballVelocityX < 0);
    body.setVelocity(this.waterballVelocityX, this.waterballVelocityY);
  }
}
