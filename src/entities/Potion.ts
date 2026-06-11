import Phaser from 'phaser';
import { AssetKey } from '../data/constants';

export type PotionKind = 'red' | 'blue';

const POTION_LIFETIME_MS = 6600;
const frameName = (kind: PotionKind): string => `potion-${kind}`;

export class Potion extends Phaser.Physics.Arcade.Sprite {
  readonly kind: PotionKind;
  private lifetimeMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PotionKind) {
    const frame = Potion.ensureFrame(scene, kind);
    super(scene, x, y, AssetKey.Item, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.setOrigin(0.5);
    this.setDepth(8);
    this.setScale(1.35);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = true;
    body.setSize(16, 16);
    body.setOffset(0, 0);
  }

  update(deltaMs: number): void {
    this.lifetimeMs += deltaMs;
    this.setVisible(this.lifetimeMs < 5000 || Math.floor(this.lifetimeMs / 80) % 2 === 0);
    if (this.lifetimeMs >= POTION_LIFETIME_MS) {
      this.destroy();
    }
  }

  private static ensureFrame(scene: Phaser.Scene, kind: PotionKind): string {
    const texture = scene.textures.get(AssetKey.Item);
    const key = frameName(kind);
    if (!texture.has(key)) {
      texture.add(key, 0, kind === 'red' ? 0 : 16, 8, 16, 16);
    }
    return key;
  }
}
