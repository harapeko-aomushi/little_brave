import Phaser from 'phaser';
import { Boss } from '../entities/Boss';
import { Collectible } from '../entities/Collectible';
import { Enemy } from '../entities/Enemy';
import { EnemyBullet } from '../entities/EnemyBullet';
import { Fairy } from '../entities/Fairy';
import { Player, type PlayerState } from '../entities/Player';
import { PlayerBullet } from '../entities/PlayerBullet';
import { Potion, type PotionKind } from '../entities/Potion';
import { SpBall } from '../entities/SpBall';
import { StatusHud } from '../entities/StatusHud';
import { Weapon } from '../entities/Weapon';
import { BOSS_ENCOUNTERS, BOSS_SPAWNS } from '../data/bosses';
import { LEGACY_COLLECTIBLE_SPAWNS } from '../data/collectibles';
import { AssetKey, AudioKey, SCREEN_HEIGHT, TILE_SIZE } from '../data/constants';
import { LEGACY_ENEMY_SPAWNS, type EnemyBulletKind, type EnemyKind } from '../data/enemies';
import { LEGACY_STAGES, type LegacyStageId } from '../data/legacyStages';
import { GimmickSystem } from '../systems/GimmickSystem';
import type { GimmickWarp } from '../entities/GimmickWarp';
import { InputSystem } from '../systems/InputSystem';
import { collisionIndexes, parseLegacyMap } from '../utils/legacyMap';
import { applyWideViewport } from '../utils/viewport';

type SpawnState = {
  enemy?: Enemy;
  spawned: boolean;
  wasInRange: boolean;
  x: number;
  y: number;
  kind: (typeof LEGACY_ENEMY_SPAWNS)[LegacyStageId][number]['kind'];
};

type GimmickDebugPhase = {
  phase: string;
  playerX: number;
  playerY: number;
  bodyX: number;
  bodyY: number;
  bodyLeft: number;
  bodyRight: number;
  bodyBottom: number;
  bodyPrevX: number;
  bodyPrevY: number;
  bodyVelocityX: number;
  bodyVelocityY: number;
  blockedDown: boolean;
  touchingDown: boolean;
  bodyToPlayerOffsetX: number;
  bodyToPlayerOffsetY: number;
  inputLeft: boolean;
  inputRight: boolean;
  inputDash: boolean;
};

type GameOverChoice = 'retry' | 'title';

type GameOverMenuItem = {
  choice: GameOverChoice;
  label: Phaser.GameObjects.Text;
  rect: Phaser.GameObjects.Rectangle;
};

const ENEMY_SPAWN_PADDING_X = 220;
const ENEMY_SPAWN_PADDING_Y = 120;
const ENEMY_DELETE_PADDING_X = 360;
const ENEMY_DELETE_PADDING_Y = 240;
const BACKGROUND_SCROLL_FACTOR_X = 1 / 13;
const BACKGROUND_SCROLL_FACTOR_Y = 1 / 30;
const CAMERA_DEADZONE_X = 90;
const CAMERA_DEADZONE_Y = 70;
const ENABLE_GIMMICK_DEBUG_LOGS: boolean = false;

export class StageScene extends Phaser.Scene {
  private currentStageId: LegacyStageId = 0;
  private inputSystem!: InputSystem;
  private player!: Player;
  private fairy!: Fairy;
  private gimmicks!: GimmickSystem;
  private bosses!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.GameObjects.Group;
  private spBalls!: Phaser.GameObjects.Group;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private potions!: Phaser.Physics.Arcade.Group;
  private chargeEffect?: Phaser.GameObjects.Image;
  private chargeEffectFrame = 0;
  private chargeEffectTimerMs = 0;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private background!: Phaser.GameObjects.Image;
  private bgm?: Phaser.Sound.BaseSound;
  private weapon!: Weapon;
  private hud!: StatusHud;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;
  private spawnStates: SpawnState[] = [];
  private playerDamageLockMs = 0;
  private bossCameraLockLeft = 0;
  private bossEncounterReady = false;
  private bossEncounterTriggered = false;
  private bossSpawnDelayEvent?: Phaser.Time.TimerEvent;
  private bossClearScheduled = false;
  private bossSpawned: boolean[] = [];
  private bossSummonedEnemies = new Set<Enemy>();
  private swordHitEnemies = new Set<Enemy>();
  private swordHitBosses = new Set<Boss>();
  private gimmickDebugFrame = 0;
  private gimmickDebugTimerMs = 0;
  private gimmickDebugLastRiding = false;
  private gimmickDebugFileLoggingFailed = false;
  private previousGimmickAfterPlayer?: GimmickDebugPhase;
  private collisionFloorBottomY = 0;
  private worldHeight = 0;
  private worldWidth = 0;
  private downVoicePlayed = false;
  private thunderSfxCountThisTick = 0;
  private gameOverActive = false;
  private gameOverDecisionActive = false;
  private gameOverImage?: Phaser.GameObjects.Image;
  private gameOverItems: GameOverMenuItem[] = [];
  private gameOverOverlay?: Phaser.GameObjects.Rectangle;
  private warpTransitionActive = false;
  private warpTransitionOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverSelectedIndex = 0;
  private gameOverTransitionOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverUpKey?: Phaser.Input.Keyboard.Key;
  private gameOverDownKey?: Phaser.Input.Keyboard.Key;
  private gameOverEnterKey?: Phaser.Input.Keyboard.Key;
  private initialPlayerState?: PlayerState;

  constructor() {
    super('StageScene');
  }

  init(data: { playerState?: PlayerState; stageId?: LegacyStageId }): void {
    this.currentStageId = data.stageId ?? 0;
    this.initialPlayerState = data.playerState;
  }

  create(): void {
    this.resetTransientOverlays();
    this.inputSystem = new InputSystem(this);
    this.downVoicePlayed = false;
    this.gameOverActive = false;
    this.gameOverDecisionActive = false;
    this.warpTransitionActive = false;
    this.gameOverItems = [];
    this.gameOverImage = undefined;
    this.gameOverOverlay = undefined;
    this.warpTransitionOverlay = undefined;
    this.gameOverTransitionOverlay = undefined;
    this.gameOverSelectedIndex = 0;
    const stage = LEGACY_STAGES[this.currentStageId];

    const legacyMap = parseLegacyMap(this.cache.binary.get(stage.mapKey) as ArrayBuffer);
    const displayTiles = legacyMap.tiles.map((row) =>
      row.map((tile) => (this.shouldDrawMapTile(tile) ? tile : -1))
    );
    const map = this.make.tilemap({
      data: displayTiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE
    });
    const chipTextureKey = this.createStageChipTexture(this.currentStageId);
    const tileset = map.addTilesetImage(chipTextureKey, chipTextureKey, TILE_SIZE, TILE_SIZE);
    if (!tileset) {
      throw new Error('Could not create tileset.');
    }

    this.worldWidth = legacyMap.width * TILE_SIZE;
    this.worldHeight = legacyMap.height * TILE_SIZE;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.physics.world.setBoundsCollision(true, true, true, false);
    const stageBackgroundImages = [
      AssetKey.Stage1Bg,
      AssetKey.Stage2Bg,
      AssetKey.Stage3Bg
    ]

    const backgroundFrame = this.createTextureFrame(
      stageBackgroundImages[this.currentStageId - 1],
      `bg-stage-${this.currentStageId}`,
      0,
      0,
      1280,
      540
    );
    this.background = this.add.image(0, 0, stageBackgroundImages[this.currentStageId], backgroundFrame)
      .setOrigin(0)
      .setScrollFactor(BACKGROUND_SCROLL_FACTOR_X, BACKGROUND_SCROLL_FACTOR_Y);

    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) {
      throw new Error('Could not create tile layer.');
    }
    layer.setCollision(collisionIndexes());
    this.collisionLayer = layer;
    this.collisionFloorBottomY = this.computeCollisionFloorBottomY() + 50;

    this.player = new Player(this, stage.playerSpawn.x, stage.playerSpawn.y);
    if (this.initialPlayerState) {
      this.player.applyStateSnapshot(this.initialPlayerState);
    }
    this.fairy = new Fairy(this, this.player.x + 12, this.player.y - 18);
    this.physics.add.collider(this.player, layer);
    this.weapon = new Weapon(this);
    this.gimmicks = new GimmickSystem(this, this.currentStageId, this.player);

    this.bosses = this.add.group();
    this.enemies = this.add.group();
    this.enemyBullets = this.physics.add.group();
    this.bullets = this.add.group();
    this.spBalls = this.add.group();
    this.collectibles = this.physics.add.group();
    this.potions = this.physics.add.group();
    this.spawnStates = LEGACY_ENEMY_SPAWNS[this.currentStageId].map((spawn) => ({
      ...spawn,
      spawned: false,
      wasInRange: false
    }));
    this.bossSpawned = BOSS_SPAWNS[this.currentStageId].map(() => false);
    this.bossCameraLockLeft = 0;
    this.bossEncounterReady = false;
    this.bossEncounterTriggered = false;
    this.bossSpawnDelayEvent = undefined;
    this.bossClearScheduled = false;

