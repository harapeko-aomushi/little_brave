import Phaser from 'phaser';
import { AssetKey, AudioKey, MapKey } from '../data/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.setPath('assets');
    this.load.image(AssetKey.Bg, 'images/bg.png');
    this.load.image(AssetKey.Stage1Bg, 'images/stage1_bg.png');
    this.load.image(AssetKey.Stage2Bg, 'images/stage2_bg.png');
    this.load.image(AssetKey.Stage3Bg, 'images/stage3_bg.png');
    this.load.image(AssetKey.Boss, 'images/Boss.png');
    this.load.image(AssetKey.Chara, 'images/chara.png');
    this.load.image(AssetKey.ChipRaw, 'images/chip.png');
    this.load.image(AssetKey.Effect, 'images/efect.png');
    this.load.image(AssetKey.Gauge, 'images/gauge.png');
    this.load.image(AssetKey.GameOver, 'images/gameover.png');
    this.load.image(AssetKey.Gimmick, 'images/Gimmick.png');
    this.load.image(AssetKey.Item, 'images/Item.png');
    this.load.image(AssetKey.PlayerStatus, 'images/PlayerStatus.png');
    this.load.image(AssetKey.Title, 'images/Title.png');
    this.load.image(AssetKey.Weapon, 'images/Weapon.png');
    this.load.image(AssetKey.Bullet, 'images/bullet.png');
    this.load.image(AssetKey.Enemy, 'images/Enemy.png');
    this.load.image(AssetKey.EnemyBullet, 'images/e_bullet.png');
    this.load.image(AssetKey.Ending, 'images/ending.png');
    this.load.spritesheet(AssetKey.Fairy, 'images/fairy.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(AssetKey.Life, 'images/life.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(AssetKey.Number, 'images/number.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet(AssetKey.Player, 'images/Player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.audio(AudioKey.Title, 'sound/bgm/title.mp3');
    this.load.audio(AudioKey.BgmStage1, 'sound/bgm/stage1.mp3');
    this.load.audio(AudioKey.BgmStage2, 'sound/bgm/stage2.mp3');
    this.load.audio(AudioKey.BgmStage3, 'sound/bgm/stage3.mp3');
    this.load.audio(AudioKey.Ending, 'sound/bgm/ending.mp3');
    this.load.audio(AudioKey.Arrow, 'sound/se/arrow.mp3');
    this.load.audio(AudioKey.ArrowAttack, 'sound/se/arrow_attack.mp3');
    this.load.audio(AudioKey.Attack1, 'sound/se/attack1.mp3');
    this.load.audio(AudioKey.Attack2, 'sound/se/attack2.mp3');
    this.load.audio(AudioKey.Boss1Batabata, 'sound/se/boss1_batabata.mp3');
    this.load.audio(AudioKey.Boss3AttackMotion, 'sound/se/boss3_attack_motion.mp3');
    this.load.audio(AudioKey.Boss3Water, 'sound/se/boss3_water.mp3');
    this.load.audio(AudioKey.Brock, 'sound/se/brock.mp3');
    this.load.audio(AudioKey.EnemyDown, 'sound/se/enemy_down.mp3');
    this.load.audio(AudioKey.Fire, 'sound/se/fire.mp3');
    this.load.audio(AudioKey.Heart, 'sound/se/heart.mp3');
    this.load.audio(AudioKey.Heal, 'sound/se/heal.mp3');
    this.load.audio(AudioKey.LevelUp, 'sound/se/lvup.mp3');
    this.load.audio(AudioKey.PotionBlue, 'sound/se/p_blue.mp3');
    this.load.audio(AudioKey.PotionRed, 'sound/se/p_red.mp3');
    this.load.audio(AudioKey.Plant, 'sound/se/plant.mp3');
    this.load.audio(AudioKey.Sword1, 'sound/se/sword1.mp3');
    this.load.audio(AudioKey.Sword2, 'sound/se/sword2.mp3');
    this.load.audio(AudioKey.Thunder, 'sound/se/thunder.mp3');
    this.load.audio(AudioKey.VoiceDamage1, 'voice/damage1.mp3');
    this.load.audio(AudioKey.VoiceDamage2, 'voice/damage2.mp3');
    this.load.audio(AudioKey.VoiceDown1, 'voice/down1.mp3');
    this.load.audio(AudioKey.VoiceDown2, 'voice/down2.mp3');
    this.load.binary(MapKey.Stage1, 'maps/Map1.txt');
    this.load.binary(MapKey.Stage2, 'maps/map2.txt');
    this.load.binary(MapKey.Stage3, 'maps/map3.txt');
  }

  create(): void {
    this.createTransparentChipTexture();
    this.scene.start('TitleScene');
  }

  private createTransparentChipTexture(): void {
    const source = this.textures.get(AssetKey.ChipRaw).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return;
    }

    context.drawImage(source, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] <= 4 && pixels[index + 1] <= 4 && pixels[index + 2] <= 4) {
        pixels[index + 3] = 0;
      }
    }

    context.putImageData(image, 0, 0);
    this.textures.addCanvas(AssetKey.Chip, canvas);
  }
}
