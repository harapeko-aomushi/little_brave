export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 480;
export const TILE_SIZE = 32;

export const AssetKey = {
  Bg: 'bg',
  Stage1Bg: 'stage1_bg',
  Stage2Bg: 'stage2_bg',
  Stage3Bg: 'stage3_bg',
  Boss: 'boss',
  Bullet: 'bullet',
  Chara: 'chara',
  Chip: 'chip',
  ChipRaw: 'chipRaw',
  Enemy: 'enemy',
  EnemyBullet: 'enemyBullet',
  Effect: 'effect',
  Ending: 'ending',
  Fairy: 'fairy',
  Gauge: 'gauge',
  GameOver: 'gameOver',
  Gimmick: 'gimmick',
  Item: 'item',
  Life: 'life',
  Number: 'number',
  Player: 'player',
  PlayerStatus: 'playerStatus',
  Title: 'title',
  Weapon: 'weapon'
} as const;

export const AudioKey = {
  Arrow: 'seArrow',
  ArrowAttack: 'seArrowAttack',
  Attack1: 'seAttack1',
  Attack2: 'seAttack2',
  Attack3: 'seAttack3',
  Boss1Batabata: 'seBoss1Batabata',
  Boss3AttackMotion: 'seBoss3AttackMotion',
  Boss3Water: 'seBoss3Water',
  Brock: 'seBrock',
  Ending: 'ending',
  Title: 'title',
  BgmStage1: 'bgmStage1',
  BgmStage2: 'bgmStage2',
  BgmStage3: 'bgmStage3',
  EnemyDown: 'seEnemyDown',
  Fire: 'seFire',
  Heart: 'seHeart',
  Heal: 'seHeal',
  LevelUp: 'seLevelUp',
  PotionBlue: 'sePotionBlue',
  PotionRed: 'sePotionRed',
  Plant: 'sePlant',
  Sword1: 'seSword1',
  Sword2: 'seSword2',
  Thunder: 'seThunder',
  VoiceDamage1: 'voiceDamage1',
  VoiceDamage2: 'voiceDamage2',
  VoiceDown1: 'voiceDown1',
  VoiceDown2: 'voiceDown2'
} as const;

export const MapKey = {
  Stage1: 'stage1',
  Stage2: 'stage2',
  Stage3: 'stage3'
} as const;