    this.physics.add.collider(
      this.enemyBullets,
      layer,
      (bullet) => {
        const enemyBullet = bullet as EnemyBullet;
        enemyBullet.hitTerrain();
      }
    );
    this.physics.add.collider(this.collectibles, layer);
    this.physics.add.collider(this.potions, layer);
    this.physics.add.overlap(this.player, this.potions, (_player, potionObject) => {
      const potion = potionObject as Potion;
      if (this.player.addPotion(potion.kind)) {
        this.playSe(AudioKey.Heal, 0.45);
      }
      potion.destroy();
    });
    this.physics.add.overlap(this.player, this.collectibles, (_player, collectibleObject) => {
      const collectible = collectibleObject as Collectible;
      if (collectible.kind === 'maxHpHeart') {
        this.player.increaseMaxHp(2);
        this.playSe(AudioKey.Heart, 0.58);
        this.hud.update(this.player);
      }
      collectible.destroy();
    });
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      const enemyInstance = enemy as Enemy;
      enemyInstance.handlePlayerContact();
      this.hitPlayer(enemyInstance.contactDamage);
    });
    this.physics.add.overlap(this.player, this.enemyBullets, (_player, bullet) => {
      const enemyBullet = bullet as EnemyBullet;
      if (!enemyBullet.canHitPlayer()) {
        return;
      }
      enemyBullet.hitPlayer();
      this.hitPlayer(enemyBullet.power);
    });

    this.configureWideCamera();
    this.cameras.main.startFollow(this.player, false, 1, 1);
    this.cameras.main.setDeadzone(CAMERA_DEADZONE_X, CAMERA_DEADZONE_Y);

    this.hud = new StatusHud(this);
    this.gameOverUpKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.gameOverDownKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.gameOverEnterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spawnStageCollectibles();
    this.startStageBgm();
    this.playStageFadeIn();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.configureWideCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.configureWideCamera, this);
      this.resetTransientOverlays();
      this.bgm?.stop();
      this.bgm = undefined;
    });
  }

  override update(_time: number, delta: number): void {
    if (this.gameOverActive) {
      this.updateFrozenEnemies(delta);
      this.updateGameOverMenu();
      return;
    }
    if (this.warpTransitionActive) {
      return;
    }

    this.playerDamageLockMs = Math.max(0, this.playerDamageLockMs - delta);
    this.thunderSfxCountThisTick = 0;

    if (this.applyDebugStageSelect()) {
      return;
    }
    this.applyDebugEnemySpawn();
    this.applyDebugWarp();
    const beforeGimmickDebug = ENABLE_GIMMICK_DEBUG_LOGS
      ? this.captureGimmickDebugPhase('before-gimmick')
      : undefined;
    this.gimmicks.update(delta);
    const warp = this.gimmicks.consumeWarpRequest();
    if (warp) {
      this.startWarpTransition(warp);
      return;
    }
    const afterGimmickDebug = ENABLE_GIMMICK_DEBUG_LOGS
      ? this.captureGimmickDebugPhase('after-gimmick')
      : undefined;
    this.inputSystem.update();
    this.applyPotionInputs();
    this.player.update(this.inputSystem, delta);
    this.applyBossArenaLock();
    this.playPendingPlayerSfx();
    if (ENABLE_GIMMICK_DEBUG_LOGS && beforeGimmickDebug && afterGimmickDebug) {
      this.logGimmickDebug(
        delta,
        beforeGimmickDebug,
        afterGimmickDebug,
        this.captureGimmickDebugPhase('after-player')
      );
    }
    this.fairy.update(this.player);
    this.weapon.updateFromPlayer(this.player, delta);
    this.updateChargeEffect(delta);
    this.manageEnemySpawns();
    this.updateBackground();

    for (const request of this.player.consumeProjectileRequests()) {
      const bullet = new PlayerBullet(this, request.x, request.y, request.kind, request.angleDeg, request.speed);
      this.bullets.add(bullet);
      if (request.kind === 'arrow1' || request.kind === 'arrow2') {
        this.playSe(AudioKey.Arrow, 0.45);
      }
      this.physics.add.overlap(bullet, this.enemies, (bulletObject, enemyObject) => {
        const projectile = bulletObject as PlayerBullet;
        const enemy = enemyObject as Enemy;
        if (!projectile.canDamageEnemy(enemy)) {
          return;
        }

        const bulletBody = projectile.body as Phaser.Physics.Arcade.Body | null;
        const bulletDirection = (bulletBody?.velocity.x ?? 0) >= 0 ? 1 : -1;
        const bulletKnockback = this.getProjectileKnockback(projectile, bulletDirection);
        const damage = enemy.damage(projectile.power * this.player.atk, {
          allowDuringHurt: projectile.kind === 'sword2',
          knockback: {
            x: bulletKnockback.x,
            y: bulletKnockback.y
          }
        });
        if (damage.defeated) {
          this.playSe(AudioKey.EnemyDown, 0.6);
          this.player.gainExp(enemy.expValue);
          this.spawnSpBalls(enemy.x, enemy.y, 5);
          this.trySpawnPotion(enemy.x, enemy.y);
        }
        if (damage.hit) {
          if (projectile.kind === 'arrow1' || projectile.kind === 'arrow2') {
            this.playSe(AudioKey.ArrowAttack, 0.5);
          } else {
            this.playRandomSwordSe();
          }
          this.createDamageNumber(enemy.x, enemy.y - enemy.displayHeight * 0.45, damage.amount);
          this.createImpactEffect(enemy.x, enemy.y + enemy.displayHeight * 0.25);
          this.spawnSpBalls(enemy.x, enemy.y, 1);
        }
        projectile.markHit(enemy);
      });
      this.physics.add.overlap(bullet, this.enemyBullets, (bulletObject, enemyBulletObject) => {
        const projectile = bulletObject as PlayerBullet;
        const enemyBullet = enemyBulletObject as EnemyBullet;
        if (
          (enemyBullet.kind !== 'rose' && enemyBullet.kind !== 'waterball' && enemyBullet.kind !== 'flame')
          || !projectile.canDamageEnemy(enemyBullet)
        ) {
          return;
        }

        enemyBullet.destroyByPlayer();
        projectile.markHit(enemyBullet);
      });
    }

    this.bullets.children.each((bulletObject) => {
      const bullet = bulletObject as PlayerBullet;
      bullet.update(delta);
      this.applyProjectileBossHits(bullet);
      if (bullet.kind === 'sword1' || bullet.kind === 'sword2') {
        this.breakTilesInRect(bullet.getBounds());
      }
      return true;
    });

    this.spBalls.children.each((spBallObject) => {
      const spBall = spBallObject as SpBall;
      spBall.update(delta, this.player);
      return true;
    });

    this.potions.children.each((potionObject) => {
      const potion = potionObject as Potion;
      potion.update(delta);
      return true;
    });

    this.enemyBullets.children.each((bulletObject) => {
      const enemyBullet = bulletObject as EnemyBullet;
      enemyBullet.update(delta, this.player, (kind, x, y, velocityX, velocityY) =>
        this.spawnEnemyBullet(kind, x, y, velocityX, velocityY)
      );
      this.applyEnemyBulletTerrainHit(enemyBullet);
      return true;
    });

    this.enemies.children.each((enemyObject) => {
      const enemy = enemyObject as Enemy;
      enemy.update({
        deltaMs: delta,
        groundAhead: (instance, direction) => this.hasGroundAhead(instance, direction),
        player: this.player,
        spaceAbove: (instance) => this.hasSpaceAbove(instance),
        spawnBullet: (kind, x, y, velocityX, velocityY) =>
          this.spawnEnemyBullet(kind, x, y, velocityX, velocityY),
        worldLeft: 0,
        worldRight: this.worldWidth
      });
      return true;
    });

    this.manageBossSpawns();
    this.bosses.children.each((bossObject) => {
      const boss = bossObject as Boss;
      if (!this.bossEncounterReady) {
        boss.updateFrozen(delta);
        return true;
      }
      boss.update({
        deltaMs: delta,
        canSummonEnemy: () => !this.enemies.getChildren().some((enemyObject) => (enemyObject as Enemy).active),
        player: this.player,
        worldRight: this.worldWidth,
        playBoss1WaterMotion: () => this.playBoss1WaterMotionSe(),
        playBoss3AttackMotion: () => this.playSe(AudioKey.Boss3AttackMotion, 0.58),
        playBoss3Water: () => this.playSe(AudioKey.Boss3Water, 0.55),
        spawnBullet: (kind, x, y, velocityX, velocityY, hasGravity) =>
          this.spawnEnemyBullet(kind, x, y, velocityX, velocityY, hasGravity),
        spawnEnemy: (kind, x, y, velocityX, velocityY) =>
          this.spawnBossEnemy(kind, x, y, velocityX, velocityY)
      });
      return true;
    });
    this.applyBossContact();
    this.checkBossClear();

    this.applySwordHits();

    if (this.hasPlayerFallenIntoPit()) {
      this.player.hp = 0;
    }

    this.hud.update(this.player);
    this.playPendingPlayerSfx();

    if (this.player.hp <= 0) {
      this.startGameOver();
    }
  }

  private applySwordHits(): void {
    const attackRect = this.weapon.getDamageRect(this.player);

    if (!attackRect) {
      this.swordHitEnemies.clear();
      this.swordHitBosses.clear();
      return;
    }

    this.breakTilesInRect(attackRect);
    this.destroyRoseBulletsInRect(attackRect);

    this.enemies.children.each((enemyObject) => {
      const enemy = enemyObject as Enemy;
      const canRepeatHit = this.weapon.canHitDuringHurt();
      if (!canRepeatHit && this.swordHitEnemies.has(enemy)) {
        return true;
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(attackRect, enemy.getBounds())) {
        const damage = enemy.damage(this.weapon.getAttackPower() * this.player.atk, {
          allowDuringHurt: this.weapon.canHitDuringHurt(),
          knockback: this.weapon.getKnockback(this.player)
        });
        if (damage.hit && !canRepeatHit) {
          this.swordHitEnemies.add(enemy);
        }
        if (damage.defeated) {
          this.playSe(AudioKey.EnemyDown, 0.6);
          this.player.gainExp(enemy.expValue);
          this.spawnSpBalls(enemy.x, enemy.y, 5);
          this.trySpawnPotion(enemy.x, enemy.y);
        }
        if (damage.hit) {
          this.playRandomSwordSe();
          this.createDamageNumber(enemy.x, enemy.y - enemy.displayHeight * 0.45, damage.amount);
          this.createImpactEffect(enemy.x, enemy.y + enemy.displayHeight * 0.25);
          this.spawnSpBalls(enemy.x, enemy.y, 1);
        }
      }
      return true;
    });

    if (this.bossEncounterReady) {
      this.bosses.children.each((bossObject) => {
        const boss = bossObject as Boss;
        const canRepeatHit = this.weapon.canHitDuringHurt();
        if (!canRepeatHit && this.swordHitBosses.has(boss)) {
          return true;
        }
        if (Phaser.Geom.Intersects.RectangleToRectangle(attackRect, boss.getDamageBounds())) {
          const damage = boss.damage(this.weapon.getAttackPower() * this.player.atk, {
            allowDuringHurt: this.weapon.canHitDuringHurt(),
            knockback: this.weapon.getKnockback(this.player)
          });
          if (damage.hit && !canRepeatHit) {
            this.swordHitBosses.add(boss);
          }
          this.handleBossDamageFeedback(boss, damage, false);
        }
        return true;
      });
    }
  }

  private applyDebugWarp(): void {
    if (this.inputSystem.consumeDebugLevelUp()) {
      this.player.levelUp();
      this.hud.update(this.player);
    }

    const warpIndex = this.inputSystem.consumeDebugWarpIndex();
    if (warpIndex === undefined) {
      return;
    }

    const targetX = warpIndex === 0
      ? this.getBossDebugWarpX()
      : Phaser.Math.Clamp(warpIndex * 550, 0, this.physics.world.bounds.width);
    const targetY = warpIndex === 0 ? this.getGroundedDebugWarpY(targetX) : this.player.y;

    this.player.setPosition(targetX, targetY);
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
    this.cameras.main.centerOn(targetX, targetY);
  }

  private applyPotionInputs(): void {
    if (this.inputSystem.consumeRedPotion()) {
      if (this.player.useRedPotion()) {
        this.playSe(AudioKey.PotionRed, 0.58);
        this.hud.update(this.player);
      }
    }

    if (this.inputSystem.consumeBluePotion()) {
      if (this.player.useBluePotion()) {
        this.playSe(AudioKey.PotionBlue, 0.58);
        this.hud.update(this.player);
      }
    }
  }

  private applyDebugEnemySpawn(): void {
    const kind = this.inputSystem.consumeDebugLiquidSpawn();
    if (!kind) {
      return;
    }

    const direction = this.player.flipX ? -1 : 1;
    const spawnX = this.player.x + direction * 120;
    const spawnY = this.player.y - 32;
    this.spawnBossEnemy(kind, spawnX, spawnY, 0, 0);
  }

  private applyDebugStageSelect(): boolean {
    if (!this.inputSystem.consumeDebugNextStage()) {
      return false;
    }

    const nextStageId = ((this.currentStageId + 1) % 3) as LegacyStageId;
    this.bgm?.stop();
    this.scene.start('StageScene', {
      playerState: this.player.createStateSnapshot(),
      stageId: nextStageId
    });
    return true;
  }

  private getBossDebugWarpX(): number {
    const firstBossX = Math.min(...BOSS_SPAWNS[this.currentStageId].map((spawn) => spawn.x));
    const encounter = BOSS_ENCOUNTERS[this.currentStageId];
    const targetX = encounter.triggerWhenMapRightReached
      ? this.worldWidth - 48
      : firstBossX - (encounter.triggerLeadX ?? 0) + 16;
    return Phaser.Math.Clamp(targetX, 0, this.physics.world.bounds.width);
  }

  private getGroundedDebugWarpY(x: number): number {
    const firstBossY = Math.min(...BOSS_SPAWNS[this.currentStageId].map((spawn) => spawn.y));
    const worldBottom = this.physics.world.bounds.bottom;

    for (let probeY = firstBossY; probeY <= worldBottom; probeY += 2) {
      const tile = this.collisionLayer.getTileAtWorldXY(x, probeY);
      if (tile?.collides) {
        return tile.y * TILE_SIZE - 15;
      }
    }

    return this.player.y;
  }

  private applyEnemyBulletTerrainHit(enemyBullet: EnemyBullet): void {
    if (!enemyBullet.active) {
      return;
    }

    if (enemyBullet.kind !== 'lightning') {
      return;
    }

    const bounds = enemyBullet.getBounds();
    const sampleXs = [bounds.left + 2, bounds.centerX, bounds.right - 2];
    let nearestTileTop = Number.POSITIVE_INFINITY;

    for (const sampleX of sampleXs) {
      for (let sampleY = bounds.top + 2; sampleY <= bounds.top + 128; sampleY += 4) {
        const tile = this.collisionLayer.getTileAtWorldXY(sampleX, sampleY);
        if (tile?.collides) {
          nearestTileTop = Math.min(nearestTileTop, tile.pixelY);
          break;
        }
      }
    }

    if (Number.isFinite(nearestTileTop)) {
      enemyBullet.setLightningHeight(nearestTileTop - bounds.top);
      enemyBullet.hitTerrain();
    }
  }

  private captureGimmickDebugPhase(phase: string): GimmickDebugPhase {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return {
        phase,
        playerX: this.roundDebug(this.player.x),
        playerY: this.roundDebug(this.player.y),
        bodyX: 0,
        bodyY: 0,
        bodyLeft: 0,
        bodyRight: 0,
        bodyBottom: 0,
        bodyPrevX: 0,
        bodyPrevY: 0,
        bodyVelocityX: 0,
        bodyVelocityY: 0,
        blockedDown: false,
        touchingDown: false,
        bodyToPlayerOffsetX: 0,
        bodyToPlayerOffsetY: 0,
        inputLeft: this.inputSystem.left,
        inputRight: this.inputSystem.right,
        inputDash: this.inputSystem.dashHeld
      };
    }

    return {
      phase,
      playerX: this.roundDebug(this.player.x),
      playerY: this.roundDebug(this.player.y),
      bodyX: this.roundDebug(body.x),
      bodyY: this.roundDebug(body.y),
      bodyLeft: this.roundDebug(body.left),
      bodyRight: this.roundDebug(body.right),
      bodyBottom: this.roundDebug(body.bottom),
      bodyPrevX: this.roundDebug(body.prev.x),
      bodyPrevY: this.roundDebug(body.prev.y),
      bodyVelocityX: this.roundDebug(body.velocity.x),
      bodyVelocityY: this.roundDebug(body.velocity.y),
      blockedDown: body.blocked.down,
      touchingDown: body.touching.down,
      bodyToPlayerOffsetX: this.roundDebug(this.player.x - body.x),
      bodyToPlayerOffsetY: this.roundDebug(this.player.y - body.y),
      inputLeft: this.inputSystem.left,
      inputRight: this.inputSystem.right,
      inputDash: this.inputSystem.dashHeld
    };
  }

  private logGimmickDebug(
    deltaMs: number,
    beforeGimmick: GimmickDebugPhase,
    afterGimmick: GimmickDebugPhase,
    afterPlayer: GimmickDebugPhase
  ): void {
    this.gimmickDebugFrame += 1;
    this.gimmickDebugTimerMs += deltaMs;

    const previousAfterPlayer = this.previousGimmickAfterPlayer;
    this.previousGimmickAfterPlayer = afterPlayer;

    const debugState = this.gimmicks.getDebugState();
    const nearPlatform = debugState.standingChecks.some((check) => {
      const bodyCenterX = (check.bodyLeft + check.bodyRight) / 2;
      const platformCenterX = (check.currentLeft + check.currentRight) / 2;
      const platformWidth = check.currentRight - check.currentLeft;
      return Math.abs(bodyCenterX - platformCenterX) < platformWidth + 64
        && Math.abs(check.bodyBottom - check.platformY) < 96;
    });
    const shouldLog = debugState.riding || this.gimmickDebugLastRiding || nearPlatform;
    const ridingChanged = debugState.riding !== this.gimmickDebugLastRiding;

    if (!shouldLog) {
      this.gimmickDebugLastRiding = debugState.riding;
      return;
    }

    if (!ridingChanged && this.gimmickDebugTimerMs < 250) {
      this.gimmickDebugLastRiding = debugState.riding;
      return;
    }

    this.gimmickDebugTimerMs = 0;
    this.gimmickDebugLastRiding = debugState.riding;

    const notes = this.createGimmickDebugNotes(
      deltaMs,
      beforeGimmick,
      afterGimmick,
      afterPlayer,
      previousAfterPlayer
    );
    const inputText = `${afterPlayer.inputLeft ? 'L' : '-'}${afterPlayer.inputRight ? 'R' : '-'}${afterPlayer.inputDash ? 'D' : '-'}`;
    const platformText = debugState.ridingPlatformIndex ?? '-';
    const logEntry = {
      timestamp: new Date().toISOString(),
      stageId: this.currentStageId,
      frame: this.gimmickDebugFrame,
      deltaMs: this.roundDebug(deltaMs),
      riding: debugState.riding,
      platform: debugState.ridingPlatformIndex ?? null,
      input: {
        left: afterPlayer.inputLeft,
        right: afterPlayer.inputRight,
        dash: afterPlayer.inputDash,
        text: inputText
      },
      phases: {
        previousAfterPlayer,
        beforeGimmick,
        afterGimmick,
        afterPlayer
      },
      debugState,
      notes
    };

    console.groupCollapsed(
      `[gimmick-debug] frame=${this.gimmickDebugFrame} riding=${debugState.riding} platform=${platformText} input=${inputText}`
    );
    console.table([beforeGimmick, afterGimmick, afterPlayer]);
    console.log('[gimmick-debug] state', debugState);
    if (notes.length > 0) {
      console.warn('[gimmick-debug] diagnosis', notes);
    } else {
      console.log('[gimmick-debug] diagnosis', ['no obvious mismatch in this sampled frame']);
    }
    console.groupEnd();
    this.writeGimmickDebugLog(logEntry);
  }

  private createGimmickDebugNotes(
    deltaMs: number,
    beforeGimmick: GimmickDebugPhase,
    afterGimmick: GimmickDebugPhase,
    afterPlayer: GimmickDebugPhase,
    previousAfterPlayer?: GimmickDebugPhase
  ): string[] {
    const notes: string[] = [];
    const debugState = this.gimmicks.getDebugState();
    const inputMoving = afterPlayer.inputLeft || afterPlayer.inputRight;

    if (debugState.carry) {
      const carryBodyDeltaX = afterGimmick.bodyX - beforeGimmick.bodyX;
      if (Math.abs(carryBodyDeltaX - debugState.carry.platformDeltaX) > 0.25) {
        notes.push(`carry body dx mismatch: body=${this.roundDebug(carryBodyDeltaX)}, platform=${debugState.carry.platformDeltaX}`);
      }
      if (Math.abs(debugState.carry.carryBodyErrorX) > 0.1 || Math.abs(debugState.carry.carryBodyErrorY) > 0.1) {
        notes.push(`carry body position mismatch: error=(${debugState.carry.carryBodyErrorX}, ${debugState.carry.carryBodyErrorY})`);
      }
      if (Math.abs(debugState.carry.carryErrorX) > 0.1 || Math.abs(debugState.carry.carryErrorY) > 0.1) {
        notes.push(`carry player position mismatch: error=(${debugState.carry.carryErrorX}, ${debugState.carry.carryErrorY})`);
      }
    }

    if (inputMoving && Math.abs(afterPlayer.bodyVelocityX) < 1) {
      notes.push('input is pressed, but Player.update left velocityX at 0');
    }

    if (inputMoving && Math.abs(afterPlayer.bodyVelocityX) >= 1) {
      notes.push(`input velocity is set after Player.update: velocityX=${afterPlayer.bodyVelocityX}`);
    }

    if (previousAfterPlayer && Math.abs(previousAfterPlayer.bodyVelocityX) > 1) {
      const expectedPhysicsDx = previousAfterPlayer.bodyVelocityX * deltaMs / 1000;
      const actualPhysicsDx = beforeGimmick.bodyX - previousAfterPlayer.bodyX;
      if (Math.abs(actualPhysicsDx) < Math.abs(expectedPhysicsDx) * 0.35) {
        notes.push(
          `next-frame physics dx looks too small: expected about ${this.roundDebug(expectedPhysicsDx)}, actual ${this.roundDebug(actualPhysicsDx)}`
        );
      }
    }

    const failedStandCheck = debugState.standingChecks.find((check) => !check.result);
    if (!debugState.riding && failedStandCheck) {
      notes.push(`ride check failed: platform=${failedStandCheck.platformIndex}, reason=${failedStandCheck.reason}`);
    }

    return notes;
  }

  private roundDebug(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private writeGimmickDebugLog(entry: object): void {
    void fetch('/__debug-log/gimmick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    }).then((response) => {
      if (!response.ok && !this.gimmickDebugFileLoggingFailed) {
        this.gimmickDebugFileLoggingFailed = true;
        console.warn(`[gimmick-debug] file logging failed: HTTP ${response.status}`);
      }
    }).catch((error: unknown) => {
      if (this.gimmickDebugFileLoggingFailed) {
        return;
      }

      this.gimmickDebugFileLoggingFailed = true;
      console.warn('[gimmick-debug] file logging failed', error);
    });
  }

  private createEffectFrame(key: string, x: number, y: number, width: number, height: number): string {
    return this.createTextureFrame(AssetKey.Effect, key, x, y, width, height);
  }

  private createTextureFrame(textureKey: string, key: string, x: number, y: number, width: number, height: number): string {
    const texture = this.textures.get(textureKey);
    if (!texture.has(key)) {
      texture.add(key, 0, x, y, width, height);
    }
    return key;
  }

  private createStageChipTexture(stageId: LegacyStageId): string {
    const key = `${AssetKey.Chip}-stage-${stageId}`;
    if (this.textures.exists(key)) {
      return key;
    }

    const source = this.textures.get(AssetKey.Chip).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not create stage chip texture.');
    }

    context.drawImage(
      source,
      0,
      stageId * TILE_SIZE,
      source.width,
      TILE_SIZE,
      0,
      0,
      source.width,
      TILE_SIZE
    );
    this.textures.addCanvas(key, canvas);
    return key;
  }

  private createImpactEffect(x: number, y: number): void {
    for (let i = 0; i < 2; i += 1) {
      this.createShockwaveEffect(x, y);
    }
    this.createStarBurst(x, y + 12);
  }

  private createDamageNumber(x: number, y: number, amount: number): void {
    const digits = Math.max(0, amount).toString();
    const startX = x - (digits.length * 18) / 2;

    for (let i = 0; i < digits.length; i += 1) {
      const digit = Number(digits[i]);
      const key = this.createEffectFrame(`effect-damage-${digit}`, digit * 16, 0, 16, 17);
      this.createDamageDigit(startX + i * 18, y, key);
    }
  }

  private createDamageDigit(x: number, y: number, frameKey: string): void {
    const image = this.add.image(x, y, AssetKey.Effect, frameKey)
        .setOrigin(0.5)
        .setDepth(11)
        .setAlpha(1);

    let count = 0;
    let velocityX = 1;
    let velocityY = -6;
    const updateEvent = this.time.addEvent({
      delay: 1000 / 60,
      loop: true,
      callback: () => {
        velocityY += 0.2;
        image.x += velocityX;
        image.y += velocityY;

        if (count > 30) {
          image.setAlpha(Math.max(0, image.alpha - 0.02));
        }

        image.setVisible(count % 4 >= 1);
        count += 1;

        if (image.alpha <= 0.02) {
          updateEvent.remove(false);
          image.destroy();
        }
      }
    });
  }

  private createLevelUpEffect(offsetIndex = 0): void {
    const key = this.createEffectFrame('effect-level-up', 17, 20, 91, 9);
    const legacyLeft = this.player.x - 16;
    const legacyTop = this.player.y - 16;
    const image = this.add.image(legacyLeft - 29 + 91 / 2, legacyTop + 9 / 2 - offsetIndex * 4, AssetKey.Effect, key)
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(1);

    let count = 0;
    let velocityY = -1;
    const updateEvent = this.time.addEvent({
      delay: 1000 / 60,
      loop: true,
      callback: () => {
        velocityY += 0.02;
        image.y += velocityY;
        image.setAlpha(Math.max(0, image.alpha - 0.01));
        image.setVisible(count < 30 || count % 4 >= 1);
        count += 1;

        if (image.alpha < 0.05) {
          updateEvent.remove(false);
          image.destroy();
        }
      }
    });
  }

  private breakTilesInRect(rect: Phaser.Geom.Rectangle): void {
    const startX = Math.floor(rect.left / TILE_SIZE);
    const startY = Math.floor(rect.top / TILE_SIZE);
    const endX = Math.floor(rect.right / TILE_SIZE);
    const endY = Math.floor(rect.bottom / TILE_SIZE);

    for (let tileY = startY; tileY <= endY; tileY += 1) {
      for (let tileX = startX; tileX <= endX; tileX += 1) {
        const tile = this.collisionLayer.getTileAt(tileX, tileY);
        if (!tile || (tile.index !== 5 && tile.index !== 6)) {
          continue;
        }

        const centerX = tileX * TILE_SIZE + TILE_SIZE / 2;
        const centerY = tileY * TILE_SIZE + TILE_SIZE / 2;
        if (tile.index === 5) {
          this.collisionLayer.removeTileAt(tileX, tileY);
        } else {
          this.collisionLayer.putTileAt(2, tileX, tileY);
        }
        this.playSe(AudioKey.Brock, 0.3);
        this.createBlockBreakEffect(centerX, centerY);
        this.createShockwaveEffect(centerX, centerY);
        this.spawnSpBalls(centerX, centerY, 1);
        this.trySpawnPotion(centerX, centerY);
      }
    }
  }

  private destroyRoseBulletsInRect(rect: Phaser.Geom.Rectangle): void {
    this.enemyBullets.children.each((enemyBulletObject) => {
      const enemyBullet = enemyBulletObject as EnemyBullet;
      if (
        (enemyBullet.kind === 'rose' || enemyBullet.kind === 'waterball' || enemyBullet.kind === 'flame')
        && Phaser.Geom.Intersects.RectangleToRectangle(rect, enemyBullet.getBounds())
      ) {
        enemyBullet.destroyByPlayer();
      }
      return true;
    });
  }

  private createBlockBreakEffect(x: number, y: number): void {
    const key = this.createEffectFrame('effect-block-fragment', 0, 20, 8, 8);
    for (let i = 0; i < 4; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(2.2, 4.8);
      const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      };
      const fragment = this.add.image(x, y, AssetKey.Effect, key)
        .setOrigin(0.5)
        .setDepth(10)
        .setScale(1)
        .setAlpha(1);

      this.tweens.add({
        targets: fragment,
        x: x + velocity.x * 20,
        y: y + velocity.y * 20 + 52,
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-1.2, 1.2),
        duration: 620,
        ease: 'Quad.easeOut',
        onComplete: () => fragment.destroy()
      });
    }
  }

  private spawnSpBalls(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const ball = new SpBall(this, x, y, Phaser.Math.Between(0, 359));
      this.spBalls.add(ball);
    }
  }

  private trySpawnPotion(x: number, y: number): void {
    const roll = Phaser.Math.Between(0, 9);
    if (roll === 0) {
      this.spawnPotion(x - 8, y - 16, 'red');
    } else if (roll === 1) {
      this.spawnPotion(x - 8, y - 16, 'blue');
    }
  }

  private spawnPotion(x: number, y: number, kind: PotionKind): void {
    const potion = new Potion(this, x, y, kind);
    this.potions.add(potion);
  }

  private spawnStageCollectibles(): void {
    for (const spawn of LEGACY_COLLECTIBLE_SPAWNS[this.currentStageId]) {
      const position = this.getCollectiblePosition(spawn);
      const collectible = new Collectible(this, position.x, position.y, spawn.kind);
      this.collectibles.add(collectible);
    }
  }

  private getCollectiblePosition(spawn: { x: number; y: number } | { tileX: number; tileY: number }): { x: number; y: number } {
    if ('tileX' in spawn) {
      return {
        x: spawn.tileX * TILE_SIZE + TILE_SIZE / 2,
        y: spawn.tileY * TILE_SIZE + TILE_SIZE / 2
      };
    }

    return { x: spawn.x, y: spawn.y };
  }

  private createShockwaveEffect(x: number, y: number): void {
    const source = Phaser.Utils.Array.GetRandom([
      { x: 0, y: 256 },
      { x: 256, y: 0 },
      { x: 256, y: 256 }
    ]);
    const key = this.createEffectFrame(`effect-shockwave-${source.x}-${source.y}`, source.x, source.y, 256, 256);
    const tint = Phaser.Utils.Array.GetRandom([0xffffff, 0xff7777, 0x77ffff, 0xff77ff, 0xffff77, 0x77ff77]);
    const effect = this.add.image(x, y, AssetKey.Effect, key)
      .setOrigin(0.5)
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.85)
      .setTint(tint)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
      .setScale(0.02, 0.02);

    this.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: Phaser.Math.FloatBetween(0.75, 1.05),
      scaleY: Phaser.Math.FloatBetween(0.55, 1.0),
      rotation: effect.rotation + Phaser.Math.FloatBetween(-0.9, 0.9),
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => effect.destroy()
    });
  }

  private createStarBurst(x: number, y: number): void {
    const key = this.createEffectFrame('effect-star', 8, 20, 8, 8);
    const velocities = [
      { x: Phaser.Math.FloatBetween(0, 3), y: -Phaser.Math.FloatBetween(0, 6) },
      { x: Phaser.Math.FloatBetween(0, 2), y: -Phaser.Math.FloatBetween(0, 6) },
      { x: -Phaser.Math.FloatBetween(0, 2), y: -Phaser.Math.FloatBetween(0, 6) },
      { x: -Phaser.Math.FloatBetween(0, 3), y: -Phaser.Math.FloatBetween(0, 6) }
    ];

    for (const velocity of velocities) {
      const star = this.add.image(x, y, AssetKey.Effect, key)
        .setOrigin(0.5)
        .setDepth(10)
        .setScale(1.4)
        .setAlpha(1);

      this.tweens.add({
        targets: star,
        x: x + velocity.x * 18,
        y: y + velocity.y * 18 + 28,
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-1.5, 1.5),
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      });
    }
  }

  private hasSpaceAbove(enemy: Enemy): boolean {
    const bounds = enemy.getBounds();
    return !this.collisionLayer.hasTileAtWorldXY(bounds.left + 2, bounds.top - TILE_SIZE)
      && !this.collisionLayer.hasTileAtWorldXY(bounds.right - 2, bounds.top - TILE_SIZE);
  }

  private hasGroundAhead(enemy: Enemy, direction: 1 | -1): boolean {
    const bounds = enemy.getBounds();
    const probeX = direction > 0 ? bounds.right + 4 : bounds.left - 4;
    const probeY = bounds.bottom + 8;
    const tile = this.collisionLayer.getTileAtWorldXY(probeX, probeY);
    return Boolean(tile?.collides);
  }

  private hasPlayerFallenIntoPit(): boolean {
    return this.player.y > this.collisionFloorBottomY;
  }

  private computeCollisionFloorBottomY(): number {
    let bottomY = 0;
    this.collisionLayer.forEachTile((tile) => {
      if (tile.collides) {
        bottomY = Math.max(bottomY, tile.pixelY + tile.height);
      }
    });
    return bottomY;
  }

  private hitPlayer(power: number): void {
    if (this.playerDamageLockMs > 0) {
      return;
    }

    if (this.player.takeDamage(power)) {
      this.playerDamageLockMs = 550;
      if (this.player.hp <= 0) {
        this.playDownVoiceOnce();
      } else {
        this.playRandomDamageVoice();
      }
    }
  }

  private startGameOver(): void {
    if (this.gameOverActive) {
      return;
    }

    this.playDownVoiceOnce();
    this.gameOverActive = true;
    this.gameOverDecisionActive = false;
    this.player.disableHitbox();
    this.weapon.updateFromPlayer(this.player, 0);

    const viewport = applyWideViewport(this);
    this.gameOverOverlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 0.48)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.gameOverImage = this.add.image(viewport.width / 2, 132, AssetKey.GameOver)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0);
    this.layoutGameOverImage(viewport.width);

    this.tweens.add({
      targets: this.gameOverImage,
      alpha: 1,
      y: 150,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.gameOverDecisionActive = true;
      }
    });

    this.createGameOverMenu(viewport.width);
  }

  private createGameOverMenu(viewportWidth: number): void {
    this.gameOverItems = [];
    const menu = [
      { choice: 'retry' as const, text: 'RETRY' },
      { choice: 'title' as const, text: 'TITLE' }
    ];
    const startY = 285;

    for (let index = 0; index < menu.length; index += 1) {
      const y = startY + index * 58;
      const rect = this.add.rectangle(viewportWidth / 2, y, 210, 42, 0xffffff, 0.16)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(viewportWidth / 2, y, menu[index].text, {
        color: '#f6f1d2',
        fontFamily: 'Verdana, sans-serif',
        fontSize: '20px',
        letterSpacing: 0
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1002).setInteractive({ useHandCursor: true });

      rect.on('pointerover', () => this.selectGameOverItem(index));
      rect.on('pointerdown', () => this.decideGameOverItem());
      label.on('pointerover', () => this.selectGameOverItem(index));
      label.on('pointerdown', () => this.decideGameOverItem());

      this.gameOverItems.push({
        choice: menu[index].choice,
        label,
        rect
      });
    }

    this.selectGameOverItem(0);
  }

  private updateGameOverMenu(): void {
    if (!this.gameOverDecisionActive) {
      return;
    }

    if (this.gameOverUpKey && Phaser.Input.Keyboard.JustDown(this.gameOverUpKey)) {
      this.selectGameOverItem(this.gameOverSelectedIndex - 1);
    }
    if (this.gameOverDownKey && Phaser.Input.Keyboard.JustDown(this.gameOverDownKey)) {
      this.selectGameOverItem(this.gameOverSelectedIndex + 1);
    }
    if (this.gameOverEnterKey && Phaser.Input.Keyboard.JustDown(this.gameOverEnterKey)) {
      this.decideGameOverItem();
    }
  }

  private selectGameOverItem(index: number): void {
    if (this.gameOverItems.length <= 0) {
      return;
    }

    this.gameOverSelectedIndex = Phaser.Math.Wrap(index, 0, this.gameOverItems.length);
    for (let itemIndex = 0; itemIndex < this.gameOverItems.length; itemIndex += 1) {
      const item = this.gameOverItems[itemIndex];
      const selected = itemIndex === this.gameOverSelectedIndex;
      item.rect.setFillStyle(0xffffff, selected ? 0.38 : 0.16);
      item.rect.setStrokeStyle(2, selected ? 0xf6f1d2 : 0x7f8da0, selected ? 0.85 : 0.35);
      item.label.setColor(selected ? '#ffffff' : '#d7e7ec');
    }
  }

  private layoutGameOverUi(viewportWidth: number): void {
    this.gameOverOverlay?.setSize(viewportWidth, SCREEN_HEIGHT);
    this.gameOverTransitionOverlay?.setSize(viewportWidth, SCREEN_HEIGHT);
    this.layoutGameOverImage(viewportWidth);

    const startY = 285;
    for (let index = 0; index < this.gameOverItems.length; index += 1) {
      const y = startY + index * 58;
      this.gameOverItems[index].rect.setPosition(viewportWidth / 2, y);
      this.gameOverItems[index].label.setPosition(viewportWidth / 2, y);
    }
  }

  private decideGameOverItem(): void {
    if (!this.gameOverDecisionActive) {
      return;
    }

    const choice = this.gameOverItems[this.gameOverSelectedIndex]?.choice;
    if (!choice) {
      return;
    }

    this.gameOverDecisionActive = false;
    this.hideGameOverChoices();
    if (choice === 'retry') {
      this.fadeOutForRetry();
    } else {
      this.fadeOutToTitle();
    }
  }

  private updateFrozenEnemies(deltaMs: number): void {
    this.enemies.children.each((enemyObject) => {
      const enemy = enemyObject as Enemy;
      enemy.updateFrozen(deltaMs);
      return true;
    });
  }

  private layoutGameOverImage(viewportWidth: number): void {
    if (!this.gameOverImage) {
      return;
    }

    const source = this.textures.get(AssetKey.GameOver).getSourceImage() as HTMLImageElement;
    const scale = Math.min(1, (viewportWidth * 0.72) / source.width, 190 / source.height);
    this.gameOverImage
      .setScale(scale)
      .setPosition(viewportWidth / 2, this.gameOverImage.y);
  }

  private hideGameOverChoices(): void {
    const targets: Phaser.GameObjects.GameObject[] = [];
    if (this.gameOverImage) {
      targets.push(this.gameOverImage);
    }
    for (const item of this.gameOverItems) {
      targets.push(item.rect, item.label);
    }

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 220,
      ease: 'Sine.easeOut'
    });
  }

  private fadeOutForRetry(): void {
    const overlay = this.createGameOverTransitionOverlay();
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 650,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.retryCurrentStage();
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 650,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            overlay.destroy();
            if (this.gameOverTransitionOverlay === overlay) {
              this.gameOverTransitionOverlay = undefined;
            }
          }
        });
      }
    });
  }

  private fadeOutToTitle(): void {
    const overlay = this.createGameOverTransitionOverlay();
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 650,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.start('TitleScene');
      }
    });
  }

  private createGameOverTransitionOverlay(): Phaser.GameObjects.Rectangle {
    const viewport = applyWideViewport(this);
    if (this.gameOverTransitionOverlay?.active) {
      return this.gameOverTransitionOverlay;
    }

    this.gameOverTransitionOverlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1100)
      .setAlpha(0);
    return this.gameOverTransitionOverlay;
  }

  private retryCurrentStage(): void {
    const stage = LEGACY_STAGES[this.currentStageId];
    this.clearGameOverUi();
    this.resetStageActorsForRetry();
    this.player.respawnAt(stage.playerSpawn.x, stage.playerSpawn.y);
    this.fairy.setPosition(this.player.x + 12, this.player.y - 18);
    this.fairy.setVelocity(0, 0);
    this.configureWideCamera();
    this.cameras.main.pan(stage.playerSpawn.x, stage.playerSpawn.y, 1);
    this.gameOverActive = false;
    this.gameOverDecisionActive = false;
    this.downVoicePlayed = false;
    this.playerDamageLockMs = 850;
    this.hud.update(this.player);
  }

  private resetStageActorsForRetry(): void {
    this.bossSpawnDelayEvent?.remove(false);
    this.bossSpawnDelayEvent = undefined;
    this.bosses.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.bullets.clear(true, true);
    this.spBalls.clear(true, true);
    this.collectibles.clear(true, true);
    this.potions.clear(true, true);
    this.chargeEffect?.destroy();
    this.chargeEffect = undefined;
    this.chargeEffectFrame = 0;
    this.chargeEffectTimerMs = 0;

    this.spawnStates = LEGACY_ENEMY_SPAWNS[this.currentStageId].map((spawn) => ({
      ...spawn,
      spawned: false,
      wasInRange: false
    }));
    this.bossSpawned = BOSS_SPAWNS[this.currentStageId].map(() => false);
    this.bossCameraLockLeft = 0;
    this.bossEncounterReady = false;
    this.bossEncounterTriggered = false;
    this.bossClearScheduled = false;
    this.bossSummonedEnemies.clear();
    this.swordHitEnemies.clear();
    this.swordHitBosses.clear();
    this.spawnStageCollectibles();
  }

  private clearGameOverUi(): void {
    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = undefined;
    this.gameOverImage?.destroy();
    this.gameOverImage = undefined;
    for (const item of this.gameOverItems) {
      item.rect.destroy();
      item.label.destroy();
    }
    this.gameOverItems = [];
  }

  private resetTransientOverlays(): void {
    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = undefined;
    this.gameOverImage?.destroy();
    this.gameOverImage = undefined;
    this.warpTransitionOverlay?.destroy();
    this.warpTransitionOverlay = undefined;
    this.gameOverTransitionOverlay?.destroy();
    this.gameOverTransitionOverlay = undefined;
    for (const item of this.gameOverItems) {
      item.rect.destroy();
      item.label.destroy();
    }
    this.gameOverItems = [];
  }

  private startWarpTransition(warp: GimmickWarp): void {
    if (this.warpTransitionActive) {
      return;
    }

    this.warpTransitionActive = true;
    this.stopWarpActors();
    this.physics.world.pause();

    const overlay = this.createWarpTransitionOverlay();
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 360,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        warp.teleport(this.player);
        const target = warp.getTargetPosition();
        this.cameras.main.centerOn(target.x, target.y);
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 360,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            overlay.destroy();
            if (this.warpTransitionOverlay === overlay) {
              this.warpTransitionOverlay = undefined;
            }
            this.gimmicks.resetWarpCooldown();
            this.physics.world.resume();
            this.warpTransitionActive = false;
          }
        });
      }
    });
  }

  private createWarpTransitionOverlay(): Phaser.GameObjects.Rectangle {
    const viewport = applyWideViewport(this);
    if (this.warpTransitionOverlay?.active) {
      this.warpTransitionOverlay.setSize(viewport.width, SCREEN_HEIGHT);
      return this.warpTransitionOverlay;
    }

    this.warpTransitionOverlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0);
    return this.warpTransitionOverlay;
  }

  private stopWarpActors(): void {
    this.player.setVelocity(0, 0);
    this.stopGroupVelocity(this.enemies);
    this.stopGroupVelocity(this.bosses);
    this.stopGroupVelocity(this.enemyBullets);
    this.stopGroupVelocity(this.bullets);
    this.stopGroupVelocity(this.spBalls);
    this.stopGroupVelocity(this.potions);
  }

  private stopGroupVelocity(group: Phaser.GameObjects.Group): void {
    group.children.each((child) => {
      const body = (child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body }).body;
      body?.setVelocity(0, 0);
      return true;
    });
  }

  private getProjectileKnockback(projectile: PlayerBullet, direction: 1 | -1): { x: number; y: number } {
    if (projectile.kind === 'sword2') {
      return { x: direction * 420, y: -80 };
    }
    if (projectile.kind === 'sword1') {
      return { x: direction * 420, y: -360 };
    }
    if (projectile.kind === 'arrow2') {
      return { x: direction * 420, y: -360 };
    }
    return { x: direction * 120, y: -180 };
  }

  private manageEnemySpawns(): void {
    const camera = this.cameras.main;
    const spawnRect = new Phaser.Geom.Rectangle(
      camera.worldView.x - ENEMY_SPAWN_PADDING_X,
      camera.worldView.y - ENEMY_SPAWN_PADDING_Y,
      camera.worldView.width + ENEMY_SPAWN_PADDING_X * 2,
      camera.worldView.height + ENEMY_SPAWN_PADDING_Y * 2
    );
    const deleteRect = new Phaser.Geom.Rectangle(
      camera.worldView.x - ENEMY_DELETE_PADDING_X,
      camera.worldView.y - ENEMY_DELETE_PADDING_Y,
      camera.worldView.width + ENEMY_DELETE_PADDING_X * 2,
      camera.worldView.height + ENEMY_DELETE_PADDING_Y * 2
    );

    for (const state of this.spawnStates) {
      if (state.enemy && !state.enemy.active) {
        state.enemy = undefined;
        state.spawned = false;
      }

      if (state.enemy && !deleteRect.contains(state.enemy.x, state.enemy.y)) {
        state.enemy.destroy();
        state.enemy = undefined;
        state.spawned = false;
      }

      const inRange = spawnRect.contains(state.x, state.y);
      if (inRange && !state.wasInRange && !state.spawned) {
        const enemy = new Enemy(this, state.x, state.y, state.kind);
        state.enemy = enemy;
        state.spawned = true;
        this.enemies.add(enemy);
        this.physics.add.collider(enemy, this.collisionLayer);
      }

      state.wasInRange = inRange;
    }
  }

  private manageBossSpawns(): void {
    if (this.bossEncounterTriggered || !this.shouldTriggerBossEncounter()) {
      return;
    }

    const lockLeft = this.getBossCameraLockLeft();
    if (this.cameras.main.scrollX < lockLeft) {
      return;
    }

    this.bossEncounterTriggered = true;
    this.bossCameraLockLeft = lockLeft;
    this.applyCameraBounds();
    this.applyBossArenaLock();
    const delayMs = BOSS_ENCOUNTERS[this.currentStageId].fadeDelayMs;
    this.bossSpawnDelayEvent = this.time.delayedCall(delayMs, () => {
      this.bossSpawnDelayEvent = undefined;
      this.spawnBossEncounter();
    });
  }

  private shouldTriggerBossEncounter(): boolean {
    const encounter = BOSS_ENCOUNTERS[this.currentStageId];
    if (encounter.triggerWhenMapRightReached) {
      return this.cameras.main.worldView.right >= this.worldWidth - 8;
    }

    const firstBossX = Math.min(...BOSS_SPAWNS[this.currentStageId].map((spawn) => spawn.x));
    return this.player.x >= firstBossX - (encounter.triggerLeadX ?? 0);
  }

  private spawnBossEncounter(): void {
    const spawns = BOSS_SPAWNS[this.currentStageId];
    for (let index = 0; index < spawns.length; index += 1) {
      if (this.bossSpawned[index]) {
        continue;
      }

      const spawn = spawns[index];
      const boss = new Boss(this, spawn.x, spawn.y, spawn.kind, spawn.direction);
      this.bosses.add(boss);
      if (boss.kind === 'boss1' || boss.kind === 'boss2') {
        this.physics.add.collider(
          boss,
          this.collisionLayer,
          undefined,
          (bossObject) => (bossObject as Boss).canCollideWithTerrain()
        );
      }
      this.bossSpawned[index] = true;
    }
    this.fadeInBossEncounter();
  }

  private fadeInBossEncounter(): void {
    const bosses = this.bosses.getChildren() as Boss[];
    for (const boss of bosses) {
      boss.setPresentationAlpha(0);
    }

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: BOSS_ENCOUNTERS[this.currentStageId].fadeDurationMs,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const alpha = tween.getValue() ?? 1;
        for (const boss of bosses) {
          if (boss.active) {
            boss.setPresentationAlpha(alpha);
          }
        }
      },
      onComplete: () => {
        for (const boss of bosses) {
          if (boss.active) {
            boss.setPresentationAlpha(1);
          }
        }
        this.bossEncounterReady = true;
      }
    });
  }

  private applyBossArenaLock(): void {
    if (!this.bossEncounterTriggered) {
      return;
    }

    const minX = this.bossCameraLockLeft;
    this.clampPlayerLeft(minX);
  }

  private clampPlayerLeft(minX: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body || body.left >= minX) {
      return;
    }

    this.player.x += minX - body.left;
    body.updateFromGameObject();
    if (body.velocity.x < 0) {
      body.setVelocityX(0);
    }
  }

  private getBossCameraLockLeft(): number {
    const camera = this.cameras.main;
    const maxCameraLeft = Math.max(0, this.worldWidth - camera.width);
    return Math.min(BOSS_ENCOUNTERS[this.currentStageId].lockLeftX, maxCameraLeft);
  }

  private spawnBossEnemy(kind: EnemyKind, x: number, y: number, velocityX: number, velocityY: number): void {
    const enemy = new Enemy(this, x, y, kind);
    this.enemies.add(enemy);
    this.bossSummonedEnemies.add(enemy);
    this.physics.add.collider(enemy, this.collisionLayer);
    enemy.setVelocity(velocityX, velocityY);
  }

  private applyBossContact(): void {
    if (this.playerDamageLockMs > 0 || !this.bossEncounterReady) {
      return;
    }

    const playerBounds = this.player.getBounds();
    this.bosses.children.each((bossObject) => {
      const boss = bossObject as Boss;
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, boss.getContactBounds())) {
        this.hitPlayer(boss.contactDamage);
      }
      return true;
    });
  }

  private applyProjectileBossHits(projectile: PlayerBullet): void {
    if (!projectile.active || !this.bossEncounterReady) {
      return;
    }

    const projectileBounds = projectile.getBounds();
    this.bosses.children.each((bossObject) => {
      if (!projectile.active) {
        return false;
      }

      const boss = bossObject as Boss;
      if (!projectile.canDamageEnemy(boss)) {
        return true;
      }
      if (!Phaser.Geom.Intersects.RectangleToRectangle(projectileBounds, boss.getDamageBounds())) {
        return true;
      }

      const bulletBody = projectile.body as Phaser.Physics.Arcade.Body | null;
      const bulletDirection = (bulletBody?.velocity.x ?? 0) >= 0 ? 1 : -1;
      const bulletKnockback = this.getProjectileKnockback(projectile, bulletDirection);
      const damage = boss.damage(projectile.power * this.player.atk, {
        allowDuringHurt: projectile.kind === 'sword2',
        knockback: {
          x: bulletKnockback.x,
          y: bulletKnockback.y
        }
      });
      this.handleBossDamageFeedback(boss, damage, projectile.kind === 'arrow1' || projectile.kind === 'arrow2');
      projectile.markHit(boss);
      return true;
    });
  }

  private handleBossDamageFeedback(
    boss: Boss,
    damage: { amount: number; defeated: boolean; hit: boolean },
    arrowHit: boolean
  ): void {
    if (damage.defeated) {
      this.playSe(AudioKey.EnemyDown, 0.6);
      this.player.gainExp(boss.expValue);
      this.spawnSpBalls(boss.x + boss.displayWidth / 2, boss.y + boss.displayHeight / 2, 8);
      if (boss.kind === 'boss1') {
        this.defeatBossSummonedEnemies();
      }
    }

    if (!damage.hit) {
      return;
    }

    if (arrowHit) {
      this.playSe(AudioKey.ArrowAttack, 0.5);
    } else {
      this.playRandomSwordSe();
    }

    const bounds = boss.getDamageBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    this.createDamageNumber(centerX, bounds.y - 10, damage.amount);
    this.createImpactEffect(centerX, centerY);
    this.spawnSpBalls(centerX, centerY, 2);
  }

  private checkBossClear(): void {
    if (this.bossClearScheduled || !this.bossEncounterReady || !this.bossSpawned.every(Boolean)) {
      return;
    }

    const activeBoss = this.bosses.getChildren().some((bossObject) => (bossObject as Boss).active);
    if (activeBoss) {
      return;
    }

    this.bossClearScheduled = true;
    this.time.delayedCall(2500, () => {
      this.fadeOutToNextStage();
    });
  }

  private defeatBossSummonedEnemies(): void {
    for (const enemy of this.bossSummonedEnemies) {
      if (enemy.active) {
        enemy.forceDefeat();
      }
    }
    this.bossSummonedEnemies.clear();
  }

  private fadeOutToNextStage(): void {
    const viewport = applyWideViewport(this);
    const overlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0);

    const resizeOverlay = (): void => {
      const nextViewport = applyWideViewport(this);
      overlay.setSize(nextViewport.width, SCREEN_HEIGHT);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, resizeOverlay);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scale.off(Phaser.Scale.Events.RESIZE, resizeOverlay);
        if (this.currentStageId < 2) {
          this.scene.start('StageScene', {
            playerState: this.player.createStateSnapshot(),
            stageId: (this.currentStageId + 1) as LegacyStageId
          });
        } else {
          this.scene.start('EndingScene');
        }
      }
    });
  }

  private spawnEnemyBullet(
    kind: EnemyBulletKind,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    hasGravity = false
  ): void {
    const spawnY = kind === 'rose' ? this.findRoseFloorY(x, y) : y;
    if (spawnY === undefined) {
      return;
    }

    const bullet = new EnemyBullet(this, x, spawnY, kind, velocityX, velocityY, hasGravity);
    this.enemyBullets.add(bullet);
    if (kind === 'cloud') {
      if (this.thunderSfxCountThisTick < 3) {
        this.thunderSfxCountThisTick += 1;
        this.playSe(AudioKey.Thunder, 0.55);
      }
    } else if (kind === 'flame') {
      this.playSe(AudioKey.Fire, 0.5);
    } else if (kind === 'rose') {
      this.playSe(AudioKey.Plant, 0.55);
    }
  }

  private findRoseFloorY(x: number, fromY: number): number | undefined {
    const worldBottom = this.physics.world.bounds.bottom;

    for (let probeY = fromY; probeY <= worldBottom; probeY += 2) {
      const tile = this.collisionLayer.getTileAtWorldXY(x, probeY + 1);
      if (tile?.collides) {
        return tile.y * TILE_SIZE;
      }
    }

    return undefined;
  }

  private playRandomSwordSe(): void {
    this.playSe(Phaser.Math.Between(0, 1) === 0 ? AudioKey.Sword1 : AudioKey.Sword2, 0.5);
  }

  private playPendingPlayerSfx(): void {
    const attackKeys = [AudioKey.Attack1, AudioKey.Attack1, AudioKey.Attack2];
    for (const attackIndex of this.player.consumeNormalAttackSfxRequests()) {
      this.playSe(attackKeys[Phaser.Math.Clamp(attackIndex, 0, attackKeys.length - 1)], 0.52);
    }

    const levelUps = this.player.consumeLevelUpSfxCount();
    for (let index = 0; index < levelUps; index += 1) {
      this.playSe(AudioKey.LevelUp, 0.6);
      this.createLevelUpEffect(index);
    }
  }

  private playBoss1WaterMotionSe(): void {
    const sound = this.sound.add(AudioKey.Boss1Batabata, { volume: 0.55 }) as
      Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    sound.play();
    this.time.delayedCall(650, () => {
      this.tweens.addCounter({
        from: 0.55,
        to: 0,
        duration: 360,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => sound.setVolume(tween.getValue() ?? 0),
        onComplete: () => {
          sound.stop();
          sound.destroy();
        }
      });
    });
  }

  private playRandomDamageVoice(): void {
    this.playSe(Phaser.Math.Between(0, 1) === 0 ? AudioKey.VoiceDamage1 : AudioKey.VoiceDamage2, 0.75);
  }

  private playDownVoiceOnce(): void {
    if (this.downVoicePlayed) {
      return;
    }

    this.downVoicePlayed = true;
    this.playSe(Phaser.Math.Between(0, 1) === 0 ? AudioKey.VoiceDown1 : AudioKey.VoiceDown2, 0.82);
  }

  private playSe(key: string, volume = 0.5): void {
    this.sound.play(key, { volume });
  }
  private startStageBgm(): void {
    const bgmKey = [AudioKey.BgmStage1, AudioKey.BgmStage2, AudioKey.BgmStage3][this.currentStageId];
    this.sound.stopByKey(AudioKey.Title);
    this.sound.stopByKey(AudioKey.BgmStage1);
    this.sound.stopByKey(AudioKey.BgmStage2);
    this.sound.stopByKey(AudioKey.BgmStage3);
    this.bgm = this.sound.add(bgmKey, { loop: true, volume: 0.38 });
    this.bgm.play();
  }

  private playStageFadeIn(): void {
    const viewport = applyWideViewport(this);
    const overlay = this.add.rectangle(0, 0, viewport.width, SCREEN_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000);

    const resizeOverlay = (): void => {
      const nextViewport = applyWideViewport(this);
      overlay.setSize(nextViewport.width, SCREEN_HEIGHT);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, resizeOverlay);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scale.off(Phaser.Scale.Events.RESIZE, resizeOverlay);
        overlay.destroy();
      }
    });
  }

  private updateBackground(): void {
    const camera = this.cameras.main;
    const parallaxOffsetX = Math.abs(camera.scrollX * BACKGROUND_SCROLL_FACTOR_X);
    this.background.setPosition(0, 0);
    this.background.setDisplaySize(Math.max(1280, camera.width + parallaxOffsetX + 160), 540);
  }

  private configureWideCamera(): void {
    const viewport = applyWideViewport(this);
    this.applyCameraBounds();
    this.cameras.main.setDeadzone(CAMERA_DEADZONE_X, CAMERA_DEADZONE_Y);
    this.background?.setDisplaySize(Math.max(1280, viewport.width + 80), 540);
    this.warpTransitionOverlay?.setSize(viewport.width, SCREEN_HEIGHT);
    this.layoutGameOverUi(viewport.width);
  }

  private applyCameraBounds(): void {
    const camera = this.cameras.main;
    const left = this.bossEncounterTriggered ? this.bossCameraLockLeft : 0;
    camera.setBounds(left, 0, Math.max(1, this.worldWidth - left), this.worldHeight);
  }

  private updateChargeEffect(deltaMs: number): void {
    const chargeRatio = this.player.getChargeRatio();
    if (chargeRatio <= 0) {
      this.chargeEffect?.setVisible(false);
      return;
    }

    const rowY = this.player.getWeaponMode() === 'arrow'
      ? chargeRatio >= 1 ? 84 : 42
      : chargeRatio >= 1 ? 126 : 42;

    this.chargeEffectTimerMs += deltaMs;
    while (this.chargeEffectTimerMs >= 84) {
      this.chargeEffectTimerMs -= 84;
      this.chargeEffectFrame = (this.chargeEffectFrame + 1) % 5;
    }

    const key = this.createEffectFrame(
      `effect-charge-${rowY}-${this.chargeEffectFrame}`,
      this.chargeEffectFrame * 42,
      rowY,
      42,
      42
    );

    if (!this.chargeEffect) {
      this.chargeEffect = this.add.image(0, 0, AssetKey.Effect, key)
        .setOrigin(0.5)
        .setDepth(6)
        .setBlendMode(Phaser.BlendModes.ADD);
    }

    this.chargeEffect
      .setFrame(key)
      .setVisible(true)
      .setPosition(this.player.x, this.player.y)
      .setAlpha(0.55 + chargeRatio * 0.35);
  }

  private shouldDrawMapTile(tile: number): boolean {
    if (this.currentStageId === 1) {
      return tile >= 5;
    }

    return tile > 0;
  }
}
