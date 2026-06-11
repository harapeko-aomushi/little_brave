import type { LegacyStageId } from './legacyStages';

export type EnemyKind =
  | 'bird'
  | 'slime1'
  | 'slime2'
  | 'slime3'
  | 'liquid1'
  | 'liquid2'
  | 'liquid3';

export type EnemyBulletKind = 'cloud' | 'lightning' | 'rose' | 'flame' | 'waterball';

export type EnemySpawnDef = {
  kind: EnemyKind;
  x: number;
  y: number;
};

export type EnemyStats = {
  attackCooldownMs: number;
  atk: number;
  defense: number;
  exp: number;
  hp: number;
  hurtDurationMs: number;
  speed: number;
};

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  bird: {
    hp: 1,
    atk: 1,
    defense: 1,
    exp: 3,
    speed: 60,
    hurtDurationMs: 0,
    attackCooldownMs: 0
  },
  slime1: {
    hp: 60,
    atk: 1,
    defense: 1,
    exp: 15,
    speed: 60,
    hurtDurationMs: 833,
    attackCooldownMs: 0
  },
  slime2: {
    hp: 100,
    atk: 2,
    defense: 1.3,
    exp: 40,
    speed: 60,
    hurtDurationMs: 833,
    attackCooldownMs: 0
  },
  slime3: {
    hp: 170,
    atk: 3,
    defense: 1.2,
    exp: 100,
    speed: 120,
    hurtDurationMs: 417,
    attackCooldownMs: 0
  },
  liquid1: {
    hp: 300,
    atk: 1,
    defense: 0.8,
    exp: 120,
    speed: 0,
    hurtDurationMs: 420,
    attackCooldownMs: 3330
  },
  liquid2: {
    hp: 60,
    atk: 1,
    defense: 1,
    exp: 25,
    speed: 0,
    hurtDurationMs: 420,
    attackCooldownMs: 3330
  },
  liquid3: {
    hp: 280,
    atk: 1,
    defense: 0.8,
    exp: 46,
    speed: 0,
    hurtDurationMs: 420,
    attackCooldownMs: 3330
  }
};

