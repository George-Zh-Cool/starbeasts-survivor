import type { VirtualJoystick } from '../ui/VirtualJoystick';

export class Input {
  readonly keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  /** NDC -1..1 */
  ndcX = 0;
  ndcY = 0;
  private canvas: HTMLCanvasElement;
  private joystick: VirtualJoystick | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    // Prevent arrow keys / space from scrolling
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });
    // 抑制游戏区默认手势（滚动、双击缩放）
    const preventTouchScroll = (e: TouchEvent) => {
      // 允许带 data-allow-scroll / 表单控件的节点滚动；其余在战斗画布上阻止
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.overlay, .panel, button, input, a, .char-card, .upgrade-card')) return;
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    this._preventTouchScroll = preventTouchScroll;
  }

  private _preventTouchScroll: ((e: TouchEvent) => void) | null = null;

  bindJoystick(joy: VirtualJoystick): void {
    this.joystick = joy;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    if (this._preventTouchScroll) {
      document.removeEventListener('touchmove', this._preventTouchScroll);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.ndcX = (this.mouseX / rect.width) * 2 - 1;
    this.ndcY = -((this.mouseY / rect.height) * 2 - 1);
  };

  get moveX(): number {
    let x = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joystick) x += this.joystick.x;
    return Math.max(-1, Math.min(1, x));
  }

  get moveZ(): number {
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.joystick) z += this.joystick.z;
    return Math.max(-1, Math.min(1, z));
  }
}
