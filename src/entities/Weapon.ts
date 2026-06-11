import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import { Player } from './Player';

type WeaponKind = 'sword1' | 'sword2' | 'sword3' | 'sword4' | 'sword5';

type WeaponFrame = {
  atk: number;
  cropX: number;
  count: number;
  height: number;
  hitbox: Phaser.Geom.Rectangle;
  leftY: number;
  knockbackX: number;
  knockbackY: number;
  waitMs: number;
  width: number;
  rightY: number;
};

const frameName = (kind: WeaponKind, direction: 'left' | 'right', frame: number): string =>
  `weapon-${kind}-${direction}-${frame}`;

const FRAMES: Record<WeaponKind, WeaponFrame> = {
  sword1: {
    width: 56,
    height: 32,
    cropX: 0,
    count: 1,
    rightY: 0,
    leftY: 32,
    waitMs: 1000,
    atk: 7,
    knockbackX: 230,
    knockbackY: -230,
    hitbox: new Phaser.Geom.Rectangle(0, 0, 56, 32)
  },
  sword2: {
    width: 56,
    height: 32,
    cropX: 56,
    count: 1,
    rightY: 0,
    leftY: 32,
    waitMs: 1000,
    atk: 6,
    knockbackX: 230,
    knockbackY: -230,
    hitbox: new Phaser.Geom.Rectangle(0, 0, 56, 32)
  },
  sword3: {
    width: 64,
    height: 32,
    cropX: 112,
    count: 1,
    rightY: 0,
    leftY: 32,
    waitMs: 1000,
    atk: 8,
    knockbackX: 230,
    knockbackY: -230,
    hitbox: new Phaser.Geom.Rectangle(0, 6, 64, 26)
  },
  sword4: {
    width: 32,
    height: 48,
    cropX: 176,
    count: 3,
    rightY: 0,
    leftY: 48,
    waitMs: 66,
    atk: 6,
    knockbackX: 0,
    knockbackY: -600,
    hitbox: new Phaser.Geom.Rectangle(0, 0, 32, 48)
  },
  sword5: {
    width: 96,
    height: 96,
    cropX: 0,
    count: 4,
    rightY: 96,
    leftY: 192,
    waitMs: 33,
    atk: 6,
    knockbackX: 60,
    knockbackY: 170,
    hitbox: new Phaser.Geom.Rectangle(0, 0, 96, 96)
  }
};

export class Weapon extends Phaser.GameObjects.Image {
  private activeKind: WeaponKind | null = null;
  private alphaStep = 0.03;
  private animationFrame = 0;
  private animationTimerMs = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, -999, -999, AssetKey.Weapon);
    scene.add.existing(this);
    this.setVisible(false);
    this.setOrigin(0, 0);
    this.setDepth(7);
  }

  updateFromPlayer(player: Player, deltaMs = 16): void {
    const attack = player.getWeaponState();
    if (!attack) {
      this.activeKind = null;
      this.setVisible(false);
      this.alpha = 1;
      this.animationFrame = 0;
      this.animationTimerMs = 0;
      return;
    }

    if (this.activeKind !== attack.kind) {
      this.animationFrame = 0;
      this.animationTimerMs = 0;
    }

    this.activeKind = attack.kind;
    const frame = FRAMES[attack.kind];
    const direction = player.getFacing() < 0 ? 'left' : 'right';
    this.updateAnimation(frame, deltaMs);
    this.ensureFrame(attack.kind, direction, this.animationFrame);
    this.setVisible(true);
    this.setFrame(frameName(attack.kind, direction, this.animationFrame));
    this.setScale(1);

    const legacyLeft = player.x - 16;
    const legacyTop = player.y - 16;
    if (attack.kind === 'sword4') {
      this.x = player.getFacing() < 0 ? legacyLeft - 24 : legacyLeft + 24;
      this.y = legacyTop + 8;
    } else if (attack.kind === 'sword5') {
      this.x = legacyLeft - 32;
      this.y = legacyTop - 32;
    } else if (player.getFacing() < 0) {
      this.x = legacyLeft + 16 - frame.width;
      this.y = legacyTop + attack.offsetY;
    } else {
      this.x = legacyLeft + 16;
      this.y = legacyTop + attack.offsetY;
    }

    this.alpha = attack.active ? Math.max(0.35, this.alpha - this.alphaStep) : 0.55;
  }

  getDamageRect(player: Player): Phaser.Geom.Rectangle | null {
    const attack = player.getWeaponState();
    if (!this.activeKind || !attack?.active) {
      return null;
    }

    const frame = FRAMES[this.activeKind];
    if (player.getFacing() < 0) {
      return new Phaser.Geom.Rectangle(this.x, this.y + frame.hitbox.y, frame.hitbox.width, frame.hitbox.height);
    }
    return new Phaser.Geom.Rectangle(this.x, this.y + frame.hitbox.y, frame.hitbox.width, frame.hitbox.height);
  }

  getAttackPower(): number {
    return this.activeKind ? FRAMES[this.activeKind].atk : 0;
  }

  getKnockback(player: Player): { x: number; y: number } {
    if (!this.activeKind) {
      return { x: player.getFacing() * 230, y: -230 };
    }

    if (this.activeKind === 'sword4') {
      const body = player.body as Phaser.Physics.Arcade.Body | null;
      return {
        x: body?.velocity.x ?? 0,
        y: FRAMES.sword4.knockbackY
      };
    }

    const frame = FRAMES[this.activeKind];
    return {
      x: player.getFacing() * frame.knockbackX,
      y: frame.knockbackY
    };
  }

  canHitDuringHurt(): boolean {
    return this.activeKind === 'sword4' || this.activeKind === 'sword5';
  }

  private ensureFrame(kind: WeaponKind, direction: 'left' | 'right', animationFrame: number): void {
    const frame = FRAMES[kind];
    const key = frameName(kind, direction, animationFrame);
    const texture = this.scene.textures.get(AssetKey.Weapon);
    if (texture.has(key)) {
      return;
    }

    texture.add(
      key,
      0,
      frame.cropX + animationFrame * frame.width,
      direction === 'left' ? frame.leftY : frame.rightY,
      frame.width,
      frame.height
    );
  }

  private updateAnimation(frame: WeaponFrame, deltaMs: number): void {
    if (frame.count <= 1) {
      this.animationFrame = 0;
      return;
    }

    this.animationTimerMs += deltaMs;
    while (this.animationTimerMs >= frame.waitMs) {
      this.animationTimerMs -= frame.waitMs;
      this.animationFrame = (this.animationFrame + 1) % frame.count;
    }
  }
}
