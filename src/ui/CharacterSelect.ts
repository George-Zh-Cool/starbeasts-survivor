import { CHARACTERS, type CharacterDef } from '../data/characters';
import { audio } from '../audio/Audio';
import { formatTime, loadHighScores } from '../game/HighScores';

function silhouette(shape: CharacterDef['shape'], color: string, accent: string): string {
  if (shape === 'fox') {
    return `<svg class="char-icon" viewBox="0 0 80 64" aria-hidden="true">
      <ellipse cx="40" cy="38" rx="18" ry="12" fill="${color}"/>
      <circle cx="40" cy="24" r="11" fill="${color}"/>
      <polygon points="28,18 24,4 34,14" fill="${accent}"/>
      <polygon points="52,18 56,4 46,14" fill="${accent}"/>
      <ellipse cx="40" cy="28" rx="5" ry="3" fill="${accent}" opacity="0.85"/>
      <path d="M22 40 Q8 28 14 48 Q28 46 22 40" fill="${accent}"/>
    </svg>`;
  }
  if (shape === 'turtle') {
    return `<svg class="char-icon" viewBox="0 0 80 64" aria-hidden="true">
      <ellipse cx="40" cy="40" rx="24" ry="14" fill="${color}"/>
      <ellipse cx="40" cy="34" rx="22" ry="12" fill="${accent}"/>
      <circle cx="40" cy="28" r="7" fill="${color}"/>
      <rect x="18" y="44" width="10" height="6" rx="2" fill="${color}"/>
      <rect x="52" y="44" width="10" height="6" rx="2" fill="${color}"/>
      <circle cx="40" cy="34" r="4" fill="${color}" opacity="0.5"/>
    </svg>`;
  }
  return `<svg class="char-icon" viewBox="0 0 80 64" aria-hidden="true">
    <ellipse cx="40" cy="34" rx="10" ry="16" fill="${color}"/>
    <polygon points="40,10 46,22 34,22" fill="${accent}"/>
    <polygon points="18,30 4,24 18,38" fill="${color}"/>
    <polygon points="62,30 76,24 62,38" fill="${color}"/>
    <polygon points="40,48 48,60 32,60" fill="${accent}"/>
    <circle cx="40" cy="20" r="6" fill="${color}"/>
  </svg>`;
}

export class CharacterSelect {
  private readonly overlay: HTMLDivElement;

  constructor(uiRoot: HTMLElement, onPick: (def: CharacterDef) => void) {
    const highs = loadHighScores();
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>星兽突围</h1>
      <div class="subtitle">StarBeasts · 选择你的起始星兽，在暗潮中活下去</div>
      <div class="menu-highs">本机纪录 · 最高存活 ${formatTime(highs.bestTimeSec)} · 最高击杀 ${highs.bestKills}</div>
      <div class="audio-settings">
        <button type="button" class="btn secondary audio-btn" data-mute>声音：开</button>
        <button type="button" class="btn secondary audio-btn" data-bgm>BGM：开</button>
        <label class="vol-label">音量 <input type="range" min="0" max="100" value="70" data-vol /></label>
      </div>
      <div class="char-grid"></div>
      <div class="hint">操作：WASD / 方向键移动 · 自动攻击最近敌人 · 60s/120s 触发 Boss 或精英潮</div>
    `;
    const grid = panel.querySelector('.char-grid')!;
    for (const c of CHARACTERS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'char-card';
      const col = `#${c.color.toString(16).padStart(6, '0')}`;
      const acc = `#${c.accent.toString(16).padStart(6, '0')}`;
      card.innerHTML = `
        <div class="swatch" style="--c1:${col};--c2:${acc}">
          ${silhouette(c.shape, col, acc)}
        </div>
        <h3>${c.name}</h3>
        <p><strong>${c.title}</strong> — ${c.description}</p>
        <div class="tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      `;
      card.addEventListener('click', () => {
        audio.unlock();
        onPick(c);
      });
      grid.appendChild(card);
    }

    const muteBtn = panel.querySelector('[data-mute]') as HTMLButtonElement;
    const bgmBtn = panel.querySelector('[data-bgm]') as HTMLButtonElement;
    const vol = panel.querySelector('[data-vol]') as HTMLInputElement;

    const sync = () => {
      muteBtn.textContent = audio.isMuted ? '声音：关' : '声音：开';
      bgmBtn.textContent = audio.isBgmEnabled ? 'BGM：开' : 'BGM：关';
      vol.value = String(Math.round(audio.volumeLevel * 100));
    };
    sync();

    muteBtn.addEventListener('click', () => {
      audio.unlock();
      audio.toggleMute();
      sync();
    });
    bgmBtn.addEventListener('click', () => {
      audio.unlock();
      audio.setBgmEnabled(!audio.isBgmEnabled);
      sync();
    });
    vol.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(Number(vol.value) / 100);
    });

    this.overlay.appendChild(panel);
    uiRoot.appendChild(this.overlay);
  }

  dispose(): void {
    this.overlay.remove();
  }
}
