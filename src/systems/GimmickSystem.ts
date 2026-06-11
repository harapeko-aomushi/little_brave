import Phaser from 'phaser';
import type { LegacyStageId } from '../data/legacyStages';
import { LEGACY_GIMMICKS } from '../data/legacyGimmicks';
import { GimmickPlatform } from '../entities/GimmickPlatform';
import { GimmickWarp } from '../entities/GimmickWarp';
import { Player } from '../entities/Player';

type DebugPlayerBodyState = {
  playerX: number;
  playerY: number;
  bodyX: number;
  bodyY: number;
  left: number;
  right: number;
  bottom: number;
  prevX: number;
  prevY: number;
  velocityX: number;
  velocityY: number;
  blockedDown: boolean;
  touchingDown: boolean;
};

type GimmickStandCheckDebug = {
  platformIndex: number;
  result: boolean;
  reason: string;
  platformX: number;
  platformY: number;
  platformDeltaX: number;
  platformDeltaY: number;
  previousTop: number;
  previousLeft: number;
  previousRight: number;
  currentLeft: number;
  currentRight: number;
  bodyLeft: number;
  bodyRight: number;
  bodyBottom: number;
  previousBodyBottom: number;
  velocityY: number;
  yTolerance: number;
  overlapsPrevious: boolean;
  overlapsCurrent: boolean;
  wasOnPlatformTop: boolean;
};

type GimmickCarryDebug = {
  platformIndex: number;
  platformDeltaX: number;
  platformDeltaY: number;
  snapY: number;
  expectedBodyX: number;
  expectedBodyY: number;
  expectedPlayerX: number;
  expectedPlayerY: number;
  carryBodyErrorX: number;
  carryBodyErrorY: number;
  carryErrorX: number;
  carryErrorY: number;
  before: DebugPlayerBodyState;
  after: DebugPlayerBodyState;
};

export type GimmickDebugState = {
  riding: boolean;
  ridingPlatformIndex?: number;
  standingCheck?: GimmickStandCheckDebug;
  standingChecks: GimmickStandCheckDebug[];
  carry?: GimmickCarryDebug;
};

export class GimmickSystem {
  readonly platforms: GimmickPlatform[] = [];
  readonly warps: GimmickWarp[] = [];
  private readonly player: Player;
  private ridingPlatform?: GimmickPlatform;
  private pendingWarp?: GimmickWarp;
  private warpCooldownMs = 0;
  private lastStandingChecks: GimmickStandCheckDebug[] = [];
  private lastDebugState: GimmickDebugState = {
    riding: false,
    standingChecks: []
  };

  constructor(scene: Phaser.Scene, stageId: LegacyStageId, player: Player) {
    this.player = player;
    for (const config of LEGACY_GIMMICKS[stageId]) {
      if (config.type === 'warp') {
        this.warps.push(new GimmickWarp(scene, config));
        continue;
      }
      const platform = new GimmickPlatform(scene, config);
      this.platforms.push(platform);
    }
  }

  update(deltaMs: number): void {
    this.warpCooldownMs = Math.max(0, this.warpCooldownMs - deltaMs);
    for (const platform of this.platforms) {
      platform.update(deltaMs);
    }
    for (const warp of this.warps) {
      warp.update(deltaMs, this.player);
      if (this.warpCooldownMs <= 0 && warp.overlapsPlayer(this.player)) {
        this.pendingWarp = warp;
        this.warpCooldownMs = 700;
      }
    }

    const ridingPlatform = this.findRidePlatform();
    if (!ridingPlatform) {
      this.ridingPlatform = undefined;
      this.lastDebugState = {
        riding: false,
        standingChecks: this.lastStandingChecks
      };
      return;
    }

    ridingPlatform.platform.startPattern();
    const carry = this.carryPlayer(ridingPlatform.platform, ridingPlatform.index);
    this.ridingPlatform = ridingPlatform.platform;
    this.lastDebugState = {
      riding: true,
      ridingPlatformIndex: ridingPlatform.index,
      standingCheck: ridingPlatform.check,
      standingChecks: this.lastStandingChecks,
      carry
    };
  }

  getDebugState(): GimmickDebugState {
    return this.lastDebugState;
  }

  consumeWarpRequest(): GimmickWarp | undefined {
    const warp = this.pendingWarp;
    this.pendingWarp = undefined;
    return warp;
  }

  resetWarpCooldown(cooldownMs = 700): void {
    this.warpCooldownMs = cooldownMs;
    this.pendingWarp = undefined;
  }

  private findRidePlatform(): { platform: GimmickPlatform; index: number; check: GimmickStandCheckDebug } | undefined {
    this.lastStandingChecks = [];

    if (this.ridingPlatform) {
      const index = this.platforms.indexOf(this.ridingPlatform);
      if (index >= 0) {
        const check = this.inspectPlayerStandingOn(this.ridingPlatform, index);
        this.lastStandingChecks.push(check);
        if (check.result) {
          return { platform: this.ridingPlatform, index, check };
        }
      }
    }

    for (let index = 0; index < this.platforms.length; index += 1) {
      const platform = this.platforms[index];
      if (platform === this.ridingPlatform) {
        continue;
      }

      const check = this.inspectPlayerStandingOn(platform, index);
      this.lastStandingChecks.push(check);
      if (check.result) {
        return { platform, index, check };
      }
    }

    return undefined;
  }

