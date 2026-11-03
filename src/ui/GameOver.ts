import { formatTime, type HighScores } from '../game/HighScores';

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
    },
    onRestart: () => void,
    onMenu: () => void,
  ): void {
    this.hide();
    const m = Math.floor(stats.timeSec / 60);
    const s = Math.floor(stats.timeSec % 60);
    const bestTimeTag = stats.highs.newBestTime ? ' <span class="new-best">新纪录!</span>' : '';
    const bestKillTag = stats.highs.newBestKills ? ' <span class="new-best">新纪录!</span>' : '';
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.overlay.innerHTML = `
      <div class="panel gameover-panel">
        <h1>星兽陨落</h1>
        <div class="subtitle">${stats.characterName} 的突围结束了</div>
        <div class="stats-list">
          <div><span>存活时间</span><span>${m}:${s.toString().padStart(2, '0')}${bestTimeTag}</span></div>
          <div><span>等级</span><span>${stats.level}</span></div>
          <div><span>击杀</span><span>${stats.kills}${bestKillTag}</span></div>
          <div class="high-row"><span>本机最高存活</span><span>${formatTime(stats.highs.bestTimeSec)}</span></div>
          <div class="high-row"><span>本机最高击杀</span><span>${stats.highs.bestKills}</span></div>
        </div>
        <button class="btn" type="button" data-restart>再来一局</button>
        <button class="btn secondary" type="button" data-menu>返回选角</button>
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
