import { formatTime, type HighScores } from '../game/HighScores';

export interface UnlockNotice {
  title: string;
  body: string;
}

export interface NextUnlock {
  name: string;
  line: string;
  ratio: number;
  where: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

export class GameOver {
  private overlay: HTMLDivElement | null = null;

  show(
    uiRoot: HTMLElement,
    stats: {
      timeSec: number;
      level: number;
      kills: number;
      characterName: string;
      highs: HighScores & { newBestTime: boolean; newBestKills: boolean };
      milestones?: string[];
      victory?: boolean;
      modeName?: string;
      unlocks?: UnlockNotice[];
      next?: NextUnlock | null;
    },
    onRestart: () => void,
    onMenu: () => void,
  ): void {
    this.hide();
    const m = Math.floor(stats.timeSec / 60);
    const s = Math.floor(stats.timeSec % 60);
    const bestTimeTag = stats.highs.newBestTime ? ' <span class="new-best">新纪录!</span>' : '';
    const bestKillTag = stats.highs.newBestKills ? ' <span class="new-best">新纪录!</span>' : '';
    const victory = !!stats.victory;
    const modeName = stats.modeName || '标准突围';
    const title = victory ? '冲刺达成' : '星兽陨落';
    const subtitle = victory
      ? `${stats.characterName} 撑过了这一轮${modeName}`
      : `${stats.characterName} 的${modeName}结束了`;
    const unlocks = (stats.unlocks ?? [])
      .map(
        (item) => `
        <div class="unlock-banner">
          <b>${esc(item.title)}</b>
          <span>${esc(item.body)}</span>
        </div>`,
      )
      .join('');
    const next = stats.next;
    const nextHtml = next
      ? `
        <div class="next-unlock">
          <div class="shell-kicker">再差一点 · 下一档</div>
          <b>${esc(next.name)}</b>
          <p>${esc(next.line)}</p>
          <div class="next-meter" aria-hidden="true"><span style="width:${Math.round(next.ratio * 100)}%"></span></div>
          <small>解锁后可在${esc(next.where)}使用</small>
        </div>`
      : `<div class="next-unlock is-done"><b>本机可解锁的星兽、武装和模式都点亮了</b></div>`;
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.overlay.innerHTML = `
      <div class="panel gameover-panel">
        <div class="shell-kicker">${victory ? '短局过关' : '这一局结束'}</div>
        <h1>${title}</h1>
        <div class="subtitle">${esc(subtitle)}</div>
        ${unlocks}
        <div class="stats-list">
          <div><span>存活时间</span><span>${m}:${s.toString().padStart(2, '0')}${bestTimeTag}</span></div>
          <div><span>等级</span><span>${stats.level}</span></div>
          <div><span>击杀</span><span>${stats.kills}${bestKillTag}</span></div>
          <div class="high-row"><span>本机最高存活</span><span>${formatTime(stats.highs.bestTimeSec)}</span></div>
          <div class="high-row"><span>本机最高击杀</span><span>${stats.highs.bestKills}</span></div>
        </div>
        ${(stats.milestones ?? [])
          .map((line) => `<div class="milestone-line">新里程碑 · ${esc(line)}（下局生效）</div>`)
          .join('')}
        ${nextHtml}
        <button class="btn" type="button" data-restart>再来一局</button>
        <button class="btn secondary" type="button" data-menu>返回大厅</button>
      </div>
    `;
    this.overlay.querySelector('[data-restart]')!.addEventListener('click', () => {
      this.hide();
      onRestart();
    });
    this.overlay.querySelector('[data-menu]')!.addEventListener('click', () => {
      this.hide();
      onMenu();
    });
    uiRoot.appendChild(this.overlay);
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