  private inspectPlayerStandingOn(platform: GimmickPlatform, platformIndex: number): GimmickStandCheckDebug {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return {
        platformIndex,
        result: false,
        reason: 'no-body',
        platformX: this.round(platform.x),
        platformY: this.round(platform.y),
        platformDeltaX: this.round(platform.deltaX),
        platformDeltaY: this.round(platform.deltaY),
        previousTop: this.round(platform.topY - platform.deltaY),
        previousLeft: this.round(platform.x - platform.deltaX),
        previousRight: this.round(platform.x - platform.deltaX + platform.displayWidth),
        currentLeft: this.round(platform.x),
        currentRight: this.round(platform.x + platform.displayWidth),
        bodyLeft: 0,
        bodyRight: 0,
        bodyBottom: 0,
        previousBodyBottom: 0,
        velocityY: 0,
        yTolerance: 0,
        overlapsPrevious: false,
        overlapsCurrent: false,
        wasOnPlatformTop: false
      };
    }

    const previousTop = platform.topY - platform.deltaY;
    const previousLeft = platform.x - platform.deltaX;
    const previousRight = previousLeft + platform.displayWidth;
    const currentLeft = platform.x;
    const currentRight = platform.x + platform.displayWidth;
    const overlapsPrevious = body.right > previousLeft && body.left < previousRight;
    const overlapsCurrent = body.right > currentLeft && body.left < currentRight;
    const yTolerance = Math.max(8, Math.abs(platform.deltaY) + 4);
    const previousBodyBottom = body.prev.y + body.height;
    const wasOnPlatformTop = Math.abs(body.bottom - previousTop) <= yTolerance
      || Math.abs(body.bottom - platform.topY) <= yTolerance
      || (
        body.velocity.y >= 0
        && previousBodyBottom <= previousTop + yTolerance
        && body.bottom >= previousTop - yTolerance
      );

    let reason = 'ride';
    if (!wasOnPlatformTop) {
      reason = 'top-miss';
    } else if (!overlapsPrevious && !overlapsCurrent) {
      reason = 'x-miss';
    } else if (body.velocity.y < -1) {
      reason = 'moving-up';
    }

    const result = reason === 'ride';

    return {
      platformIndex,
      result,
      reason,
      platformX: this.round(platform.x),
      platformY: this.round(platform.y),
      platformDeltaX: this.round(platform.deltaX),
      platformDeltaY: this.round(platform.deltaY),
      previousTop: this.round(previousTop),
      previousLeft: this.round(previousLeft),
      previousRight: this.round(previousRight),
      currentLeft: this.round(currentLeft),
      currentRight: this.round(currentRight),
      bodyLeft: this.round(body.left),
      bodyRight: this.round(body.right),
      bodyBottom: this.round(body.bottom),
      previousBodyBottom: this.round(previousBodyBottom),
      velocityY: this.round(body.velocity.y),
      yTolerance: this.round(yTolerance),
      overlapsPrevious,
      overlapsCurrent,
      wasOnPlatformTop
    };
  }

  private carryPlayer(platform: GimmickPlatform, platformIndex: number): GimmickCarryDebug | undefined {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    const before = this.capturePlayerBody(body);
    const expectedBodyX = body.x + platform.deltaX;
    const expectedBodyY = platform.topY - body.height;
    const snapY = expectedBodyY - body.y;
    const expectedPlayerX = this.toPlayerXFromBody(body, expectedBodyX);
    const expectedPlayerY = this.toPlayerYFromBody(body, expectedBodyY);

    body.x = expectedBodyX;
    body.y = expectedBodyY;
    body.updateCenter();
    this.player.x = expectedPlayerX;
    this.player.y = expectedPlayerY;
    body.prevFrame.set(body.x, body.y);
    body.blocked.down = true;
    body.touching.down = true;
    body.setVelocityY(0);

    const after = this.capturePlayerBody(body);

    return {
      platformIndex,
      platformDeltaX: this.round(platform.deltaX),
      platformDeltaY: this.round(platform.deltaY),
      snapY: this.round(snapY),
      expectedBodyX: this.round(expectedBodyX),
      expectedBodyY: this.round(expectedBodyY),
      expectedPlayerX: this.round(expectedPlayerX),
      expectedPlayerY: this.round(expectedPlayerY),
      carryBodyErrorX: this.round(body.x - expectedBodyX),
      carryBodyErrorY: this.round(body.y - expectedBodyY),
      carryErrorX: this.round(this.player.x - expectedPlayerX),
      carryErrorY: this.round(this.player.y - expectedPlayerY),
      before,
      after
    };
  }

  private capturePlayerBody(body: Phaser.Physics.Arcade.Body): DebugPlayerBodyState {
    return {
      playerX: this.round(this.player.x),
      playerY: this.round(this.player.y),
      bodyX: this.round(body.x),
      bodyY: this.round(body.y),
      left: this.round(body.left),
      right: this.round(body.right),
      bottom: this.round(body.bottom),
      prevX: this.round(body.prev.x),
      prevY: this.round(body.prev.y),
      velocityX: this.round(body.velocity.x),
      velocityY: this.round(body.velocity.y),
      blockedDown: body.blocked.down,
      touchingDown: body.touching.down
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toPlayerXFromBody(body: Phaser.Physics.Arcade.Body, bodyX: number): number {
    return bodyX - this.player.scaleX * (body.offset.x - this.player.displayOriginX);
  }

  private toPlayerYFromBody(body: Phaser.Physics.Arcade.Body, bodyY: number): number {
    return bodyY - this.player.scaleY * (body.offset.y - this.player.displayOriginY);
  }
}
