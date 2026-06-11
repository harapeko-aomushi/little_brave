import Phaser from 'phaser';
import { AssetKey } from '../data/constants';
import { Player } from './Player';

type Crop = {
  h: number;
  w: number;
  x: number;
  y: number;
};

const crop = (x: number, y: number, w: number, h: number): Crop => ({ x, y, w, h });

const LABELS = {
  life: crop(119, 2, 27, 12),
  sp: crop(119, 15, 22, 11),
  lv: crop(2, 36, 24, 12),
  exp: crop(147, 2, 25, 15),
  expBase: crop(2, 65, 134, 7),
  expFill: crop(2, 74, 130, 3),
  slash: crop(82, 79, 8, 12),
  spLeft: crop(2, 2, 4, 12),
  spCase: crop(4, 2, 109, 12),
  spRight: crop(112, 2, 2, 12),
  spBack: crop(2, 16, 108, 8),
  spMask: crop(2, 26, 108, 8)
};

const HUD_DEPTH = 1000;

export class StatusHud {
  private readonly scene: Phaser.Scene;
  private readonly chargeFill: Phaser.GameObjects.Image;
  private readonly expFill: Phaser.GameObjects.Image;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private readonly modeIcon: Phaser.GameObjects.Image;
  private readonly potionDigits: Phaser.GameObjects.Image[] = [];
  private readonly potionIcons: Phaser.GameObjects.Image[] = [];
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly spMask: Phaser.GameObjects.Image;
  private readonly statusDigits: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.portrait = scene.add.image(10, 42, AssetKey.Chara, this.ensureFrame(AssetKey.Chara, 'portrait-0', crop(0, 0, 150, 180)))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.drawStatusCrop(scene, LABELS.lv, 106, 51, 1.0);
    this.drawStatusCrop(scene, LABELS.exp, 198, 51, 1.0);
    this.drawStatusCrop(scene, LABELS.life, 106, 88, 1.0);
    this.drawStatusCrop(scene, LABELS.sp, 106, 121, 1.0);

    this.drawStatusCrop(scene, LABELS.expBase, 236, 57, 1.0);
    this.expFill = this.drawStatusCrop(scene, LABELS.expFill, 238, 59, 1.0);

    this.drawStatusCrop(scene, LABELS.spLeft, 150, 118, 1.0);
    this.drawStatusCrop(scene, LABELS.spCase, 154, 118, 1.0);
    this.drawStatusCrop(scene, LABELS.spRight, 263, 118, 1.0);
    this.drawStatusCrop(scene, LABELS.spBack, 153, 120, 1.0);
    this.spMask = this.drawStatusCrop(scene, LABELS.spMask, 153, 120, 1.0);

    this.chargeFill = this.drawStatusCrop(scene, LABELS.expFill, 238, 72, 1.0);
    this.chargeFill.setTint(0xf0b6ff);

    for (let i = 0; i < 10; i += 1) {
      const life = scene.add.image(150 + i * 21, 88, AssetKey.Life, 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH);
      this.lifeIcons.push(life);
    }

    this.modeIcon = scene.add.image(84, 112, AssetKey.Fairy, 16)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setScale(1.3)
      .setDepth(HUD_DEPTH);

    this.createPotionSlot(10, 147, 'red');
    this.createPotionSlot(50, 147, 'blue');

