/** 简易屏幕飘字（伤害 / 暴击） */
export class FloatTexts {
  private readonly root: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'float-layer';
    uiRoot.appendChild(this.root);
  }

  spawn(screenX: number, screenY: number, text: string, kind: 'hurt' | 'crit' | 'dmg' | 'heavy' = 'dmg'): void {
    const el = this.pool.pop() ?? document.createElement('div');
    el.className = `float-text ${kind}`;
    el.textContent = text;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, 0)';
    this.root.appendChild(el);
    // restart CSS animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    window.setTimeout(() => {
      el.remove();
      if (this.pool.length < 40) this.pool.push(el);
    }, 750);
  }

  clear(): void {
    this.root.replaceChildren();
  }

  dispose(): void {
    this.root.remove();
    this.pool.length = 0;
  }
}
