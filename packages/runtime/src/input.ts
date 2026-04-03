export interface Direction {
  x: number;
  y: number;
}

export class InputManager {
  private keys = new Set<string>();
  private interactPressed = false;
  private externalDir: Direction = { x: 0, y: 0 };
  private useExternal = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === "KeyE" || e.code === "Space") {
      this.interactPressed = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.keys.clear();
  }

  getDirection(): Direction {
    if (this.useExternal) {
      return this.externalDir;
    }

    let x = 0;
    let y = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  consumeInteract(): boolean {
    if (this.interactPressed) {
      this.interactPressed = false;
      return true;
    }
    return false;
  }

  /** For mobile D-pad */
  setExternalDirection(x: number, y: number): void {
    this.externalDir = { x, y };
    this.useExternal = x !== 0 || y !== 0;
  }

  /** For mobile interact button */
  pressInteract(): void {
    this.interactPressed = true;
  }
}
