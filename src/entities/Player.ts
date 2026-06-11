import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import { InputSystem } from '../systems/InputSystem';
import type { PlayerBulletKind } from './PlayerBullet';

const WALK_SPEED = 150;
const DASH_SPEED = 270;
const JUMP_SPEED = -560;
const MAX_FALL_SPEED = 640;
const MAX_JUMPS = 2;
const ARROW1_SP = 0;
const ARROW2_SP = 15;
const SWORD_UPPER_SP = 12;
const SWORD_SPIN_SP = 11;
const SWORD1_SP = 15;
const SWORD2_SP = 16;
const ARROW_BURST_SP = 12;
const CHARGE_DELAY_MS = 500;
const FULL_CHARGE_MS = 800;
const MAX_POTION_COUNT = 9;

type WeaponKind = 'sword1' | 'sword2' | 'sword3' | 'sword4' | 'sword5';
type WeaponMode = 'sword' | 'arrow';
type PotionKind = 'red' | 'blue';
type SpecialActionKind = 'arrow2' | 'arrow3' | 'sword4' | 'sword5' | 'sword6' | 'sword7';

type WeaponState = {
  active: boolean;
  kind: WeaponKind;
  offsetY: number;
};

export type PlayerState = {
  atk: number;
  bluePotions: number;
  exp: number;
  hp: number;
  level: number;
  maxExp: number;
  maxHp: number;
  maxHpBonus?: number;
  maxSp: number;
  redPotions: number;
  sp: number;
  weaponMode: WeaponMode;
};

type LevelStats = {
  atk: number;
  maxExp: number;
  maxHp: number;
  maxSp: number;
};

type AttackProfile = {
  activeEndMs: number;
  activeStartMs: number;
  durationMs: number;
  kind: WeaponKind;
  offsetY: number;
};

type ActionClip = {
  count: number;
  frameRate: number;
  height: number;
  key: string;
  leftY: number;
  repeat?: number;
  rightY: number;
  width: number;
  x: number;
};

type ProjectileRequest = {
  angleDeg: number;
  kind: PlayerBulletKind;
  speed: number;
  x: number;
  y: number;
};

type SpecialAction = {
  activeEndMs: number;
  activeStartMs: number;
  direction: 1 | -1;
  durationMs: number;
  elapsedMs: number;
  endOnGround?: boolean;
  kind: SpecialActionKind;
  projectileFired: boolean;
  projectileFireMs?: number;
  queuedProjectile?: {
    angleDeg: number;
    kind: PlayerBulletKind;
    speed: number;
  };
  queuedProjectiles?: Array<{
    angleDeg: number;
    fireMs: number;
    fired?: boolean;
    kind: PlayerBulletKind;
    speed: number;
  }>;
  transitionFired?: boolean;
  weaponKind?: WeaponKind;
};

const LEVEL_TABLE: Record<number, LevelStats> = {
  1: { maxHp: 6, maxSp: 50, maxExp: 50, atk: 0.8 },
  2: { maxHp: 8, maxSp: 100, maxExp: 70, atk: 1.0 },
  3: { maxHp: 10, maxSp: 130, maxExp: 100, atk: 1.2 },
  4: { maxHp: 10, maxSp: 150, maxExp: 300, atk: 1.6 },
  5: { maxHp: 12, maxSp: 170, maxExp: 500, atk: 2.1 },
  6: { maxHp: 14, maxSp: 190, maxExp: 700, atk: 2.5 },
  7: { maxHp: 16, maxSp: 210, maxExp: 900, atk: 3.0 },
  8: { maxHp: 16, maxSp: 240, maxExp: 1300, atk: 4.5 },
  9: { maxHp: 18, maxSp: 270, maxExp: 1700, atk: 5.0 },
  10: { maxHp: 20, maxSp: 300, maxExp: 2000, atk: 6.0 }
};

const ATTACKS: AttackProfile[] = [
  { kind: 'sword1', durationMs: 230, activeStartMs: 40, activeEndMs: 120, offsetY: -2 },
  { kind: 'sword2', durationMs: 230, activeStartMs: 40, activeEndMs: 120, offsetY: -2 },
  { kind: 'sword3', durationMs: 360, activeStartMs: 110, activeEndMs: 230, offsetY: 0 }
];

