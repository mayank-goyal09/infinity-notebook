import { ClickToInkSettings } from '../types/document';

export type ClickToInkState = 'idle' | 'armed' | 'inking' | 'lifted';

export interface ClickToInkCallbacks {
  onStartStroke: (x: number, y: number, pressure: number) => void;
  onMoveStroke: (x: number, y: number, pressure: number) => void;
  onEndStroke: (commit: boolean) => void;
  onStateChange: (state: ClickToInkState) => void;
  onEdgePan?: (dx: number, dy: number) => void;
}

export class ClickToInkFSM {
  private state: ClickToInkState = 'idle';
  private settings: ClickToInkSettings;
  private callbacks: ClickToInkCallbacks;
  private pauseTimer: number | null = null;
  private strokeStartTime = 0;
  private strokeStartPos = { x: 0, y: 0 };
  private totalStrokeDistance = 0;
  private lastPos = { x: 0, y: 0 };
  private audioCtx: AudioContext | null = null;

  constructor(settings: ClickToInkSettings, callbacks: ClickToInkCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.state = settings.enabled ? 'armed' : 'idle';
  }

  public getState(): ClickToInkState {
    return this.state;
  }

  public updateSettings(settings: Partial<ClickToInkSettings>) {
    this.settings = { ...this.settings, ...settings };
    if (!this.settings.enabled && this.state !== 'idle') {
      if (this.state === 'inking') {
        this.callbacks.onEndStroke(true);
      }
      this.transitionTo('idle');
    } else if (this.settings.enabled && this.state === 'idle') {
      this.transitionTo('armed');
    }
  }

  public setEnabled(enabled: boolean) {
    this.updateSettings({ enabled });
  }

  public handlePointerDown(screenX: number, screenY: number, docX: number, docY: number, pressure: number, e: PointerEvent) {
    if (!this.settings.enabled) return false;

    // Alt key overrides Click-to-Ink to use normal press-and-hold
    if (e.altKey) {
      return false; // let normal handler process it
    }

    if (this.state === 'armed') {
      // First click: Transition to Inking!
      this.strokeStartTime = performance.now();
      this.strokeStartPos = { x: docX, y: docY };
      this.lastPos = { x: docX, y: docY };
      this.totalStrokeDistance = 0;
      this.playTickSound(true);
      this.transitionTo('inking');
      this.callbacks.onStartStroke(docX, docY, pressure);
      this.resetPauseTimer();
      return true; // handled
    } else if (this.state === 'inking') {
      // Second click: End stroke!
      if (this.settings.endTrigger === 'click') {
        this.commitOrCancelStroke();
        return true;
      }
    }

    return false;
  }

  public handlePointerMove(screenX: number, screenY: number, docX: number, docY: number, pressure: number, viewportWidth: number, viewportHeight: number) {
    if (this.state === 'armed') {
      // Pointer is hovering, pen is up
      return;
    }

    if (this.state === 'lifted') {
      // Temporary pen lift (Space held) - hovering without drawing
      this.lastPos = { x: docX, y: docY };
      return;
    }

    if (this.state === 'inking') {
      const dist = Math.hypot(docX - this.lastPos.x, docY - this.lastPos.y);
      this.totalStrokeDistance += dist;
      this.lastPos = { x: docX, y: docY };

      this.callbacks.onMoveStroke(docX, docY, pressure);
      this.resetPauseTimer();

      // Viewport Edge Auto-Pan check
      if (this.settings.edgeAutoPan && this.callbacks.onEdgePan) {
        const edgeThreshold = 35;
        let panX = 0;
        let panY = 0;

        if (screenX < edgeThreshold) panX = 14;
        else if (screenX > viewportWidth - edgeThreshold) panX = -14;

        if (screenY < edgeThreshold) panY = 14;
        else if (screenY > viewportHeight - edgeThreshold) panY = -14;

        if (panX !== 0 || panY !== 0) {
          this.callbacks.onEdgePan(panX, panY);
        }
      }
    }
  }

  public handleDoubleClick(docX: number, docY: number) {
    if (this.state === 'inking' && this.settings.endTrigger === 'double_click') {
      this.commitOrCancelStroke();
      return true;
    }
    return false;
  }

  public handleKeyDown(e: KeyboardEvent) {
    if (this.state === 'inking') {
      if (e.key === 'Escape') {
        // Discard / cancel stroke
        e.preventDefault();
        this.cancelStroke();
        return true;
      }
      if (e.key === 'Enter') {
        // End stroke and commit
        e.preventDefault();
        this.commitOrCancelStroke();
        return true;
      }
      if (e.code === 'Space' && !e.repeat) {
        // Temporary pen lift: hold Space to move without drawing!
        e.preventDefault();
        this.transitionTo('lifted');
        return true;
      }
    }
    return false;
  }

  public handleKeyUp(e: KeyboardEvent) {
    if (this.state === 'lifted' && e.code === 'Space') {
      // Resume inking on Space release
      e.preventDefault();
      this.transitionTo('inking');
      this.callbacks.onStartStroke(this.lastPos.x, this.lastPos.y, 0.7);
      return true;
    }
    return false;
  }

  public handleContextMenu(e: MouseEvent) {
    if (this.state === 'inking') {
      // Right-click cancels stroke safely
      e.preventDefault();
      this.cancelStroke();
      return true;
    }
    return false;
  }

  // Safety nets: trigger safe auto-end
  public handleSafetyInterruption(reason: string) {
    if (this.state === 'inking' || this.state === 'lifted') {
      // Safely auto-commit stroke so user never loses work or gets stuck
      this.commitOrCancelStroke();
    }
  }

  private commitOrCancelStroke() {
    this.clearPauseTimer();
    const duration = performance.now() - this.strokeStartTime;

    // Check accidental tap vs dot
    if (this.totalStrokeDistance < 6 && duration < 200) {
      if (!this.settings.dotOnTap) {
        // Accidental tap discarded
        this.callbacks.onEndStroke(false);
      } else {
        // Deliberate dot
        this.callbacks.onEndStroke(true);
      }
    } else {
      this.callbacks.onEndStroke(true);
    }

    this.playTickSound(false);
    this.transitionTo(this.settings.enabled ? 'armed' : 'idle');
  }

  private cancelStroke() {
    this.clearPauseTimer();
    this.callbacks.onEndStroke(false);
    this.playTickSound(false);
    this.transitionTo(this.settings.enabled ? 'armed' : 'idle');
  }

  private resetPauseTimer() {
    this.clearPauseTimer();
    if (this.settings.pauseToLiftEnabled && this.state === 'inking') {
      this.pauseTimer = window.setTimeout(() => {
        this.commitOrCancelStroke();
      }, this.settings.pauseToLiftMs);
    }
  }

  private clearPauseTimer() {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private transitionTo(newState: ClickToInkState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private playTickSound(isPenDown: boolean) {
    if (!this.settings.audioTick) return;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isPenDown ? 640 : 480, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch {
      // Audio context might be restricted before gesture
    }
  }
}
