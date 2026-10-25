import { CameraState } from '../types/document';

export const MIN_ZOOM = 0.10; // 10% (prevents speck-sized tables)
export const MAX_ZOOM = 5.0; // 500%

export class CameraEngine {
  private state: CameraState;
  private onChange?: (state: CameraState) => void;
  private velocityX = 0;
  private velocityY = 0;
  private animationFrameId: number | null = null;
  private zoomAnimFrameId: number | null = null;

  constructor(initialState?: Partial<CameraState>, onChange?: (state: CameraState) => void) {
    this.state = {
      x: initialState?.x ?? 0,
      y: initialState?.y ?? 0,
      zoom: initialState?.zoom ?? 1.0,
    };
    this.onChange = onChange;
  }

  public getState(): CameraState {
    return { ...this.state };
  }

  public setOnChange(fn: (state: CameraState) => void) {
    this.onChange = fn;
  }

  public screenToDoc(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.x) / this.state.zoom,
      y: (screenY - this.state.y) / this.state.zoom,
    };
  }

  public docToScreen(docX: number, docY: number): { x: number; y: number } {
    return {
      x: docX * this.state.zoom + this.state.x,
      y: docY * this.state.zoom + this.state.y,
    };
  }

  public screenDeltaToDocDelta(dx: number, dy: number): { dx: number; dy: number } {
    return {
      dx: dx / this.state.zoom,
      dy: dy / this.state.zoom,
    };
  }

  public panBy(screenDx: number, screenDy: number) {
    this.stopInertia();
    this.stopZoomAnimation();
    this.state.x += screenDx;
    this.state.y += screenDy;
    this.emitChange();
  }

  public setPan(x: number, y: number) {
    this.stopInertia();
    this.stopZoomAnimation();
    this.state.x = x;
    this.state.y = y;
    this.emitChange();
  }

  /**
   * Zoom anchored at specific screen coordinate (cursor).
   * Math:
   * (screenX - oldPanX) / oldZoom = (screenX - newPanX) / newZoom
   * => newPanX = screenX - (screenX - oldPanX) * (newZoom / oldZoom)
   */
  public zoomAt(screenX: number, screenY: number, zoomFactor: number) {
    this.stopInertia();
    this.stopZoomAnimation();
    const oldZoom = this.state.zoom;
    const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * zoomFactor));

    if (Math.abs(targetZoom - oldZoom) < 0.00001) return;

    const ratio = targetZoom / oldZoom;
    const newX = screenX - (screenX - this.state.x) * ratio;
    const newY = screenY - (screenY - this.state.y) * ratio;

    this.state.zoom = targetZoom;
    this.state.x = newX;
    this.state.y = newY;
    this.emitChange();
  }

  public setZoom(screenX: number, screenY: number, targetZoom: number) {
    this.stopInertia();
    this.stopZoomAnimation();
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    const ratio = clampedZoom / this.state.zoom;
    this.state.x = screenX - (screenX - this.state.x) * ratio;
    this.state.y = screenY - (screenY - this.state.y) * ratio;
    this.state.zoom = clampedZoom;
    this.emitChange();
  }

  public zoomToFit(bounds: { x: number; y: number; width: number; height: number }, viewportWidth: number, viewportHeight: number, padding = 60) {
    this.stopInertia();
    this.stopZoomAnimation();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const availableWidth = Math.max(100, viewportWidth - padding * 2);
    const availableHeight = Math.max(100, viewportHeight - padding * 2);

    const fitZoom = Math.min(
      availableWidth / bounds.width,
      availableHeight / bounds.height,
      3.0 // don't zoom in beyond 300% on small items
    );
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));

    // Center bounds in viewport
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    this.state.zoom = clampedZoom;
    this.state.x = viewportWidth / 2 - centerX * clampedZoom;
    this.state.y = viewportHeight / 2 - centerY * clampedZoom;
    this.emitChange();
  }

  public applyInertia(vx: number, vy: number) {
    this.stopInertia();
    this.velocityX = vx;
    this.velocityY = vy;

    const step = () => {
      if (Math.abs(this.velocityX) < 0.1 && Math.abs(this.velocityY) < 0.1) {
        this.stopInertia();
        return;
      }

      this.state.x += this.velocityX;
      this.state.y += this.velocityY;
      this.velocityX *= 0.92; // friction
      this.velocityY *= 0.92;

      this.emitChange();
      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  public stopInertia() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.velocityX = 0;
    this.velocityY = 0;
  }

  public stopZoomAnimation() {
    if (this.zoomAnimFrameId !== null) {
      cancelAnimationFrame(this.zoomAnimFrameId);
      this.zoomAnimFrameId = null;
    }
  }

  /**
   * Smoothly animates zoom level anchored at specific screen coordinate with live 60-120 FPS updates.
   */
  public smoothZoomAt(screenX: number, screenY: number, targetZoom: number, durationMs = 200) {
    this.stopInertia();
    this.stopZoomAnimation();

    const startZoom = this.state.zoom;
    const clampedTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    if (Math.abs(clampedTarget - startZoom) < 0.0001) return;

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentZoom = startZoom + (clampedTarget - startZoom) * ease;

      const ratio = currentZoom / this.state.zoom;
      this.state.x = screenX - (screenX - this.state.x) * ratio;
      this.state.y = screenY - (screenY - this.state.y) * ratio;
      this.state.zoom = currentZoom;
      this.emitChange();

      if (progress < 1) {
        this.zoomAnimFrameId = requestAnimationFrame(step);
      } else {
        this.zoomAnimFrameId = null;
      }
    };

    this.zoomAnimFrameId = requestAnimationFrame(step);
  }

  /**
   * Smoothly animates zoom and recenters bounding box with live 60-120 FPS updates.
   */
  public smoothZoomToFit(
    bounds: { x: number; y: number; width: number; height: number },
    viewportWidth: number,
    viewportHeight: number,
    padding = 60,
    durationMs = 240
  ) {
    this.stopInertia();
    this.stopZoomAnimation();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const availableWidth = Math.max(100, viewportWidth - padding * 2);
    const availableHeight = Math.max(100, viewportHeight - padding * 2);
    const fitZoom = Math.min(
      availableWidth / bounds.width,
      availableHeight / bounds.height,
      3.0
    );
    const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const targetX = viewportWidth / 2 - centerX * targetZoom;
    const targetY = viewportHeight / 2 - centerY * targetZoom;

    const startZoom = this.state.zoom;
    const startX = this.state.x;
    const startY = this.state.y;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.state.zoom = startZoom + (targetZoom - startZoom) * ease;
      this.state.x = startX + (targetX - startX) * ease;
      this.state.y = startY + (targetY - startY) * ease;
      this.emitChange();

      if (progress < 1) {
        this.zoomAnimFrameId = requestAnimationFrame(step);
      } else {
        this.zoomAnimFrameId = null;
      }
    };

    this.zoomAnimFrameId = requestAnimationFrame(step);
  }

  private emitChange() {
    if (this.onChange) {
      this.onChange({ ...this.state });
    }
  }
}
