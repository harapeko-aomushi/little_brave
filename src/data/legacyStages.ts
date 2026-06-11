import { MapKey } from './constants';

export type LegacyStageId = 0 | 1 | 2;

export type LegacyStageConfig = {
  id: LegacyStageId;
  backgroundCropY: number;
  label: string;
  mapKey: (typeof MapKey)[keyof typeof MapKey];
  playerSpawn: {
    x: number;
    y: number;
  };
};

export const LEGACY_STAGES: Record<LegacyStageId, LegacyStageConfig> = {
  0: {
    id: 0,
    backgroundCropY: 0,
    label: 'Stage 1',
    mapKey: MapKey.Stage1,
    playerSpawn: { x: 50, y: 32 * 28 }
  },
  1: {
    id: 1,
    backgroundCropY: 540,
    label: 'Stage 2',
    mapKey: MapKey.Stage2,
    playerSpawn: { x: 50, y: 32 * 27 }
  },
  2: {
    id: 2,
    backgroundCropY: 1080,
    label: 'Stage 3',
    mapKey: MapKey.Stage3,
    playerSpawn: { x: 50, y: 32 * 6 }
  }
};