    for (let i = 0; i < 15; i += 1) {
      this.statusDigits.push(scene.add.image(0, 0, AssetKey.PlayerStatus)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setVisible(false)
        .setDepth(HUD_DEPTH));
    }
  }

  update(player: Player): void {
    const healthRatio = player.hp / player.maxHp;
    this.portrait.setFrame(this.ensureFrame(AssetKey.Chara, `portrait-${this.getPortraitCropX(healthRatio)}`, crop(this.getPortraitCropX(healthRatio), 0, 150, 180)));
    this.portrait.setDisplaySize(86, 100);

    for (let i = 0; i < this.lifeIcons.length; i += 1) {
      const heartValue = player.hp - i * 2;
      const visible = i < Math.ceil(player.maxHp / 2);
      this.lifeIcons[i].setVisible(visible);
      this.lifeIcons[i].setFrame(heartValue >= 2 ? 0 : heartValue === 1 ? 8 : 16);
    }

    this.expFill.setDisplaySize(Math.max(0, Math.round((player.exp / player.maxExp) * 130)), 3);
    this.spMask.setDisplaySize(Math.max(0, Math.round(((player.maxSp - player.sp) / player.maxSp) * 108)), 8);
    this.spMask.x = 153 + 108 - this.spMask.displayWidth;
    this.chargeFill.setDisplaySize(Math.round(player.getChargeRatio() * 130), 3);
    this.modeIcon.setFrame(player.getWeaponMode() === 'sword' ? 16 : 8);

    let digitIndex = 0;
    digitIndex = this.drawLevel(player.level, 146, 51, digitIndex);
    digitIndex = this.drawSmallNumber(player.sp, 156, 132, digitIndex, 4);
    this.drawStatusCropInto(this.statusDigits[digitIndex], LABELS.slash, 196, 132);
    digitIndex += 1;
    this.drawSmallNumber(player.maxSp, 206, 132, digitIndex, 4);

    this.drawPotionCount(player.redPotions, 0);
    this.drawPotionCount(player.bluePotions, 1);
  }

  private createPotionSlot(x: number, y: number, kind: 'red' | 'blue'): void {
    this.scene.add.rectangle(x, y, 34, 22, 0x0b1020, 0.72)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.85)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    const iconFrame = this.ensureFrame(
      AssetKey.Item,
      `hud-potion-${kind}`,
      crop(kind === 'red' ? 0 : 16, 8, 16, 16)
    );
    const icon = this.scene.add.image(x + 3, y + 3, AssetKey.Item, iconFrame)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.potionIcons.push(icon);

    const digit = this.scene.add.image(x + 24, y + 5, AssetKey.PlayerStatus)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.potionDigits.push(digit);
  }

  private drawPotionCount(value: number, index: number): void {
    this.drawStatusCropInto(
      this.potionDigits[index],
      crop(Math.max(0, Math.min(9, value)) * 8 + 2, 78, 8, 12),
      index === 0 ? 34 : 74,
      152
    );
  }

  private drawLevel(value: number, x: number, y: number, firstSprite: number): number {
    const tens = value >= 10 ? 1 : 0;
    this.drawStatusCropInto(this.statusDigits[firstSprite], crop(30 + tens * 15, 36, 15, 12), x, y);
    this.drawStatusCropInto(this.statusDigits[firstSprite + 1], crop(30 + (value % 10) * 15, 36, 15, 12), x + 15, y);
    return firstSprite + 2;
  }

  private drawSmallNumber(value: number, x: number, y: number, firstSprite: number, maxDigits: number): number {
    const text = Math.max(0, value).toString();
    const chars = text.slice(-maxDigits).padStart(maxDigits, ' ');

    for (let i = 0; i < maxDigits; i += 1) {
      const sprite = this.statusDigits[firstSprite + i];
      const char = chars[i];
      if (char === ' ') {
        sprite.setVisible(false);
        continue;
      }

      sprite.setVisible(true);
      this.drawStatusCropInto(sprite, crop(Number(char) * 8 + 2, 78, 8, 12), x + i * 10, y);
    }

    return firstSprite + maxDigits;
  }

  private drawStatusCrop(scene: Phaser.Scene, source: Crop, x: number, y: number, scale: number): Phaser.GameObjects.Image {
    const image = scene.add.image(x, y, AssetKey.PlayerStatus)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.drawStatusCropInto(image, source, x, y, scale);
    return image;
  }

  private drawStatusCropInto(
    image: Phaser.GameObjects.Image,
    source: Crop,
    x: number,
    y: number,
    scale = 1
  ): void {
    const frame = this.ensureFrame(AssetKey.PlayerStatus, `status-${source.x}-${source.y}-${source.w}-${source.h}`, source);
    image.setTexture(AssetKey.PlayerStatus, frame);
    image.setPosition(x, y);
    image.setDisplaySize(source.w * scale, source.h * scale);
    image.setDepth(HUD_DEPTH);
    image.setVisible(true);
  }

  private ensureFrame(textureKey: string, frameKey: string, source: Crop): string {
    const texture = this.scene.textures.get(textureKey);
    if (!texture.has(frameKey)) {
      texture.add(frameKey, 0, source.x, source.y, source.w, source.h);
    }
    return frameKey;
  }

  private getPortraitCropX(healthRatio: number): number {
    if (healthRatio >= 0.7) {
      return 0;
    }
    if (healthRatio >= 0.3) {
      return 150;
    }
    if(healthRatio == 0) {
      return 450;
    }
    return 300;
  }
}
