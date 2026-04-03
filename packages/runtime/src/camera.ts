export class Camera {
  x = 0;
  y = 0;
  zoom = 2.2;
  private worldWidth: number;
  private worldHeight: number;
  private minZoom = 1.2;
  private maxZoom = 3;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  follow(
    targetX: number,
    targetY: number,
    screenWidth: number,
    screenHeight: number,
    _dt: number
  ): void {
    this.x = targetX - screenWidth / (2 * this.zoom);
    this.y = targetY - screenHeight / (2 * this.zoom);
  }

  snapTo(targetX: number, targetY: number, screenWidth: number, screenHeight: number): void {
    this.x = targetX - screenWidth / (2 * this.zoom);
    this.y = targetY - screenHeight / (2 * this.zoom);
  }

  setZoom(nextZoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
  }

  zoomIn(step = 0.15): void {
    this.setZoom(this.zoom + step);
  }

  zoomOut(step = 0.15): void {
    this.setZoom(this.zoom - step);
  }

  getZoomRange(): { min: number; max: number } {
    return { min: this.minZoom, max: this.maxZoom };
  }
}
