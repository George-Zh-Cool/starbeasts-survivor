import { CHARACTERS, type CharacterDef } from '../data/characters';
import { audio } from '../audio/Audio';
import { formatTime, loadHighScores } from '../game/HighScores';
import { portraitURL, warmupSprites, type CreatureId } from '../visual/sprites';
import { wordmarkURL } from '../visual/pixelDraw';

const FIELD: { id: CreatureId; name: string }[] = [
  { id: 'crystal', name: '暗晶兽' },
  { id: 'wolf', name: '裂影狼' },
  { id: 'beetle', name: '虚空甲虫' },
  { id: 'elite', name: '深渊督卫' },
  { id: 'horn', name: '裂空巨角' },
  { id: 'core', name: '星环邪核' },
];

export class CharacterSelect {
  private readonly overlay: HTMLDivElement;

  constructor(uiRoot: HTMLElement, onPick: (def: CharacterDef) => void) {
    warmupSprites();
    const highs = loadHighScores();
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const bestiary = FIELD.map(
      (f) => `<div class="bestiary-item"><img alt="" src="${portraitURL(f.id)}" /><span>${f.name}</span></div>`,
    ).join('');
    panel.innerHTML = `
      <div class="shell-kicker">暗潮战场</div>
      <h1>星兽突围</h1>
      <img class="pixel-wordmark" alt="STARBEASTS" src="${wordmarkURL('STARBEASTS')}" />
      <div class="subtitle">选一只星兽走进石砖暗潮。点卡片就开始这一局。</div>
      <div class="menu-highs">本机纪录 · 最高存活 ${formatTime(highs.bestTimeSec)} · 最高击杀 ${highs.bestKills}</div>
      <div class="audio-settings">
        <button type="button" class="btn secondary audio-btn" data-mute>声音：开</button>
        <button type="button" class="btn secondary audio-btn" data-bgm>BGM：开</button>
        <label class="vol-label">音量 <input type="range" min="0" max="100" value="70" data-vol /></label>
      </div>
      <div class="shell-step">出战星兽</div>
      <div class="char-grid"></div>
      <div class="bestiary">
        <div class="bestiary-label">战场上的暗潮</div>
        <div class="bestiary-row">${bestiary}</div>
      </div>
      <div class="hint">WASD / 方向键移动 · 自动攻击最近敌人 · 60 秒与 120 秒会有大体型进场</div>
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
          <img class="pixel-portrait" alt="" src="${portraitURL(c.shape)}" />
        </div>
        <h3>${c.name}</h3>
        <p><strong>${c.title}</strong> — ${c.description}</p>
        <div class="tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="pick-cue">点击出战</div>
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
