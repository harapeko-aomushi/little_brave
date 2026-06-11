import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import type { CollectibleKind } from '../data/collectibles';

const frameName = (kind: CollectibleKind): string => `collectible-${kind}`;

export class Collectible extends Phaser.Physics.Arcade.Sprite {
  readonly kind: CollectibleKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: CollectibleKind) {
    const frame = Collectible.ensureFrame(scene, kind);
    const textureKey = kind === 'maxHpHeart' ? AssetKey.Life : AssetKey.Item;
    super(scene, x, y, textureKey, frame);
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

  private static ensureFrame(scene: Phaser.Scene, kind: CollectibleKind): string {
    if (kind === 'maxHpHeart') {
      const texture = scene.textures.get(AssetKey.Life);
      const key = frameName(kind);
      if (!texture.has(key)) {
        texture.add(key, 0, 0, 0, 16, 16);
      }
      return key;
    }

    return frameName(kind);
  }
}
