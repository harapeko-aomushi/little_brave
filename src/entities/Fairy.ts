import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import { Player } from './Player';

export class Fairy extends Phaser.Physics.Arcade.Sprite {
  private bobAngle = 0;
  private activePalette: 'blue' | 'pink' = 'blue';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKey.Fairy, 8);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setDepth(8);
    this.createAnimations();
    this.play('blue-fairy-idle');
  }

  update(target: Player): void {
    this.bobAngle = (this.bobAngle + 4) % 360;
    const palette = target.getWeaponMode() === 'sword' ? 'blue' : 'pink';
    if (palette !== this.activePalette) {
      this.activePalette = palette;
      this.play(`${this.activePalette}-fairy-idle`, true);
    }

    const targetX = target.x + 12;
    const targetY = target.y - 18;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.min(10, (Math.abs(dx) + Math.abs(dy)) / 30);

    this.setVelocity(dx * 2.2, dy * 2.2 + Math.sin(Phaser.Math.DegToRad(this.bobAngle)) * 14);
    this.setFlipX(dx < 0);

    if (distance > 1.5) {
      this.play(`${this.activePalette}-fairy-move`, true);
    } else {
      this.play(`${this.activePalette}-fairy-idle`, true);
    }
  }

  private createAnimations(): void {
    const animations = this.scene.anims;
    if (animations.exists('blue-fairy-idle')) {
      return;
    }

    animations.create({
      key: 'pink-fairy-idle',
      frames: [
        { key: AssetKey.Fairy, frame: 8 },
        { key: AssetKey.Fairy, frame: 9 },
        { key: AssetKey.Fairy, frame: 10 },
        { key: AssetKey.Fairy, frame: 11 }
      ],
      frameRate: 10,
      repeat: -1
    });

    animations.create({
      key: 'pink-fairy-move',
      frames: [
        { key: AssetKey.Fairy, frame: 12 },
        { key: AssetKey.Fairy, frame: 13 }
      ],
      frameRate: 10,
      repeat: -1
    });

    animations.create({
      key: 'blue-fairy-idle',
      frames: [
        { key: AssetKey.Fairy, frame: 16 },
        { key: AssetKey.Fairy, frame: 17 },
        { key: AssetKey.Fairy, frame: 18 },
        { key: AssetKey.Fairy, frame: 19 }
      ],
      frameRate: 10,
      repeat: -1
    });

    animations.create({
      key: 'blue-fairy-move',
      frames: [
        { key: AssetKey.Fairy, frame: 20 },
        { key: AssetKey.Fairy, frame: 21 }
      ],
      frameRate: 10,
      repeat: -1
    });
  }
}
