import type { LegacyStageId } from './legacyStages';

export type CollectibleKind = 'maxHpHeart';

type PixelCollectibleSpawn = {
  kind: CollectibleKind;
  x: number;
  y: number;
};

type TileCollectibleSpawn = {
  kind: CollectibleKind;
  tileX: number;
  tileY: number;
};

export type CollectibleSpawn = PixelCollectibleSpawn | TileCollectibleSpawn;

export const LEGACY_COLLECTIBLE_SPAWNS: Record<LegacyStageId, CollectibleSpawn[]> = {
  0: [
    { kind: 'maxHpHeart', tileX: 80, tileY: 12 },
    { kind: 'maxHpHeart', tileX: 170, tileY: 3 }
  ],
  1: [
    { kind: 'maxHpHeart', tileX: 9, tileY: 3 },
    { kind: 'maxHpHeart', tileX: 94, tileY: 2 }
  ],
  2: [
    { kind: 'maxHpHeart', tileX: 110, tileY: 26 },
    { kind: 'maxHpHeart', tileX: 197, tileY: 24 }
  ]
};