const PLAYER_ATTACK_CLIPS = [
  { key: 'player-sword1', x: 0, rightY: 64, leftY: 96, width: 48, height: 32, count: 5, frameRate: 30 },
  { key: 'player-sword2', x: 240, rightY: 64, leftY: 96, width: 48, height: 32, count: 5, frameRate: 30 },
  { key: 'player-sword3', x: 0, rightY: 128, leftY: 160, width: 48, height: 32, count: 5, frameRate: 20 }
];

const PLAYER_SPIN_CLIP = {
  key: 'player-spin',
  x: 608,
  rightY: 0,
  leftY: 32,
  width: 32,
  height: 32,
  count: 7,
  frameRate: 20
};

const PLAYER_SPECIAL_CLIPS: Record<SpecialActionKind, ActionClip> = {
  arrow2: { key: 'player-arrow2', x: 0, rightY: 192, leftY: 224, width: 48, height: 32, count: 3, frameRate: 20 },
  arrow3: { key: 'player-arrow3', x: 0, rightY: 192, leftY: 224, width: 48, height: 32, count: 2, frameRate: 30 },
  sword4: { key: 'player-sword4', x: 240, rightY: 128, leftY: 160, width: 48, height: 32, count: 4, frameRate: 20 },
  sword5: { key: 'player-sword5', x: 384, rightY: 128, leftY: 160, width: 48, height: 32, count: 1, frameRate: 1 },
  sword6: { key: 'player-sword6', x: 480, rightY: 64, leftY: 96, width: 48, height: 32, count: 4, frameRate: 30, repeat: -1 },
  sword7: { key: 'player-sword7', x: 672, rightY: 64, leftY: 96, width: 48, height: 32, count: 5, frameRate: 20 }
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: 1 | -1 = 1;
  private attackElapsedMs = 0;
  private attackHoldMs = 0;
  private attackIndex = -1;
  private chargeMs = 0;
  private charging = false;
  private comboResetTimerMs = 0;
  private invincibilityTimerMs = 0;
  private jumpsRemaining = MAX_JUMPS;
  private levelUpSfxCount = 0;
  private normalAttackSfxRequests: number[] = [];
  private projectileRequests: ProjectileRequest[] = [];
  private queuedAttack = false;
  private specialAction: SpecialAction | null = null;
  private spinTimerMs = 0;
  private spRegenTimerMs = 0;
  private wasOnGround = false;
  private weaponMode: WeaponMode = 'sword';

  atk = LEVEL_TABLE[1].atk;
  hp = LEVEL_TABLE[1].maxHp;
  maxHp = LEVEL_TABLE[1].maxHp;
  private maxHpBonus = 0;
  sp = LEVEL_TABLE[1].maxSp;
  maxSp = LEVEL_TABLE[1].maxSp;
  redPotions = 0;
  bluePotions = 0;
  exp = 0;
  maxExp = LEVEL_TABLE[1].maxExp;
  level = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKey.Player, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setSize(22, 30);
    this.setOffset(5, 1);
    this.setCollideWorldBounds(true);
    this.createAnimations();
  }

  createStateSnapshot(): PlayerState {
    return {
      atk: this.atk,
      bluePotions: this.bluePotions,
      exp: this.exp,
      hp: this.hp,
      level: this.level,
      maxExp: this.maxExp,
      maxHp: this.maxHp,
      maxHpBonus: this.maxHpBonus,
      maxSp: this.maxSp,
      redPotions: this.redPotions,
      sp: this.sp,
      weaponMode: this.weaponMode
    };
  }

  applyStateSnapshot(state: PlayerState): void {
    const level = Phaser.Math.Clamp(state.level, 1, 10);
    const stats = LEVEL_TABLE[level];
    this.level = level;
    this.maxHpBonus = Math.max(0, state.maxHpBonus ?? ((state.maxHp || stats.maxHp) - stats.maxHp));
    this.maxHp = stats.maxHp + this.maxHpBonus;
    this.maxSp = state.maxSp || stats.maxSp;
    this.maxExp = state.maxExp || stats.maxExp;
    this.atk = state.atk || stats.atk;
    this.hp = Phaser.Math.Clamp(state.hp, 0, this.maxHp);
    this.sp = Phaser.Math.Clamp(state.sp, 0, this.maxSp);
    this.exp = Phaser.Math.Clamp(state.exp, 0, this.maxExp);
    this.redPotions = Phaser.Math.Clamp(state.redPotions, 0, MAX_POTION_COUNT);
    this.bluePotions = Phaser.Math.Clamp(state.bluePotions, 0, MAX_POTION_COUNT);
    this.weaponMode = state.weaponMode;
  }

  update(input: InputSystem, deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.limitFallSpeed(body);
    const onGround = body.blocked.down;

    if (onGround && !this.wasOnGround) {
      this.jumpsRemaining = MAX_JUMPS;
      this.spinTimerMs = 0;
    }

    this.updateInvincibility(deltaMs);
    this.updateRecovery(deltaMs);

    if (input.switchWeaponPressed) {
      this.weaponMode = this.weaponMode === 'sword' ? 'arrow' : 'sword';
      this.chargeMs = 0;
      this.charging = false;
    }

    this.updateAttackState(input, deltaMs, onGround);
    this.updateProjectileInputs(input, deltaMs, onGround);

    let velocityX = 0;
    const baseSpeed = input.dashHeld ? WALK_SPEED : DASH_SPEED;
    const moveScale = this.attackIndex >= 0 || this.specialAction ? 0.45 : 1;

    if (input.left) {
      velocityX = -baseSpeed * moveScale;
      this.facing = -1;
    } else if (input.right) {
      velocityX = baseSpeed * moveScale;
      this.facing = 1;
    }

    this.setVelocityX(velocityX);

    if (input.jumpPressed && this.jumpsRemaining > 0) {
      if (this.specialAction?.kind === 'sword4' || this.specialAction?.kind === 'sword5') {
        this.specialAction = null;
      }
      if (this.jumpsRemaining === 1) {
        this.spinTimerMs = 430;
      }
      this.setVelocityY(JUMP_SPEED);
      this.jumpsRemaining -= 1;
    }

    if (this.attackIndex >= 0 || this.specialAction) {
      this.limitFallSpeed(body);
      this.setFlipX(false);
      this.play(this.getActionAnimationKey(), true);
      this.wasOnGround = onGround;
      return;
    }

    this.spinTimerMs = Math.max(0, this.spinTimerMs - deltaMs);
    if (this.spinTimerMs > 0 && !onGround) {
      this.limitFallSpeed(body);
      this.setFlipX(false);
      this.play(this.getSpinAnimationKey(), true);
      this.wasOnGround = onGround;
      return;
    }

    this.setFlipX(this.facing < 0);

    if (!onGround) {
      this.play(body.velocity.y < 0 ? 'player-jump-up' : 'player-jump-down', true);
    } else if (Math.abs(velocityX) > 0) {
      this.play(input.dashHeld ? 'player-walk' : 'player-dash', true);
    } else {
      this.play('player-idle', true);
    }

    this.limitFallSpeed(body);
    this.wasOnGround = onGround;
  }

  consumeProjectileRequests(): ProjectileRequest[] {
    const requests = [...this.projectileRequests];
    this.projectileRequests = [];
    return requests;
  }

  consumeNormalAttackSfxRequests(): number[] {
    const requests = [...this.normalAttackSfxRequests];
    this.normalAttackSfxRequests = [];
    return requests;
  }

  consumeLevelUpSfxCount(): number {
    const count = this.levelUpSfxCount;
    this.levelUpSfxCount = 0;
    return count;
  }

  gainExp(value: number): void {
    this.exp += value;

    while (this.level < 10 && this.exp >= this.maxExp) {
      this.exp -= this.maxExp;
      this.levelUp();
    }

    if (this.level >= 10) {
      this.exp = Math.min(this.exp, this.maxExp);
    }
  }

  levelUp(): boolean {
    if (this.level >= 10) {
      return false;
    }

    this.level += 1;
    const stats = LEVEL_TABLE[this.level];
    // const hpDiff = stats.maxHp - this.maxHp;
    // const spDiff = stats.maxSp - this.maxSp;

    this.maxHp = stats.maxHp + this.maxHpBonus;
    this.maxSp = stats.maxSp;
    this.maxExp = stats.maxExp;
    this.atk = stats.atk;
    this.hp = this.maxHp;
    this.sp = this.maxSp;
    this.levelUpSfxCount += 1;

    return true;
  }

  takeDamage(power: number): boolean {
    if (this.invincibilityTimerMs > 0) {
      return false;
    }

    this.hp = Math.max(0, this.hp - power);
    this.invincibilityTimerMs = 1000;
    this.chargeMs = 0;
    this.charging = false;
    this.setTint(0xff7777);
    this.setVelocityY(-260);
    this.setVelocityX(this.facing * -120);
    return true;
  }

  disableHitbox(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    body.enable = false;
    this.setVelocity(0, 0);
  }

  respawnAt(x: number, y: number): void {
    this.setPosition(x, y);
    this.hp = this.maxHp;
    this.sp = this.maxSp;
    this.attackElapsedMs = 0;
    this.attackHoldMs = 0;
    this.attackIndex = -1;
    this.chargeMs = 0;
    this.charging = false;
    this.comboResetTimerMs = 0;
    this.invincibilityTimerMs = 0;
    this.jumpsRemaining = MAX_JUMPS;
    this.projectileRequests = [];
    this.queuedAttack = false;
    this.specialAction = null;
    this.spinTimerMs = 0;
    this.spRegenTimerMs = 0;
    this.wasOnGround = false;
    this.clearTint();
    this.setAlpha(1);
    this.play('player-idle', true);

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = true;
      body.setVelocity(0, 0);
      body.updateFromGameObject();
    }
  }

  isHitboxEnabled(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    return body?.enable ?? false;
  }

  getChargeRatio(): number {
    return Phaser.Math.Clamp(this.chargeMs / FULL_CHARGE_MS, 0, 1);
  }

  getFacing(): 1 | -1 {
    return this.facing;
  }

  getWeaponMode(): WeaponMode {
    return this.weaponMode;
  }

  recoverSp(amount = 1): void {
    this.sp = Math.min(this.maxSp, this.sp + amount);
  }

  recoverHp(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  increaseMaxHp(amount: number): void {
    this.maxHpBonus += amount;
    this.maxHp += amount;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addPotion(kind: PotionKind): boolean {
    if (kind === 'red') {
      if (this.redPotions >= MAX_POTION_COUNT) {
        return false;
      }
      this.redPotions += 1;
      return true;
    }

    if (this.bluePotions >= MAX_POTION_COUNT) {
      return false;
    }
    this.bluePotions += 1;
    return true;
  }

  useRedPotion(): boolean {
    if (this.redPotions <= 0 || this.hp >= this.maxHp) {
      return false;
    }

    this.redPotions -= 1;
    this.recoverHp(6);
    return true;
  }

  useBluePotion(): boolean {
    if (this.bluePotions <= 0 || this.sp >= this.maxSp) {
      return false;
    }

    this.bluePotions -= 1;
    this.recoverSp(100);
    return true;
  }

  getWeaponState(): WeaponState | null {
    if (this.attackIndex < 0) {
      if (!this.specialAction?.weaponKind) {
        return null;
      }
      if (this.specialAction.elapsedMs < this.specialAction.activeStartMs) {
        return null;
      }

      return {
        kind: this.specialAction.weaponKind,
        offsetY: 0,
        active: this.specialAction.elapsedMs >= this.specialAction.activeStartMs
          && this.specialAction.elapsedMs <= this.specialAction.activeEndMs
      };
    }

    const attack = ATTACKS[this.attackIndex];
    return {
      kind: attack.kind,
      offsetY: attack.offsetY,
      active: this.attackElapsedMs >= attack.activeStartMs && this.attackElapsedMs <= attack.activeEndMs
    };
  }

  private beginAttack(index: number): void {
    this.attackIndex = index;
    this.attackElapsedMs = 0;
    this.queuedAttack = false;
    this.comboResetTimerMs = index === 2 ? 720 : 400;
    this.normalAttackSfxRequests.push(index);
    this.play(this.getAttackAnimationKey(), true);
  }

  private beginSpecialAction(action: Omit<SpecialAction, 'direction' | 'elapsedMs' | 'projectileFired'>): void {
    this.attackIndex = -1;
    this.attackElapsedMs = 0;
    this.queuedAttack = false;
    this.specialAction = {
      ...action,
      direction: this.facing,
      elapsedMs: 0,
      projectileFired: false,
      transitionFired: false
    };
    this.play(this.getActionAnimationKey(), true);
  }

  private consumeSp(amount: number): boolean {
    if (this.sp < amount) {
      return false;
    }

    this.sp -= amount;
    return true;
  }

  private createAnimations(): void {
    const animations = this.scene.anims;

    if (!animations.exists('player-idle')) {
      animations.create({
        key: 'player-idle',
        frames: [{ key: AssetKey.Player, frame: 0 }],
        frameRate: 1
      });
    }
    if (!animations.exists('player-walk')) {
      animations.create({
        key: 'player-walk',
        frames: animations.generateFrameNumbers(AssetKey.Player, { start: 1, end: 8 }),
        frameRate: 10,
        repeat: -1
      });
    }
    if (!animations.exists('player-dash')) {
      animations.create({
        key: 'player-dash',
        frames: animations.generateFrameNumbers(AssetKey.Player, { start: 9, end: 16 }),
        frameRate: 14,
        repeat: -1
      });
    }
    if (!animations.exists('player-jump-up')) {
      animations.create({
        key: 'player-jump-up',
        frames: animations.generateFrameNumbers(AssetKey.Player, { start: 17, end: 18 }),
        frameRate: 8,
        repeat: -1
      });
    }
    if (!animations.exists('player-jump-down')) {
      animations.create({
        key: 'player-jump-down',
        frames: animations.generateFrameNumbers(AssetKey.Player, { start: 26, end: 27 }),
        frameRate: 8,
        repeat: -1
      });
    }
    for (let index = 0; index < PLAYER_ATTACK_CLIPS.length; index += 1) {
      this.createAttackAnimation(index);
    }
    for (const kind of Object.keys(PLAYER_SPECIAL_CLIPS) as SpecialActionKind[]) {
      this.createActionAnimation(PLAYER_SPECIAL_CLIPS[kind]);
    }
    this.createSpinAnimation();
  }

  private createAttackAnimation(index: number): void {
    const clip = PLAYER_ATTACK_CLIPS[index];
    const texture = this.scene.textures.get(AssetKey.Player);
    const animations = this.scene.anims;

    for (const direction of ['right', 'left'] as const) {
      const y = direction === 'right' ? clip.rightY : clip.leftY;
      const frames = [];

      for (let frame = 0; frame < clip.count; frame += 1) {
        const frameKey = `${clip.key}-${direction}-${frame}`;
        if (!texture.has(frameKey)) {
          texture.add(frameKey, 0, clip.x + frame * clip.width, y, clip.width, clip.height);
        }
        frames.push({ key: AssetKey.Player, frame: frameKey });
      }

      const animationKey = `${clip.key}-${direction}`;
      if (!animations.exists(animationKey)) {
        animations.create({
          key: animationKey,
          frames,
          frameRate: clip.frameRate,
          repeat: 0
        });
      }
    }
  }

  private getAttackAnimationKey(): string {
    const index = Math.max(0, this.attackIndex);
    const clip = PLAYER_ATTACK_CLIPS[index] ?? PLAYER_ATTACK_CLIPS[0];
    return `${clip.key}-${this.facing > 0 ? 'right' : 'left'}`;
  }

  private createActionAnimation(clip: ActionClip): void {
    const texture = this.scene.textures.get(AssetKey.Player);
    const animations = this.scene.anims;

    for (const direction of ['right', 'left'] as const) {
      const y = direction === 'right' ? clip.rightY : clip.leftY;
      const frames = [];

      for (let frame = 0; frame < clip.count; frame += 1) {
        const frameKey = `${clip.key}-${direction}-${frame}`;
        if (!texture.has(frameKey)) {
          texture.add(frameKey, 0, clip.x + frame * clip.width, y, clip.width, clip.height);
        }
        frames.push({ key: AssetKey.Player, frame: frameKey });
      }

      const animationKey = `${clip.key}-${direction}`;
      if (!animations.exists(animationKey)) {
        animations.create({
          key: animationKey,
          frames,
          frameRate: clip.frameRate,
          repeat: clip.repeat ?? 0
        });
      }
    }
  }

  private getActionAnimationKey(): string {
    if (this.specialAction) {
      const clip = PLAYER_SPECIAL_CLIPS[this.specialAction.kind];
      return `${clip.key}-${this.facing > 0 ? 'right' : 'left'}`;
    }

    return this.getAttackAnimationKey();
  }

  private createSpinAnimation(): void {
    const texture = this.scene.textures.get(AssetKey.Player);
    const animations = this.scene.anims;

    for (const direction of ['right', 'left'] as const) {
      const y = direction === 'right' ? PLAYER_SPIN_CLIP.rightY : PLAYER_SPIN_CLIP.leftY;
      const frames = [];

      for (let frame = 0; frame < PLAYER_SPIN_CLIP.count; frame += 1) {
        const frameKey = `${PLAYER_SPIN_CLIP.key}-${direction}-${frame}`;
        if (!texture.has(frameKey)) {
          texture.add(
            frameKey,
            0,
            PLAYER_SPIN_CLIP.x + frame * PLAYER_SPIN_CLIP.width,
            y,
            PLAYER_SPIN_CLIP.width,
            PLAYER_SPIN_CLIP.height
          );
        }
        frames.push({ key: AssetKey.Player, frame: frameKey });
      }

      const animationKey = `${PLAYER_SPIN_CLIP.key}-${direction}`;
      if (!animations.exists(animationKey)) {
        animations.create({
          key: animationKey,
          frames,
          frameRate: PLAYER_SPIN_CLIP.frameRate,
          repeat: -1
        });
      }
    }
  }

  private getSpinAnimationKey(): string {
    return `${PLAYER_SPIN_CLIP.key}-${this.facing > 0 ? 'right' : 'left'}`;
  }

  private queueProjectile(kind: PlayerBulletKind, speed: number, angleDeg: number, direction = this.facing): void {
    const legacyLeft = this.x - 16;
    const legacyTop = this.y - 16;
    const spawn = this.getProjectileSpawn(kind, legacyLeft, legacyTop, direction);

    this.projectileRequests.push({
      kind,
      speed,
      angleDeg,
      x: spawn.x,
      y: spawn.y
    });
  }

  private getProjectileSpawn(
    kind: PlayerBulletKind,
    legacyLeft: number,
    legacyTop: number,
    direction: 1 | -1
  ): { x: number; y: number } {
    if (kind === 'arrow1') {
      return {
        x: legacyLeft + (direction > 0 ? 2 : -2) + 16,
        y: legacyTop + 32 / 3 + 8
      };
    }

    if (kind === 'arrow2') {
      return {
        x: legacyLeft + (direction > 0 ? 0 : -16) + 24,
        y: legacyTop + 32 / 3 + 8
      };
    }

    if (kind === 'sword1') {
      return {
        x: legacyLeft + (direction > 0 ? 32 : -16) + 24,
        y: legacyTop - (32 / 3) * 2 + 24
      };
    }

    return {
      x: legacyLeft + (direction > 0 ? 32 : -32) + 16,
      y: legacyTop + 32 - 25 + 12
    };
  }

  private updateAttackState(input: InputSystem, deltaMs: number, onGround: boolean): void {
    this.comboResetTimerMs = Math.max(0, this.comboResetTimerMs - deltaMs);

    if (this.weaponMode !== 'sword') {
      if (this.attackIndex >= 0) {
        this.attackIndex = -1;
        this.attackElapsedMs = 0;
        this.queuedAttack = false;
      }
      return;
    }

    if (this.specialAction) {
      return;
    }

    if (input.attackPressed) {
      if (this.attackIndex < 0) {
        this.beginAttack(0);
      } else if (this.attackIndex < 2) {
        this.queuedAttack = true;
      }
    }

    if (this.attackIndex < 0) {
      return;
    }

    this.attackElapsedMs += deltaMs;
    const attack = ATTACKS[this.attackIndex];
    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (!onGround && this.attackIndex < 2 && body) {
      this.setVelocityX(body.velocity.x * 0.96);
    }

    if (this.attackElapsedMs < attack.durationMs) {
      return;
    }

    if (this.queuedAttack && this.attackIndex < 2) {
      this.beginAttack(this.attackIndex + 1);
      return;
    }

    this.attackIndex = -1;
    this.attackElapsedMs = 0;
    this.queuedAttack = false;
  }

  private updateInvincibility(deltaMs: number): void {
    this.invincibilityTimerMs = Math.max(0, this.invincibilityTimerMs - deltaMs);

    if (this.invincibilityTimerMs <= 0) {
      this.clearTint();
      this.setAlpha(1);
      return;
    }

    this.setAlpha(Math.floor(this.invincibilityTimerMs / 60) % 2 === 0 ? 0.45 : 1);
  }

  private limitFallSpeed(body: Phaser.Physics.Arcade.Body): void {
    if (body.velocity.y > MAX_FALL_SPEED) {
      this.setVelocityY(MAX_FALL_SPEED);
    }
  }

  private updateProjectileInputs(input: InputSystem, deltaMs: number, onGround: boolean): void {
    const attackHeld = input.attackHeld;
    const attackPressed = input.attackPressed;
    const attackReleased = input.attackReleased;
    const specialPressed = input.specialPressed;

    this.updateSpecialActionState(deltaMs, onGround);
    this.updateChargeState(attackHeld, attackReleased, deltaMs);

    if (attackPressed && this.weaponMode === 'arrow' && !this.specialAction) {
      if (this.consumeSp(ARROW1_SP)) {
        this.beginSpecialAction({
          kind: 'arrow2',
          durationMs: 220,
          activeStartMs: 0,
          activeEndMs: 180,
          projectileFireMs: 0,
          queuedProjectile: {
            kind: 'arrow1',
            speed: 620,
            angleDeg: this.facing > 0 ? 0 : 180
          }
        });
      }
    }

    if (attackReleased) {
      const fullCharge = this.charging && this.chargeMs >= FULL_CHARGE_MS;
      if (fullCharge) {
        if (this.weaponMode === 'arrow') {
          if (this.consumeSp(ARROW2_SP)) {
            this.beginSpecialAction({
              kind: 'arrow2',
              durationMs: 220,
              activeStartMs: 0,
              activeEndMs: 180,
              projectileFireMs: 50,
              queuedProjectile: {
                kind: 'arrow2',
                speed: 520,
                angleDeg: this.facing > 0 ? 0 : 180
              }
            });
          }
        } else if (this.consumeSp(SWORD1_SP)) {
          this.beginSpecialAction({
            kind: 'sword7',
            durationMs: 330,
            activeStartMs: 80,
            activeEndMs: 240,
            projectileFireMs: 120,
            queuedProjectile: {
              kind: 'sword1',
              speed: 300,
              angleDeg: this.facing > 0 ? 0 : 180
            }
          });
        }
      }

      this.attackHoldMs = 0;
      this.charging = false;
      this.chargeMs = 0;
    }

    if (this.attackIndex >= 0) {
      return;
    }

    if (this.specialAction) {
      if (
        specialPressed
        && input.spinSlashHeld
        && !onGround
        && this.weaponMode === 'sword'
        && (this.specialAction.kind === 'sword4' || this.specialAction.kind === 'sword5')
        && this.consumeSp(SWORD_SPIN_SP)
      ) {
        this.beginSpecialAction({
          kind: 'sword6',
          durationMs: 5000,
          activeStartMs: 0,
          activeEndMs: 5000,
          endOnGround: true,
          weaponKind: 'sword5'
        });
      }
      return;
    }

    if (specialPressed) {
      this.chargeMs = 0;
      this.charging = false;
      if (this.weaponMode === 'arrow') {
        if (this.consumeSp(ARROW_BURST_SP)) {
          const angles = this.facing > 0 ? [347, 351, 355, 359] : [193, 189, 185, 181];
          this.beginSpecialAction({
            kind: 'arrow3',
            durationMs: 240,
            activeStartMs: 40,
            activeEndMs: 160,
            queuedProjectiles: angles.map((angleDeg, index) => ({
              kind: 'arrow1',
              speed: 600,
              angleDeg,
              fireMs: 40 + index * 33
            }))
          });
        }
      } else if (input.upperSlashHeld && this.consumeSp(SWORD_UPPER_SP)) {
        this.beginSpecialAction({
          kind: 'sword4',
          durationMs: 900,
          activeStartMs: 160,
          activeEndMs: 780,
          weaponKind: 'sword4'
        });
      } else if (input.spinSlashHeld && !onGround && this.consumeSp(SWORD_SPIN_SP)) {
        this.beginSpecialAction({
          kind: 'sword6',
          durationMs: 5000,
          activeStartMs: 0,
          activeEndMs: 5000,
          endOnGround: true,
          weaponKind: 'sword5'
        });
      } else if (this.consumeSp(SWORD2_SP)) {
        this.beginSpecialAction({
          kind: 'sword7',
          durationMs: 330,
          activeStartMs: 80,
          activeEndMs: 240,
          projectileFireMs: 120
        });
      }
    }
  }

  private updateSpecialActionState(deltaMs: number, onGround: boolean): void {
    if (!this.specialAction) {
      return;
    }

    this.specialAction.elapsedMs += deltaMs;

    if (this.specialAction.kind === 'sword4' && !this.specialAction.transitionFired && this.specialAction.elapsedMs >= 160) {
      this.specialAction.kind = 'sword5';
      this.specialAction.transitionFired = true;
      this.setVelocityY(-760);
      this.setVelocityX(this.facing * 70);
      this.play(this.getActionAnimationKey(), true);
    }

    if (this.specialAction.queuedProjectiles) {
      let allFired = true;
      for (const projectile of this.specialAction.queuedProjectiles) {
        if (!projectile.fired && this.specialAction.elapsedMs >= projectile.fireMs) {
          this.queueProjectile(
            projectile.kind,
            projectile.speed,
            projectile.angleDeg,
            this.specialAction.direction
          );
          projectile.fired = true;
        }
        allFired &&= projectile.fired === true;
      }
      this.specialAction.projectileFired = allFired;
    }

    if (
      !this.specialAction.projectileFired
      && this.specialAction.projectileFireMs !== undefined
      && this.specialAction.elapsedMs >= this.specialAction.projectileFireMs
    ) {
      if (this.specialAction.queuedProjectile) {
        const projectile = this.specialAction.queuedProjectile;
        this.queueProjectile(
          projectile.kind,
          projectile.speed,
          projectile.angleDeg,
          this.specialAction.direction
        );
      } else if (this.specialAction.kind === 'sword7') {
        this.queueProjectile('sword2', 280, this.specialAction.direction > 0 ? 0 : 180, this.specialAction.direction);
      }
      this.specialAction.projectileFired = true;
    }

    if (
      this.specialAction.elapsedMs >= this.specialAction.durationMs
      || (this.specialAction.endOnGround && onGround && this.specialAction.elapsedMs > 80)
    ) {
      this.specialAction = null;
    }
  }

  private updateRecovery(deltaMs: number): void {
    this.spRegenTimerMs += deltaMs;
    const intervalMs = Math.max(40, (100 - this.level * 6) * (1000 / 60));

    while (this.spRegenTimerMs >= intervalMs) {
      this.spRegenTimerMs -= intervalMs;
      if (this.sp < this.maxSp) {
        this.sp += 1;
      }
    }
  }

  private updateChargeState(attackHeld: boolean, attackReleased: boolean, deltaMs: number): void {
    if (!attackHeld) {
      if (!attackReleased) {
        this.attackHoldMs = 0;
        this.charging = false;
        this.chargeMs = 0;
      }
      return;
    }

    this.attackHoldMs += deltaMs;
    const delayedChargeMs = Math.max(0, this.attackHoldMs - CHARGE_DELAY_MS);
    this.charging = delayedChargeMs > 0;
    this.chargeMs = Math.min(FULL_CHARGE_MS, delayedChargeMs);
  }
}
