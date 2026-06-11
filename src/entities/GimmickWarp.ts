import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import type { LegacyGimmickConfig } from '../data/legacyGimmicks';
import type { Player } from './Player';

const WARP_SIZE = 64;
const WARP_FRAME_KEY = 'gimmick-warp';

export class GimmickWarp extends Phaser.GameObjects.Image {
  private readonly targetX: number;
  private readonly targetY: number;
  private pulseMs = 0;

  constructor(scene: Phaser.Scene, config: LegacyGimmickConfig) {
    const x = config.x ?? 0;
    const y = config.y ?? 0;
    super(scene, x + WARP_SIZE / 2, y + WARP_SIZE / 2, AssetKey.Gimmick, GimmickWarp.ensureFrame(scene));
    this.targetX = config.targetX ?? config.x ?? 0;
    this.targetY = config.targetY ?? config.y ?? 0;

    scene.add.existing(this);
    this.setOrigin(0.5);
    this.setDisplaySize(WARP_SIZE, WARP_SIZE);
    this.setDepth(3);
  }

  update(deltaMs: number, player: Player): void {
    this.pulseMs += deltaMs;
    this.rotation += deltaMs * 0.003;
    const nearby = Phaser.Geom.Intersects.RectangleToRectangle(
      this.getWarpBounds(),
      new Phaser.Geom.Rectangle(player.x - 80, player.y - 80, 160, 160)
    );
    this.setAlpha(nearby ? 0.55 + Math.sin(this.pulseMs / 80) * 0.25 : 0.85);
  }

  overlapsPlayer(player: Player): boolean {
    return Phaser.Geom.Intersects.RectangleToRectangle(this.getWarpBounds(), player.getBounds());
  }

  getTargetPosition(): { x: number; y: number } {
    return {
      x: this.targetX + 16,
      y: this.targetY + 16
    };
  }

  teleport(player: Player): void {
    const target = this.getTargetPosition();
    player.setPosition(target.x, target.y);
    player.setVelocity(0, 0);
    const body = player.body as Phaser.Physics.Arcade.Body | null;
    body?.updateFromGameObject();
  }

  private getWarpBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - WARP_SIZE / 2, this.y - WARP_SIZE / 2, WARP_SIZE, WARP_SIZE);
  }

  private static ensureFrame(scene: Phaser.Scene): string {
    const texture = scene.textures.get(AssetKey.Gimmick);
    if (!texture.has(WARP_FRAME_KEY)) {
      texture.add(WARP_FRAME_KEY, 0, 1, 27, WARP_SIZE, WARP_SIZE);
    }
    return WARP_FRAME_KEY;
  }
}
