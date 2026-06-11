import type { LegacyStageId } from './legacyStages';

export type LegacyGimmickType = 'circle' | 'pattern' | 'straight' | 'warp';

export type LegacyGimmickConfig = {
  centerX?: number;
  centerY?: number;
  limitX?: number;
  limitY?: number;
  picNo: 0 | 1 | 2 | 3 | 4;
  radius?: number;
  speed: number;
  startAngle?: number;
  targetX?: number;
  targetY?: number;
  tblNo?: number;
  type: LegacyGimmickType;
  x?: number;
  y?: number;
};

export const LEGACY_GIMMICKS: Record<LegacyStageId, LegacyGimmickConfig[]> = {
  0: [
    { type: 'circle', centerX: 4555, centerY: 360, radius: 120, startAngle: 0, speed: 2, picNo: 0 },
    { type: 'circle', centerX: 4555, centerY: 360, radius: 120, startAngle: 90, speed: 2, picNo: 0 },
    { type: 'circle', centerX: 4555, centerY: 360, radius: 120, startAngle: 180, speed: 2, picNo: 0 },
    { type: 'circle', centerX: 4555, centerY: 360, radius: 120, startAngle: 270, speed: 2, picNo: 0 }
  ],
  1: [
    { type: 'pattern', x: 1130, y: 768, speed: 6, picNo: 1, tblNo: 2 },
    { type: 'pattern', x: 1430, y: 330, speed: 6, picNo: 1, tblNo: 3 },
    { type: 'pattern', x: 5760, y: 834, speed: 6, picNo: 1, tblNo: 5 },
    { type: 'pattern', x: 6052, y: 550, speed: 6, picNo: 1, tblNo: 5 }
  ],
  2: [
    { type: 'straight', x: 1100, y: 700, limitX: 420, limitY: 0, speed: 4, picNo: 2 },
    { type: 'straight', x: 1150, y: 570, limitX: 320, limitY: 0, speed: 4, picNo: 2 },
    { type: 'straight', x: 1200, y: 440, limitX: 220, limitY: 0, speed: 4, picNo: 2 },
    { type: 'straight', x: 1100, y: 310, limitX: 420, limitY: 0, speed: 4, picNo: 2 },
    { type: 'circle', centerX: 3970, centerY: 700, radius: 120, startAngle: 0, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 3970, centerY: 700, radius: 120, startAngle: 90, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 3970, centerY: 700, radius: 120, startAngle: 180, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 3970, centerY: 700, radius: 120, startAngle: 270, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4470, centerY: 700, radius: 120, startAngle: 0, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4470, centerY: 700, radius: 120, startAngle: 90, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4470, centerY: 700, radius: 120, startAngle: 180, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4470, centerY: 700, radius: 120, startAngle: 270, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4970, centerY: 700, radius: 120, startAngle: 0, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4970, centerY: 700, radius: 120, startAngle: 90, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4970, centerY: 700, radius: 120, startAngle: 180, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 4970, centerY: 700, radius: 120, startAngle: 270, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 5520, centerY: 700, radius: 120, startAngle: 0, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 5520, centerY: 700, radius: 120, startAngle: 90, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 5520, centerY: 700, radius: 120, startAngle: 180, speed: 1, picNo: 3 },
    { type: 'circle', centerX: 5520, centerY: 700, radius: 120, startAngle: 270, speed: 1, picNo: 3 },
    { type: 'warp', x: 2336, y: 128, targetX: 1989, targetY: 512, speed: 0, picNo: 0 },
    { type: 'warp', x: 1920, y: 512, targetX: 2299, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 2368, y: 512, targetX: 1989, targetY: 832, speed: 0, picNo: 0 },
    { type: 'warp', x: 1920, y: 832, targetX: 2331, targetY: 512, speed: 0, picNo: 0 },
    { type: 'warp', x: 2560, y: 736, targetX: 2629, targetY: 864, speed: 0, picNo: 0 },
    { type: 'warp', x: 2560, y: 864, targetX: 2523, targetY: 736, speed: 0, picNo: 0 },
    { type: 'warp', x: 2900, y: 800, targetX: 1989, targetY: 512, speed: 0, picNo: 0 },
    { type: 'warp', x: 2528, y: 512, targetX: 2299, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 2976, y: 512, targetX: 2597, targetY: 224, speed: 0, picNo: 0 },
    { type: 'warp', x: 2528, y: 224, targetX: 2299, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 3296, y: 224, targetX: 3301, targetY: 800, speed: 0, picNo: 0 },
    { type: 'warp', x: 3232, y: 800, targetX: 3259, targetY: 224, speed: 0, picNo: 0 },
    { type: 'warp', x: 3296, y: 64, targetX: 3493, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 3421, y: 128, targetX: 2299, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 6144, y: 768, targetX: 5856, targetY: 448, speed: 0, picNo: 0 },
    { type: 'warp', x: 5792, y: 448, targetX: 6110, targetY: 768, speed: 0, picNo: 0 },
    { type: 'warp', x: 6432, y: 512, targetX: 5890, targetY: 32, speed: 0, picNo: 0 },
    { type: 'warp', x: 5824, y: 32, targetX: 6400, targetY: 512, speed: 0, picNo: 0 },
    { type: 'warp', x: 6144, y: 32, targetX: 5856, targetY: 448, speed: 0, picNo: 0 },
    { type: 'warp', x: 6432, y: 352, targetX: 3776, targetY: 320, speed: 0, picNo: 0 },
    { type: 'warp', x: 3712, y: 320, targetX: 6400, targetY: 350, speed: 0, picNo: 0 },
    { type: 'warp', x: 3712, y: 320, targetX: 6400, targetY: 352, speed: 0, picNo: 0 },
    { type: 'warp', x: 6144, y: 160, targetX: 5344, targetY: 288, speed: 0, picNo: 0 },
    { type: 'warp', x: 5280, y: 288, targetX: 6112, targetY: 160, speed: 0, picNo: 0 },
    { type: 'warp', x: 5824, y: 160, targetX: 6110, targetY: 768, speed: 0, picNo: 0 },
    { type: 'warp', x: 5696, y: 32, targetX: 3968, targetY: 288, speed: 0, picNo: 0 },
    { type: 'warp', x: 3904, y: 288, targetX: 5696, targetY: 128, speed: 0, picNo: 0 },
    { type: 'warp', x: 4448, y: 224, targetX: 5856, targetY: 488, speed: 0, picNo: 0 },
    { type: 'warp', x: 4448, y: 32, targetX: 5152, targetY: 288, speed: 0, picNo: 0 },
    { type: 'warp', x: 5184, y: 288, targetX: 4480, targetY: 96, speed: 0, picNo: 0 },
    { type: 'warp', x: 4832, y: 160, targetX: 6350, targetY: 32, speed: 0, picNo: 0 }
  ]
};