export const LEGACY_ENEMY_SPAWNS: Record<LegacyStageId, EnemySpawnDef[]> = {
  0: [
    { x: 650, y: 800, kind: 'slime1' },
    { x: 1360, y: 352, kind: 'slime1' },
    { x: 1320, y: 704, kind: 'slime1' },
    { x: 3160, y: 768, kind: 'slime1' },
    { x: 3700, y: 896, kind: 'slime1' },
    { x: 3800, y: 896, kind: 'slime1' },
    { x: 3900, y: 896, kind: 'slime1' },
    { x: 4000, y: 896, kind: 'slime1' },
    { x: 5180, y: 384, kind: 'slime1' },
    { x: 4950, y: 544, kind: 'slime1' },
    { x: 5180, y: 704, kind: 'slime1' },
    { x: 5700, y: 896, kind: 'slime1' },
    { x: 5760, y: 896, kind: 'slime1' },
    { x: 1400, y: 500, kind: 'bird' },
    { x: 1500, y: 500, kind: 'bird' },
    { x: 1600, y: 500, kind: 'bird' },
    { x: 2900, y: 700, kind: 'bird' },
    { x: 3000, y: 700, kind: 'bird' },
    { x: 4400, y: 50, kind: 'bird' },
    { x: 4300, y: 50, kind: 'bird' },
    { x: 5900, y: 700, kind: 'bird' },
    { x: 6200, y: 668, kind: 'bird' },
    { x: 6500, y: 636, kind: 'bird' },
    { x: 6600, y: 604, kind: 'bird' },
    { x: 2000, y: 416, kind: 'slime1' },
    { x: 1900, y: 416, kind: 'slime1' },
    { x: 2900, y: 896, kind: 'slime1' },
    { x: 3000, y: 896, kind: 'slime1' },
    { x: 4000, y: 256, kind: 'slime1' },
    { x: 4200, y: 256, kind: 'slime1' },
    { x: 5130, y: 224, kind: 'slime1' },
    { x: 5000, y: 384, kind: 'slime1' },
    { x: 5000, y: 704, kind: 'slime1' },
    { x: 3730, y: 616, kind: 'liquid2' },
    { x: 3730, y: 376, kind: 'liquid2' },
    { x: 4100, y: 536, kind: 'liquid2' },
    { x: 5860, y: 800, kind: 'liquid2' },
    { x: 6110, y: 750, kind: 'liquid2' },
    { x: 6360, y: 750, kind: 'liquid2' },
    { x: 9000, y: 416, kind: 'slime2' },
    { x: 9900, y: 416, kind: 'slime2' }
  ],
  1: [
    { x: 940, y: 736, kind: 'slime1' },
    { x: 1709, y: 864, kind: 'slime1' },
    { x: 2152, y: 736, kind: 'slime2' },
    { x: 2036, y: 416, kind: 'slime2' },
    { x: 1988, y: 416, kind: 'slime1' },
    { x: 2320, y: 152, kind: 'liquid2' },
    { x: 2430, y: 198, kind: 'slime2' },
    { x: 2560, y: 832, kind: 'slime1' },
    { x: 2510, y: 832, kind: 'slime1' },
    { x: 2785, y: 256, kind: 'slime2' },
    { x: 2980, y: 251, kind: 'liquid2' },
    { x: 2860, y: 480, kind: 'slime1' },
    { x: 2348, y: 800, kind: 'slime2' },
    { x: 2990, y: 832, kind: 'slime2' },
    { x: 3168, y: 736, kind: 'slime2' },
    { x: 3928, y: 664, kind: 'liquid3' },
    { x: 3712, y: 504, kind: 'liquid3' },
    { x: 3928, y: 344, kind: 'liquid3' },
    { x: 3412, y: 92, kind: 'slime2' },
    { x: 3576, y: 128, kind: 'slime2' },
    { x: 4400, y: 864, kind: 'slime1' },
    { x: 4350, y: 864, kind: 'slime1' },
    { x: 4300, y: 864, kind: 'slime1' },
    { x: 5184, y: 792, kind: 'liquid3' },
    { x: 5132, y: 426, kind: 'slime2' },
    { x: 5244, y: 347, kind: 'liquid3' },
    { x: 6250, y: 896, kind: 'slime1' },
    { x: 6150, y: 896, kind: 'slime2' },
    { x: 6050, y: 896, kind: 'slime1' },
    { x: 5950, y: 896, kind: 'slime2' },
    { x: 5850, y: 896, kind: 'slime1' },
    { x: 5480, y: 728, kind: 'liquid3' },
    { x: 5520, y: 728, kind: 'liquid2' }
  ],
  2: [
    { x: 704, y: 320, kind: 'slime2' },
    { x: 736, y: 448, kind: 'slime2' },
    { x: 128, y: 608, kind: 'slime1' },
    { x: 192, y: 608, kind: 'slime1' },
    { x: 256, y: 608, kind: 'slime1' },
    { x: 448, y: 832, kind: 'slime3' },
    { x: 512, y: 832, kind: 'slime3' },
    { x: 576, y: 832, kind: 'slime3' },
    { x: 1280, y: 832, kind: 'slime2' },
    { x: 1408, y: 832, kind: 'slime2' },
    { x: 1696, y: 664, kind: 'liquid1' },
    { x: 992, y: 536, kind: 'liquid1' },
    { x: 1696, y: 216, kind: 'liquid1' },
    { x: 1856, y: 256, kind: 'slime3' },
    { x: 2016, y: 416, kind: 'slime2' },
    { x: 2272, y: 416, kind: 'slime2' },
    { x: 2176, y: 536, kind: 'liquid1' },
    { x: 2048, y: 696, kind: 'liquid3' },
    { x: 2272, y: 896, kind: 'slime3' },
    { x: 2368, y: 896, kind: 'slime3' },
    { x: 2880, y: 896, kind: 'slime3' },
    { x: 2976, y: 896, kind: 'slime3' },
    { x: 2656, y: 536, kind: 'liquid1' },
    { x: 2912, y: 536, kind: 'liquid2' },
    { x: 2720, y: 288, kind: 'slime1' },
    { x: 2880, y: 288, kind: 'slime2' },
    { x: 3032, y: 288, kind: 'slime3' },
    { x: 3040, y: 128, kind: 'slime2' },
    { x: 6176, y: 576, kind: 'slime3' },
    { x: 6176, y: 416, kind: 'slime3' },
    { x: 5314, y: 64, kind: 'slime2' },
    { x: 5312, y: 224, kind: 'slime2' },
    { x: 5504, y: 352, kind: 'slime3' },
    { x: 5604, y: 352, kind: 'slime3' },
    { x: 4160, y: 120, kind: 'liquid1' },
    { x: 4320, y: 120, kind: 'liquid2' },
    { x: 4256, y: 312, kind: 'liquid3' },
    { x: 4160, y: 352, kind: 'slime3' },
    { x: 4320, y: 352, kind: 'slime2' },
    { x: 4340, y: 352, kind: 'slime1' },
    { x: 4672, y: 352, kind: 'slime3' },
    { x: 4736, y: 352, kind: 'slime3' },
    { x: 4800, y: 352, kind: 'slime3' },
    { x: 4992, y: 352, kind: 'slime3' },
    { x: 4194, y: 575, kind: 'liquid3' },
    { x: 4704, y: 763, kind: 'liquid3' },
    { x: 5218, y: 507, kind: 'liquid3' },
    { x: 4000, y: 224, kind: 'slime2' }
  ]
};
