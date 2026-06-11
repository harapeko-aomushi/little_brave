import Phaser from 'phaser';

export class InputSystem {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  readonly keys: {
    attack: Phaser.Input.Keyboard.Key;
    bluePotion: Phaser.Input.Keyboard.Key;
    spinSlash: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    dash: Phaser.Input.Keyboard.Key;
    debugWarp: Phaser.Input.Keyboard.Key;
    debugSpawnLiquid: Phaser.Input.Keyboard.Key[];
    debugLevelUp: Phaser.Input.Keyboard.Key[];
    debugNextStage: Phaser.Input.Keyboard.Key[];
    debugWarpDigits: Phaser.Input.Keyboard.Key[][];
    restart: Phaser.Input.Keyboard.Key;
    redPotion: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    special: Phaser.Input.Keyboard.Key;
    upperSlash: Phaser.Input.Keyboard.Key;
    switchWeapon: Phaser.Input.Keyboard.Key;
  };
  private readonly scene: Phaser.Scene;
  private attackMouseDown = false;
  private attackMousePressed = false;
  private attackMouseReleased = false;
  private forwardMouseDown = false;
  private forwardMousePressed = false;
  private previousForwardMouseDown = false;
  private backMouseDown = false;
  private backMousePressed = false;
  private previousBackMouseDown = false;
  private specialMousePressed = false;
  private previousAttackMouseDown = false;
  private previousSpecialMouseDown = false;
  private readonly handleAuxMouseDown = (event: MouseEvent): void => {
    if (event.button !== 3 && event.button !== 4) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.button === 3) {
      this.backMouseDown = true;
      return;
    }
    this.forwardMouseDown = true;
  };

  private readonly handleAuxMouseUp = (event: MouseEvent): void => {
    if (event.button !== 3 && event.button !== 4) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.button === 3) {
      this.backMouseDown = false;
      return;
    }
    this.forwardMouseDown = false;
  };

  private readonly preventAuxClick = (event: MouseEvent): void => {
    if (event.button === 3 || event.button === 4) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private readonly releaseAuxMouseButtons = (): void => {
    this.backMouseDown = false;
    this.forwardMouseDown = false;
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.input.mouse?.disableContextMenu();
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    this.cursors = keyboard.createCursorKeys();
    this.keys = {
      attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      bluePotion: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      spinSlash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B),
      debugWarp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      debugSpawnLiquid: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
      ],
      debugLevelUp: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD)
      ],
      debugNextStage: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT)
      ],
      debugWarpDigits: Array.from({ length: 10 }, (_, index) => [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO + index),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO + index)
      ]),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      redPotion: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      special: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V),
      upperSlash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      switchWeapon: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    };

    const canvas = scene.game.canvas;
    canvas.addEventListener('mousedown', this.handleAuxMouseDown);
    canvas.addEventListener('auxclick', this.preventAuxClick);
    window.addEventListener('mouseup', this.handleAuxMouseUp, true);
    window.addEventListener('blur', this.releaseAuxMouseButtons);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('mousedown', this.handleAuxMouseDown);
      canvas.removeEventListener('auxclick', this.preventAuxClick);
      window.removeEventListener('mouseup', this.handleAuxMouseUp, true);
      window.removeEventListener('blur', this.releaseAuxMouseButtons);
    });
  }

  update(): void {
    const pointer = this.scene.input.activePointer;
    const nextAttackMouseDown = pointer.leftButtonDown();
    const nextSpecialMouseDown = pointer.rightButtonDown();
    this.attackMouseDown = nextAttackMouseDown;
    this.attackMousePressed = nextAttackMouseDown && !this.previousAttackMouseDown;
    this.attackMouseReleased = !nextAttackMouseDown && this.previousAttackMouseDown;
    this.forwardMousePressed = this.forwardMouseDown && !this.previousForwardMouseDown;
    this.backMousePressed = this.backMouseDown && !this.previousBackMouseDown;
    this.specialMousePressed = (nextSpecialMouseDown && !this.previousSpecialMouseDown)
      || this.forwardMousePressed
      || this.backMousePressed;
    this.previousAttackMouseDown = nextAttackMouseDown;
    this.previousSpecialMouseDown = nextSpecialMouseDown;
    this.previousForwardMouseDown = this.forwardMouseDown;
    this.previousBackMouseDown = this.backMouseDown;
  }

  get left(): boolean {
    return this.keys.left.isDown && !this.keys.right.isDown;
  }

  get right(): boolean {
    return this.keys.right.isDown && !this.keys.left.isDown;
  }

  get up(): boolean {
    return Boolean(this.cursors.up?.isDown);
  }

  get down(): boolean {
    return Boolean(this.cursors.down?.isDown);
  }

  get jumpPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.jump);
  }

  get attackPressed(): boolean {
    return this.attackMousePressed;
  }

  get attackHeld(): boolean {
    return this.attackMouseDown;
  }

  get attackReleased(): boolean {
    return this.attackMouseReleased;
  }

  get dashHeld(): boolean {
    return this.keys.dash.isDown;
  }

  get specialPressed(): boolean {
    return this.specialMousePressed;
  }

  get upperSlashHeld(): boolean {
    return this.keys.upperSlash.isDown || this.forwardMouseDown;
  }

  get spinSlashHeld(): boolean {
    return this.keys.spinSlash.isDown || this.backMouseDown;
  }

  get switchWeaponPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.switchWeapon);
  }

  consumeRedPotion(): boolean {
    return !this.keys.debugWarp.isDown && Phaser.Input.Keyboard.JustDown(this.keys.redPotion);
  }

  consumeBluePotion(): boolean {
    return !this.keys.debugWarp.isDown && Phaser.Input.Keyboard.JustDown(this.keys.bluePotion);
  }

  consumeDebugWarpIndex(): number | undefined {
    if (!this.keys.debugWarp.isDown) {
      return undefined;
    }

    for (let index = 0; index < this.keys.debugWarpDigits.length; index += 1) {
      if (this.keys.debugWarpDigits[index].some((key) => Phaser.Input.Keyboard.JustDown(key))) {
        return index;
      }
    }

    return undefined;
  }

  consumeDebugLevelUp(): boolean {
    return this.keys.debugWarp.isDown
      && this.keys.debugLevelUp.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  consumeDebugNextStage(): boolean {
    return this.keys.debugWarp.isDown
      && this.keys.debugNextStage.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  consumeDebugLiquidSpawn(): 'liquid2' | 'liquid3' | 'liquid1' | undefined {
    if (!this.keys.debugWarp.isDown) {
      return undefined;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.debugSpawnLiquid[0])) {
      return 'liquid2';
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.debugSpawnLiquid[1])) {
      return 'liquid3';
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.debugSpawnLiquid[2])) {
      return 'liquid1';
    }

    return undefined;
  }
}
