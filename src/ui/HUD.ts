import { audio } from '../audio/Audio';

export class HUD {
  private readonly root: HTMLDivElement;
  private readonly timeEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly xpText: HTMLElement;
  private readonly pauseBanner: HTMLDivElement;
  private readonly eventBanner: HTMLDivElement;
  private readonly bossBar: HTMLDivElement;
  private readonly bossNameEl: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly bossHpEl: HTMLElement;
  private readonly weaponEl: HTMLElement;
  private readonly audioBtn: HTMLButtonElement;
  private eventBannerTimer = 0;
  private rafBound = false;
  private readonly debugEl: HTMLDivElement;
  private flashEl!: HTMLDivElement;
  private debugVisible = false;

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="boss-bar" data-boss-bar style="display:none">
        <div class="boss-bar-name" data-boss-name>Boss</div>
        <div class="boss-bar-track">
          <div class="boss-bar-fill" data-boss-fill style="transform:scaleX(1)"></div>
        </div>
        <div class="boss-bar-hp" data-boss-hp></div>
      </div>
      <div class="hud-top">
        <div class="hud-brand"><b>星兽突围</b><span data-brand>突围中</span></div>
        <div class="hud-stat"><div class="label">时间</div><div class="value" data-time>0:00</div></div>
        <div class="hud-stat"><div class="label">等级</div><div class="value" data-level>1</div></div>
        <div class="hud-stat"><div class="label">击杀</div><div class="value" data-kills>0</div></div>
        <div class="hud-stat weapon-stat"><div class="label">武器</div><div class="value" data-weapon>—</div></div>
        <button type="button" class="audio-toggle" data-audio title="静音 / 音量">🔊</button>
      </div>
      <div class="bars">
        <div class="bar-row">
          <div class="bar-label">生命</div>
          <div class="bar-wrap">
            <div class="bar-track"><div class="bar-fill hp" data-hp style="transform:scaleX(1)"></div></div>
            <div class="bar-text" data-hp-text>100 / 100</div>
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-label">经验</div>
          <div class="bar-wrap">
            <div class="bar-track"><div class="bar-fill xp" data-xp style="transform:scaleX(0)"></div></div>
            <div class="bar-text" data-xp-text>0 / 10</div>
          </div>
        </div>
      </div>
    `;
    this.pauseBanner = document.createElement('div');
    this.pauseBanner.className = 'paused-banner';
    this.pauseBanner.textContent = '升级选择中 · 游戏已暂停';
    this.pauseBanner.style.display = 'none';
    this.root.appendChild(this.pauseBanner);

    this.eventBanner = document.createElement('div');
    this.eventBanner.className = 'event-banner';
    this.eventBanner.style.display = 'none';
    this.root.appendChild(this.eventBanner);

    this.debugEl = document.createElement('div');
    this.debugEl.className = 'hud-debug';
    this.debugEl.style.display = 'none';
    this.root.appendChild(this.debugEl);

    const vignette = document.createElement('div');
    vignette.className = 'combat-vignette';
    this.root.appendChild(vignette);
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'combat-flash';
    this.root.appendChild(this.flashEl);
    uiRoot.appendChild(this.root);
    this.timeEl = this.root.querySelector('[data-time]')!;
    this.levelEl = this.root.querySelector('[data-level]')!;
    this.killsEl = this.root.querySelector('[data-kills]')!;
    this.hpFill = this.root.querySelector('[data-hp]')!;
    this.xpFill = this.root.querySelector('[data-xp]')!;
    this.hpText = this.root.querySelector('[data-hp-text]')!;
    this.xpText = this.root.querySelector('[data-xp-text]')!;
    this.weaponEl = this.root.querySelector('[data-weapon]')!;
    this.audioBtn = this.root.querySelector('[data-audio]')!;
    this.bossBar = this.root.querySelector('[data-boss-bar]')!;
    this.bossNameEl = this.root.querySelector('[data-boss-name]')!;
    this.bossFill = this.root.querySelector('[data-boss-fill]')!;
    this.bossHpEl = this.root.querySelector('[data-boss-hp]')!;
    this.audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.toggleMute();
      this.refreshAudioBtn();
    });
    this.refreshAudioBtn();
  }

  private refreshAudioBtn(): void {
    this.audioBtn.textContent = audio.isMuted ? '🔇' : '🔊';
    this.audioBtn.classList.toggle('muted', audio.isMuted);
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? 'block' : 'none';
  }

  setBrand(text: string): void {
    const el = this.root.querySelector('[data-brand]');
    if (el) el.textContent = text;
  }

  /** 很短的暖色闪，用来托住重击，不遮画面。 */
  flash(strength = 0.18): void {
    this.flashEl.style.opacity = String(Math.max(0, Math.min(0.4, strength)));
    requestAnimationFrame(() => {
      this.flashEl.style.opacity = '0';
    });
  }

  /** mode: levelup | pause | protect | hide */
  setPausedBanner(mode: false | 'levelup' | 'pause' | 'protect'): void {
    if (!mode) {
      this.pauseBanner.style.display = 'none';
      return;
    }
    if (mode === 'levelup') {
      this.pauseBanner.textContent = '升级选择中 · 游戏已暂停';
    } else if (mode === 'pause') {
      this.pauseBanner.textContent = '已暂停 · 按 P / Esc 继续';
    } else {
      this.pauseBanner.textContent = '出生保护中 · 短暂无敌';
    }
    this.pauseBanner.style.display = 'block';
  }

  showEventBanner(text: string, kind: 'boss' | 'tide' | 'reward' = 'boss', durationSec = 3.2): void {
    this.eventBanner.textContent = text;
    this.eventBanner.className = `event-banner ${kind}`;
    this.eventBanner.style.display = 'block';
    this.eventBannerTimer = durationSec;
    if (!this.rafBound) {
      this.rafBound = true;
    }
  }

  /** Call each frame from Game with dt. */
  tickBanner(dt: number): void {
    if (this.eventBannerTimer <= 0) return;
    this.eventBannerTimer -= dt;
    if (this.eventBannerTimer <= 0) {
      this.eventBanner.style.display = 'none';
    }
  }

  setBossBar(name: string, hp: number, maxHp: number): void {
    this.bossBar.style.display = 'block';
    this.root.classList.add('has-boss');
    this.bossNameEl.textContent = name;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.bossFill.style.transform = `scaleX(${ratio})`;
    this.bossHpEl.textContent = `${Math.ceil(Math.max(0, hp))} / ${Math.ceil(maxHp)}`;
  }

  hideBossBar(): void {
    this.bossBar.style.display = 'none';
    this.root.classList.remove('has-boss');
  }

  update(timeSec: number, level: number, kills: number, hp: number, maxHp: number, xp: number, xpToNext: number, weaponName?: string, shield?: number, shieldMax?: number, goalSec = 0): void {
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    const clock = `${m}:${s.toString().padStart(2, '0')}`;
    if (goalSec > 0) {
      const left = Math.max(0, goalSec - timeSec);
      const lm = Math.floor(left / 60);
      const ls = Math.floor(left % 60);
      this.timeEl.textContent = `${clock} · 剩${lm}:${ls.toString().padStart(2, '0')}`;
    } else {
      this.timeEl.textContent = clock;
    }
    this.levelEl.textContent = String(level);
    this.killsEl.textContent = String(kills);
    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const xpRatio = xpToNext > 0 ? Math.max(0, Math.min(1, xp / xpToNext)) : 0;
    this.hpFill.style.transform = `scaleX(${hpRatio})`;
    this.xpFill.style.transform = `scaleX(${xpRatio})`;
    this.hpText.textContent = `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`;
    this.xpText.textContent = `${Math.floor(xp)} / ${xpToNext}`;
    if (weaponName) this.weaponEl.textContent = weaponName;
    if (shieldMax !== undefined && shieldMax > 0) {
      this.hpText.textContent = `${Math.ceil(hp)} / ${Math.ceil(maxHp)}  盾${Math.ceil(shield ?? 0)}`;
    }
  }

  toggleDebug(force?: boolean): void {
    this.debugVisible = force !== undefined ? force : !this.debugVisible;
    this.debugEl.style.display = this.debugVisible ? 'block' : 'none';
  }

  setDebugText(text: string): void {
    if (!this.debugVisible) return;
    this.debugEl.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }
}
