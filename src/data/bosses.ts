import type { LegacyStageId } from './legacyStages';

export type BossKind = 'boss1' | 'boss2' | 'boss3';

export type BossSpawnDef = {
  direction: 1 | -1;
  kind: BossKind;
  x: number;
  y: number;
};

export type BossStats = {
  atk: number;
  defense: number;
  exp: number;
  hp: number;
};

export type BossEncounterConfig = {
  fadeDelayMs: number;
  fadeDurationMs: number;
  lockLeftX: number;
  triggerLeadX?: number;
  triggerWhenMapRightReached?: boolean;
};

export const BOSS_ENCOUNTERS: Record<LegacyStageId, BossEncounterConfig> = {
  0: {
    fadeDelayMs: 900,
    fadeDurationMs: 1800,
    lockLeftX: 6990,
    triggerWhenMapRightReached: true
  },
  1: {
    fadeDelayMs: 900,
    fadeDurationMs: 1800,
    lockLeftX: 6990,
    triggerWhenMapRightReached: true
  },
  2: {
    fadeDelayMs: 0,
    fadeDurationMs: 1800,
    lockLeftX: 6850,
    triggerLeadX: 360
  }
};

export const BOSS_STATS: Record<BossKind, BossStats> = {
  boss1: {
    hp: 500,
    atk: 2,
    defense: 1,
    exp: 60
  },
  boss2: {
    hp: 250,
    atk: 2,
    defense: 2.2,
    exp: 100
  },
  boss3: {
    hp: 2000,
    atk: 2,
    defense: 1.5,
    exp: 60
  }
};

export const BOSS_SPAWNS: Record<LegacyStageId, BossSpawnDef[]> = {
  0: [
    { x: 7800, y: 760, kind: 'boss1', direction: -1 }
  ],
  1: [
    { x: 7500, y: 600, kind: 'boss2', direction: -1 },
    { x: 7168, y: 600, kind: 'boss2', direction: 1 }
  ],
  2: [
    { x: 7500, y: 600, kind: 'boss3', direction: -1 }
  ]
};
