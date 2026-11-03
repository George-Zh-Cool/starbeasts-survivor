/**
 * 左侧虚拟摇杆：仅在触摸/粗指针设备显示，桌面隐藏。
 * 与 WASD 并存；选角/升级弹窗期间可隐藏以免挡触摸。
 */
export class VirtualJoystick {
  private readonly root: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private active = false;
  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private readonly maxRadius = 52;
  /** -1..1 */
  x = 0;
  /** -1..1，屏幕向上为负 Z（与 WASD 一致） */
  z = 0;
  private enabled = false;
  private readonly touchCapable: boolean;

  constructor(uiRoot: HTMLElement) {
    this.touchCapable =
      (typeof window !== 'undefined' &&
        ('ontouchstart' in window ||
          (navigator.maxTouchPoints ?? 0) > 0 ||
          window.matchMedia('(pointer: coarse)').matches)) ||
      false;

    this.root = document.createElement('div');
    this.root.className = 'vjoy';
    this.root.setAttribute('aria-hidden', 'true');
    this.base = document.createElement('div');
    this.base.className = 'vjoy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'vjoy-knob';
    this.base.appendChild(this.knob);
    this.root.appendChild(this.base);
    uiRoot.appendChild(this.root);

    this.root.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    this.setVisible(false);
  }

  get isTouchDevice(): boolean {
    return this.touchCapable;
  }

  /** 仅 playing 且触摸设备时显示 */
  setVisible(v: boolean): void {
    this.enabled = v && this.touchCapable;
    this.root.style.display = this.enabled ? 'block' : 'none';
    if (!this.enabled) this.resetStick();
  }

  private resetStick(): void {
    this.active = false;
    this.pointerId = null;
    this.x = 0;
    this.z = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.active) return;
    // 只响应左侧半屏，避免挡右侧 UI
    if (e.clientX > window.innerWidth * 0.55) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    const rect = this.base.getBoundingClientRect();
    this.baseX = rect.left + rect.width / 2;
    this.baseY = rect.top + rect.height / 2;
    // 允许从任意左侧点按下，把底座中心吸到触点附近（钳在左下区域）
    const cx = Math.min(Math.max(e.clientX, 48), window.innerWidth * 0.45);
    const cy = Math.min(Math.max(e.clientY, window.innerHeight * 0.35), window.innerHeight - 48);
    this.root.style.left = `${cx}px`;
    this.root.style.top = `${cy}px`;
    this.root.style.bottom = 'auto';
    this.root.style.transform = 'translate(-50%, -50%)';
    const r2 = this.base.getBoundingClientRect();
    this.baseX = r2.left + r2.width / 2;
    this.baseY = r2.top + r2.height / 2;
    this.applyKnob(e.clientX, e.clientY);
    try {
      this.base.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.applyKnob(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active || (this.pointerId !== null && e.pointerId !== this.pointerId)) return;
    this.resetStick();
    // 回默认左下角
    this.root.style.left = '';
    this.root.style.top = '';
    this.root.style.bottom = '';
    this.root.style.transform = '';
  };

  private applyKnob(clientX: number, clientY: number): void {
    let dx = clientX - this.baseX;
    let dy = clientY - this.baseY;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this.maxRadius);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.x = dx / this.maxRadius;
    this.z = dy / this.maxRadius; // 屏幕下为正 → 世界 +Z
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.root.remove();
  }
}
