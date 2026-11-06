import { CHARACTERS, type CharacterDef } from '../data/characters';
import { audio } from '../audio/Audio';
import {
  formatTime,
  loadHighScores,
  loadLocalRuns,
  loadPreferredId,
  savePreferredId,
  type HighScores,
  type LocalRun,
} from '../game/HighScores';
import { portraitURL, warmupSprites, type CreatureId } from '../visual/sprites';
import { describeWeaponPaths } from '../data/weapons';
import { listMilestones, type Milestone } from '../game/Milestones';

type SortKey = 'time' | 'kills';
type PanelId = 'dex' | 'lab' | 'ach' | 'rank' | 'squad' | 'settings' | 'lang' | 'profile';

interface Achievement {
  id: string;
  name: string;
  detail: string;
  unlocked: boolean;
}

interface DexEntry {
  id: CreatureId;
  name: string;
  kind: '可出战' | '暗潮' | '大体型';
  blurb: string;
}

const SOON: Record<string, { title: string; body: string }> = {
  endless: {
    title: '无尽暗潮',
    body: '这个模式还在建设中。现在能玩的是生存突围：暗潮会越来越密，裂空巨角大约在 60 秒进场，星环邪核大约在 120 秒进场。',
  },
  trial: {
    title: '星核试炼',
    body: '限时试炼还没开放。没有每日重置，也没有在线赛季。想打一局，用「开始游戏」进入生存突围。',
  },
  party: {
    title: '结伴突围',
    body: '没有联机，也不能创建或加入房间。目前只能一个人在这台设备上出战。',
  },
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

function svg(inner: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

const ICO = {
  book: svg('<path d="M5 5.5h6.2A2.3 2.3 0 0 1 13.5 7.8V20H7.2A2.2 2.2 0 0 0 5 22.2V5.5z"/><path d="M19 5.5h-6.2A2.3 2.3 0 0 0 10.5 7.8V20h6.3A2.2 2.2 0 0 1 19 22.2V5.5z"/>'),
  flask: svg('<path d="M9 3h6"/><path d="M10 3v5.2L5.6 18.2A2.8 2.8 0 0 0 8.1 22h7.8a2.8 2.8 0 0 0 2.5-3.8L14 8.2V3"/>'),
  medal: svg('<circle cx="12" cy="14" r="5"/><path d="M8.5 3.5 10.2 9M15.5 3.5 13.8 9"/><path d="M9 3.5h6"/>'),
  chart: svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'),
  squad: svg('<circle cx="9" cy="9" r="2.3"/><circle cx="16.2" cy="10" r="1.8"/><path d="M4.6 18.2c.6-2.3 2.4-3.6 4.4-3.6s3.8 1.3 4.4 3.6"/><path d="M14.2 14.8c1.2-.4 2.5-.2 3.4.7.9.9 1.4 1.9 1.6 2.7"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3 6.1 17.9"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5L15 15"/>'),
};

function dexEntries(): DexEntry[] {
  const playable: DexEntry[] = CHARACTERS.map((c) => ({
    id: c.shape,
    name: c.name,
    kind: '可出战',
    blurb: `${c.title}。${c.description}`,
  }));
  return [
    ...playable,
    { id: 'crystal', name: '暗晶兽', kind: '暗潮', blurb: '最常见的晶簇，走得慢，一波里数量最多。' },
    { id: 'wolf', name: '裂影狼', kind: '暗潮', blurb: '血薄但跑得快，喜欢从侧边贴上来。' },
    { id: 'beetle', name: '虚空甲虫', kind: '暗潮', blurb: '甲壳更厚，经验更多，中后期有机会带词缀。' },
    { id: 'moth', name: '星萤蛾', kind: '暗潮', blurb: '又轻又快，喜欢横着绕。萤潮和星屑雨时会成群出现。' },
    { id: 'crab', name: '岩壳蟹', kind: '暗潮', blurb: '壳厚步慢，大约一分半之后混进暗潮，偶尔带着词缀。' },
    { id: 'elite', name: '深渊督卫', kind: '暗潮', blurb: '体型更大，进场时必定带着一个词缀。' },
    { id: 'horn', name: '裂空巨角', kind: '大体型', blurb: '大约 60 秒进场，会冲撞，可以拉开距离风筝。' },
    { id: 'core', name: '星环邪核', kind: '大体型', blurb: '大约 120 秒进场，撒环形弹幕并召唤小怪。' },
  ];
}

function buildAchievements(highs: HighScores, runs: LocalRun[]): Achievement[] {
  const played = runs.length > 0 || highs.bestTimeSec > 0 || highs.bestKills > 0;
  const bestLevel = runs.reduce((max, run) => Math.max(max, run.level), 0);
  const seen = new Set(runs.map((run) => run.characterId).filter(Boolean));
  return [
    { id: 'first', name: '踏入暗潮', detail: '打完至少一局', unlocked: played },
    { id: 't60', name: '撑过潮头', detail: '单局存活达到 1:00', unlocked: highs.bestTimeSec >= 60 },
    { id: 't120', name: '熬过双潮', detail: '单局存活达到 2:00', unlocked: highs.bestTimeSec >= 120 },
    { id: 'k50', name: '初猎', detail: '单局击杀达到 50', unlocked: highs.bestKills >= 50 },
    { id: 'k200', name: '屠潮', detail: '单局击杀达到 200', unlocked: highs.bestKills >= 200 },
    { id: 'lv10', name: '星辉', detail: '单局等级达到 10', unlocked: bestLevel >= 10 },
    { id: 'squad', name: '三兽轮换', detail: '三只星兽都留下过出战纪录', unlocked: seen.size >= 3 },
  ];
}

function sortRuns(runs: LocalRun[], sort: SortKey): LocalRun[] {
  return [...runs].sort((a, b) => {
    if (sort === 'kills' && b.kills !== a.kills) return b.kills - a.kills;
    if (sort === 'time' && b.timeSec !== a.timeSec) return b.timeSec - a.timeSec;
    if (b.timeSec !== a.timeSec) return b.timeSec - a.timeSec;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.at - a.at;
  });
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function characterById(id: string): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

function formatWhen(at: number): string {
  if (!at) return '';
  try {
    return new Date(at).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export class CharacterSelect {
  private readonly overlay: HTMLDivElement;
  private readonly onPick: (def: CharacterDef) => void;
  private readonly highs: HighScores;
  private readonly runs: LocalRun[];
  private readonly achievements: Achievement[];
  private readonly milestones: Milestone[];
  private preferredId: string;
  private boardSort: SortKey = 'time';
  private pick: HTMLDivElement | null = null;
  private sheet: HTMLDivElement | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (this.sheet) {
      this.closeSheet();
      return;
    }
    if (this.pick) this.closePick();
  };

  constructor(uiRoot: HTMLElement, onPick: (def: CharacterDef) => void) {
    warmupSprites();
    this.onPick = onPick;
    this.highs = loadHighScores();
    this.runs = loadLocalRuns();
    this.achievements = buildAchievements(this.highs, this.runs);
    this.milestones = listMilestones();
    const stored = loadPreferredId();
    this.preferredId = characterById(stored) ? stored : '';

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay lb-overlay';
    this.overlay.innerHTML = this.homeHtml();
    uiRoot.appendChild(this.overlay);
    this.bindHome();
    this.renderBoard();
    this.refreshPreferred();
    this.syncMuteChip();
    window.addEventListener('keydown', this.onKey);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.pick?.remove();
    this.sheet?.remove();
    this.pick = null;
    this.sheet = null;
    this.overlay.remove();
  }

  private homeHtml(): string {
    const unlocked = this.achievements.filter((a) => a.unlocked).length;
    const next = this.achievements.find((a) => !a.unlocked);
    const nextMile = this.milestones.find((m) => !m.unlocked);
    const mileOn = this.milestones.filter((m) => m.unlocked).length;
    const goalTitle = nextMile ? nextMile.name : next ? next.name : '目标已满';
    const goalBody = nextMile
      ? `${nextMile.detail}。达成后下局：${nextMile.reward}`
      : next
        ? next.detail
        : '这台设备上的目标和加成都点亮了。';
    const achBadge = unlocked > 0 ? `<i class="lb-count">${unlocked}</i>` : '';
    const runBadge = this.runs.length > 0 ? `<i class="lb-count quiet">${this.runs.length}</i>` : '';
    return `
      <div class="lb">
        <header class="lb-top">
          <button type="button" class="lb-chip lb-lang" data-panel="lang" aria-label="界面语言">中</button>
          <button type="button" class="lb-chip lb-profile" data-panel="profile">
            <img data-avatar alt="" />
            <span><b>游客</b><small>本机</small></span>
          </button>
          <button type="button" class="lb-chip" data-panel="rank" aria-label="本机最长存活">
            ${ICO.clock}
            <span data-chip-time>${formatTime(this.highs.bestTimeSec)}</span>
          </button>
          <button type="button" class="lb-chip" data-panel="rank" aria-label="本机最高击杀">
            ${ICO.chart}
            <span data-chip-kills>${this.highs.bestKills}</span>
          </button>
          <button type="button" class="lb-chip" data-mute-quick>声音开</button>
        </header>
        <div class="lb-main">
          <div class="lb-brand">
            <div>
              <div class="lb-brand-en">STARBEASTS</div>
              <h1 class="lb-logo"><span>星兽</span><span class="gold">突围</span></h1>
            </div>
            <span class="lb-ver">试炼版 v0.2.0</span>
          </div>
          <div class="lb-bento">
            <button type="button" class="lb-start" data-start>
              <span class="lb-start-badge">单机</span>
              <span class="lb-start-orb"><img data-start-portrait alt="" /></span>
              <span class="lb-start-kicker" data-start-kicker>出战</span>
              <span class="lb-start-title">开始<br />游戏</span>
              <span class="lb-start-sub" data-start-sub>生存突围 · 选一只星兽</span>
            </button>
            <button type="button" class="lb-mode survive" data-mode="survival">
              <span class="lb-mode-top"><span class="lb-mode-kicker">单机可玩</span><span class="lb-mode-badge">当前</span></span>
              <strong>生存突围</strong>
              <em>石砖暗潮，撑得越久越好</em>
            </button>
            <button type="button" class="lb-mode endless" data-mode="endless">
              <span class="lb-mode-top"><span class="lb-mode-kicker">未开放</span><span class="lb-mode-badge">即将开放</span></span>
              <strong>无尽暗潮</strong>
              <em>同一片石砖，但不会收场</em>
            </button>
            <button type="button" class="lb-mode trial" data-mode="trial">
              <span class="lb-mode-top"><span class="lb-mode-kicker">未开放</span><span class="lb-mode-badge">即将开放</span></span>
              <strong>星核试炼</strong>
              <em>限时目标，打完即停</em>
            </button>
            <button type="button" class="lb-mode party" data-mode="party">
              <span class="lb-mode-top"><span class="lb-mode-kicker">没有联机</span><span class="lb-mode-badge">即将开放</span></span>
              <strong>结伴突围</strong>
              <em>不能开房间，也不能加入</em>
            </button>
            <div class="lb-memo">
              <span class="lb-memo-kicker">暗潮备忘</span>
              <p>40 秒星屑雨，55 秒萤潮，60 秒裂空巨角。开局加成只写在这台浏览器，已点亮 ${mileOn}/${this.milestones.length}。</p>
            </div>
            <button type="button" class="lb-goal" data-panel="ach">
              <span class="lb-memo-kicker">下一目标 · ${unlocked}/${this.achievements.length}</span>
              <strong>${esc(goalTitle)}</strong>
              <em>${esc(goalBody)}</em>
            </button>
            <nav class="lb-nav" aria-label="大厅入口">
              <button type="button" class="lb-tile" data-panel="dex"><span class="lb-ico dex">${ICO.book}</span><b>图鉴</b></button>
              <button type="button" class="lb-tile" data-panel="lab"><span class="lb-ico lab">${ICO.flask}</span><b>研究所</b></button>
              <button type="button" class="lb-tile" data-panel="ach"><span class="lb-ico ach">${ICO.medal}</span><b>成就</b>${achBadge}</button>
              <button type="button" class="lb-tile" data-panel="rank"><span class="lb-ico rank">${ICO.chart}</span><b>排行榜</b>${runBadge}</button>
              <button type="button" class="lb-tile" data-panel="squad"><span class="lb-ico squad">${ICO.squad}</span><b>编队</b></button>
            </nav>
          </div>
          <div class="lb-foot">
            <button type="button" class="lb-settings" data-panel="settings">${ICO.gear}<span>设置</span></button>
            <p>WASD / 方向键移动 · 自动攻击最近的敌人 · 手机用左侧摇杆</p>
          </div>
        </div>
        <aside class="lb-side">
          <section class="lb-board" aria-label="本机最佳">
            <div class="lb-board-hero">
              <div class="lb-board-kicker">仅本机 · 没有赛季</div>
              <h2>本机最佳</h2>
              <div class="lb-board-stats">
                <span>最长存活 <b>${formatTime(this.highs.bestTimeSec)}</b></span>
                <span>最高击杀 <b>${this.highs.bestKills}</b></span>
              </div>
            </div>
            <div class="lb-sort" role="tablist" aria-label="排序">
              <button type="button" data-sort="time" role="tab">存活</button>
              <button type="button" data-sort="kills" role="tab">击杀</button>
            </div>
            <div data-board-body></div>
            <button type="button" class="lb-board-more" data-panel="rank">查看本机排行</button>
          </section>
        </aside>
      </div>
    `;
  }

  private bindHome(): void {
    this.overlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-start]')) {
        audio.unlock();
        this.openPick();
        return;
      }
      const mode = target.closest<HTMLElement>('[data-mode]');
      if (mode?.dataset.mode) {
        audio.unlock();
        if (mode.dataset.mode === 'survival') this.openPick();
        else this.openSoon(mode.dataset.mode);
        return;
      }
      const panel = target.closest<HTMLElement>('[data-panel]');
      if (panel?.dataset.panel) {
        this.openPanel(panel.dataset.panel as PanelId);
        return;
      }
      const sortBtn = target.closest<HTMLElement>('[data-sort]');
      if (sortBtn?.dataset.sort === 'time' || sortBtn?.dataset.sort === 'kills') {
        this.setSort(sortBtn.dataset.sort);
        return;
      }
      if (target.closest('[data-mute-quick]')) {
        audio.unlock();
        audio.toggleMute();
        this.syncMuteChip();
      }
    });
  }

  private shownBeast(): CharacterDef {
    return characterById(this.preferredId) ?? CHARACTERS[0];
  }

  private refreshPreferred(): void {
    const beast = this.shownBeast();
    const src = portraitURL(beast.shape);
    this.overlay.querySelectorAll<HTMLImageElement>('[data-avatar], [data-start-portrait]').forEach((img) => {
      img.src = src;
      img.alt = '';
    });
    const kicker = this.overlay.querySelector('[data-start-kicker]');
    const sub = this.overlay.querySelector('[data-start-sub]');
    if (kicker) kicker.textContent = this.preferredId ? `首选 · ${beast.name}` : '出战';
    if (sub) sub.textContent = '生存突围 · 选一只星兽';
  }

  private syncMuteChip(): void {
    const btn = this.overlay.querySelector<HTMLButtonElement>('[data-mute-quick]');
    if (!btn) return;
    btn.textContent = audio.isMuted ? '声音关' : '声音开';
    btn.classList.toggle('is-off', audio.isMuted);
  }

  private setSort(sort: SortKey): void {
    this.boardSort = sort;
    this.renderBoard();
    const slot = this.sheet?.querySelector('[data-rank-slot]');
    if (slot) slot.innerHTML = this.rankBlock(24);
    this.syncSortButtons(this.overlay);
    if (this.sheet) this.syncSortButtons(this.sheet);
  }

  private syncSortButtons(root: ParentNode): void {
    root.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((btn) => {
      const on = btn.dataset.sort === this.boardSort;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  private renderBoard(): void {
    const slot = this.overlay.querySelector('[data-board-body]');
    if (!slot) return;
    const block = this.rankBlock(6);
    const note =
      this.runs.length > 0
        ? '<p class="lb-board-note">上面两枚数字是历史最好，列表是最近的局。</p>'
        : '';
    slot.innerHTML = block + note;
    this.syncSortButtons(this.overlay);
  }

  private rankBlock(limit: number): string {
    const items = this.rankItemsHtml(limit);
    if (!items) {
      return `
        <div class="lb-empty">
          <div class="lb-empty-orb">★</div>
          <b>还没有出战纪录</b>
          <p>点「开始游戏」，打完一局会写在这台浏览器里。</p>
        </div>
      `;
    }
    return `<ol class="lb-rows">${items}</ol>`;
  }

  private rankItemsHtml(limit: number): string {
    const runs = sortRuns(this.runs, this.boardSort).slice(0, limit);
    if (runs.length === 0) {
      if (this.highs.bestTimeSec <= 0 && this.highs.bestKills <= 0) return '';
      return `
        <li class="lb-row is-legacy">
          <span class="lb-rank">1</span>
          <span class="lb-row-fallback">旧</span>
          <span class="lb-row-main">
            <b>更早的本机最佳</b>
            <small>当时还没记下是哪只星兽</small>
          </span>
          <span class="lb-row-score">
            <strong>${formatTime(this.highs.bestTimeSec)}</strong>
            <small>击杀 ${this.highs.bestKills}</small>
          </span>
        </li>
      `;
    }
    return runs
      .map((run, index) => {
        const beast = characterById(run.characterId);
        const portrait = beast ? `<img alt="" src="${portraitURL(beast.shape)}" />` : '<span class="lb-row-fallback">兽</span>';
        const when = formatWhen(run.at);
        const primary = this.boardSort === 'kills' ? `${run.kills}` : formatTime(run.timeSec);
        const secondary = this.boardSort === 'kills' ? `存活 ${formatTime(run.timeSec)}` : `击杀 ${run.kills}`;
        const rankClass = index < 3 ? ` r${index + 1}` : '';
        return `
          <li class="lb-row">
            <span class="lb-rank${rankClass}">${index + 1}</span>
            ${portrait}
            <span class="lb-row-main">
              <b>${esc(run.characterName)}</b>
              <small>生存突围 · 等级 ${run.level}${when ? ` · ${esc(when)}` : ''}</small>
            </span>
            <span class="lb-row-score">
              <strong>${primary}</strong>
              <small>${secondary}</small>
            </span>
          </li>
        `;
      })
      .join('');
  }

  private openPick(): void {
    if (this.pick) return;
    this.closeSheet();
    const modal = document.createElement('div');
    modal.className = 'overlay lb-modal';
    const cards = CHARACTERS.map((c) => {
      const preferred = c.id === this.preferredId;
      return `
        <button type="button" class="lb-beast${preferred ? ' is-preferred' : ''}" data-id="${esc(c.id)}">
          ${preferred ? '<span class="lb-pref">首选</span>' : ''}
          <span class="lb-beast-art" style="--c1:${hex(c.color)};--c2:${hex(c.accent)}">
            <img alt="" src="${portraitURL(c.shape)}" />
          </span>
          <span class="lb-beast-name">${esc(c.name)}</span>
          <span class="lb-beast-title">${esc(c.title)}</span>
          <span class="lb-beast-desc">${esc(c.description)}</span>
          <span class="lb-tags">${c.tags.map((tag) => `<i>${esc(tag)}</i>`).join('')}</span>
          <span class="lb-go">点击出战</span>
        </button>
      `;
    }).join('');
    modal.innerHTML = `
      <div class="lb-sheet lb-pick" role="dialog" aria-modal="true" aria-labelledby="lb-pick-title">
        <div class="lb-sheet-head">
          <div>
            <div class="lb-sheet-kicker">生存突围</div>
            <h2 id="lb-pick-title">选择出战星兽</h2>
          </div>
          <button type="button" data-close>返回大厅</button>
        </div>
        <p class="lb-sheet-lead">点卡片上的「点击出战」就会开始这一局。首选只是高亮，不会自动开局。</p>
        <div class="lb-beast-grid">${cards}</div>
      </div>
    `;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closePick();
    });
    modal.querySelector('[data-close]')?.addEventListener('click', () => this.closePick());
    modal.querySelector('.lb-beast-grid')?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
      const id = button?.dataset.id;
      if (!id) return;
      const def = characterById(id);
      if (!def) return;
      audio.unlock();
      this.onPick(def);
    });
    this.overlay.parentElement?.appendChild(modal);
    this.pick = modal;
  }

  private closePick(): void {
    this.pick?.remove();
    this.pick = null;
  }

  private openPanel(id: PanelId): void {
    if (id === 'dex') {
      this.openSheet('图鉴', `<p class="lb-sheet-lead">${dexEntries().length} 条档案，都是这局里会出现的星兽。</p>${this.dexHtml()}`);
      return;
    }
    if (id === 'lab') {
      this.openSheet('研究所', this.labHtml());
      return;
    }
    if (id === 'ach') {
      this.openSheet(
        '成就',
        `<p class="lb-sheet-lead">纪录和开局加成都只在这台浏览器里。点亮之后，从下一局开始生效。</p>${this.mileHtml()}${this.achHtml()}`,
      );
      return;
    }
    if (id === 'rank') {
      this.openSheet(
        '排行榜',
        `<p class="lb-sheet-lead">只列出这台设备上的生存突围。没有其他玩家，也没有赛季。</p>
         <div class="lb-sort" role="tablist">${this.sortButtonsHtml()}</div>
         <div data-rank-slot>${this.rankBlock(24)}</div>`,
        (root) => {
          this.syncSortButtons(root);
          root.addEventListener('click', (event) => {
            const sortBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-sort]');
            if (sortBtn?.dataset.sort === 'time' || sortBtn?.dataset.sort === 'kills') {
              this.setSort(sortBtn.dataset.sort);
            }
          });
        },
      );
      return;
    }
    if (id === 'squad') {
      this.openSheet('编队', this.squadHtml(), (root) => this.bindSquad(root));
      return;
    }
    if (id === 'settings') {
      this.openSheet('设置', this.settingsHtml(), (root) => this.bindSettings(root));
      return;
    }
    if (id === 'lang') {
      this.openSheet('语言', '<p class="lb-sheet-lead">界面语言只有简体中文。没有第二语言可以切换。</p>');
      return;
    }
    this.openSheet('本机档案', this.profileHtml());
  }

  private openSoon(mode: string): void {
    const info = SOON[mode] ?? {
      title: '即将开放',
      body: '这个入口还在建设中。现在能玩的是单机生存突围。',
    };
    this.openSheet(info.title, `<p class="lb-soon-banner">即将开放</p><p class="lb-sheet-lead">${esc(info.body)}</p>`);
  }

  private openSheet(title: string, bodyHtml: string, after?: (root: HTMLElement) => void): void {
    this.closeSheet();
    const modal = document.createElement('div');
    modal.className = 'overlay lb-modal';
    modal.innerHTML = `
      <div class="lb-sheet" role="dialog" aria-modal="true" aria-labelledby="lb-sheet-title">
        <div class="lb-sheet-head">
          <h2 id="lb-sheet-title">${esc(title)}</h2>
          <button type="button" data-close>关闭</button>
        </div>
        <div class="lb-sheet-body">${bodyHtml}</div>
      </div>
    `;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closeSheet();
    });
    modal.querySelector('[data-close]')?.addEventListener('click', () => this.closeSheet());
    after?.(modal);
    this.overlay.parentElement?.appendChild(modal);
    this.sheet = modal;
  }

  private closeSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
  }

  private sortButtonsHtml(): string {
    return `
      <button type="button" data-sort="time" role="tab">存活</button>
      <button type="button" data-sort="kills" role="tab">击杀</button>
    `;
  }

  private dexHtml(): string {
    const cards = dexEntries()
      .map(
        (entry) => `
        <article class="lb-dex-card">
          <img alt="" src="${portraitURL(entry.id)}" />
          <div>
            <span class="lb-kind">${entry.kind}</span>
            <b>${esc(entry.name)}</b>
            <p>${esc(entry.blurb)}</p>
          </div>
        </article>
      `,
      )
      .join('');
    return `<div class="lb-dex">${cards}</div>`;
  }

  private mileHtml(): string {
    const cards = this.milestones
      .map((item) => {
        const state = item.unlocked ? 'is-on' : 'is-locked';
        const mark = item.unlocked ? '成' : '锁';
        return `
          <article class="lb-ach ${state}">
            <span class="lb-ach-mark">${mark}</span>
            <div>
              <b>${esc(item.name)}</b>
              <p>${esc(item.detail)}。下局：${esc(item.reward)}</p>
            </div>
            <em>${item.unlocked ? '下局生效' : '未达成'}</em>
          </article>
        `;
      })
      .join('');
    return `<h3 class="lb-sheet-lead">开局加成</h3><div class="lb-ach-list">${cards}</div>`;
  }

  private labHtml(): string {
    const paths = CHARACTERS.map((c) => {
      const steps = describeWeaponPaths(c.id)
        .map((step) => `<li><b>${esc(step.step)} · ${esc(step.name)}</b> ${esc(step.description)}</li>`)
        .join('');
      return `
        <article class="lb-lab-card">
          <img alt="" src="${portraitURL(c.shape)}" />
          <div>
            <b>${esc(c.name)}</b>
            <ul class="lb-path">${steps}</ul>
          </div>
        </article>
      `;
    }).join('');
    const cards = CHARACTERS.map((c) => {
      const weapon = c.weaponKind === 'aura' ? '环攻' : '弹道';
      return `
        <article class="lb-lab-card">
          <img alt="" src="${portraitURL(c.shape)}" />
          <div>
            <b>${esc(c.name)}</b>
            <p>${esc(c.title)} · 武器 ${weapon}</p>
            <div class="lb-stats">
              <span>生命 ${c.base.maxHp}</span>
              <span>移速 ${c.base.moveSpeed.toFixed(1)}</span>
              <span>伤害 ${c.base.damage}</span>
              <span>间隔 ${c.base.attackInterval.toFixed(2)}s</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
    return `
      <p class="lb-sheet-lead">终阶可以走甲或乙。升级时能亲手选；拖到 14 级还没选，会自动走上甲。下面只读，不能在这里改数值。</p>
      <div class="lb-lab">${paths}</div>
      <div class="lb-lab">${cards}</div>
    `;
  }

  private achHtml(): string {
    return `<div class="lb-ach-list">${this.achievements
      .map((item) => {
        const state = item.unlocked ? 'is-on' : 'is-locked';
        const mark = item.unlocked ? '成' : '锁';
        return `
          <article class="lb-ach ${state}">
            <span class="lb-ach-mark">${mark}</span>
            <div>
              <b>${esc(item.name)}</b>
              <p>${esc(item.detail)}</p>
            </div>
            <em>${item.unlocked ? '已点亮' : '未达成'}</em>
          </article>
        `;
      })
      .join('')}</div>`;
  }

  private squadHtml(): string {
    const cards = CHARACTERS.map((c) => {
      const on = c.id === this.preferredId;
      return `
        <article class="lb-squad-card${on ? ' is-on' : ''}">
          <img alt="" src="${portraitURL(c.shape)}" />
          <b>${esc(c.name)}</b>
          <small>${esc(c.title)}</small>
          <button type="button" data-prefer="${esc(c.id)}" class="${on ? 'is-on' : ''}">${on ? '当前首选' : '设为首选'}</button>
        </article>
      `;
    }).join('');
    return `
      <p class="lb-sheet-lead">编队只决定大厅里亮出的星兽。开局仍要点「点击出战」，不会自动开始。</p>
      <div class="lb-squad">${cards}</div>
      <button type="button" class="lb-primary" data-fight>去出战</button>
    `;
  }

  private bindSquad(root: HTMLElement): void {
    root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-fight]')) {
        this.closeSheet();
        this.openPick();
        return;
      }
      const prefer = target.closest<HTMLElement>('[data-prefer]');
      const id = prefer?.dataset.prefer;
      if (!id || !characterById(id)) return;
      savePreferredId(id);
      this.preferredId = id;
      this.refreshPreferred();
      root.querySelectorAll<HTMLButtonElement>('[data-prefer]').forEach((btn) => {
        const on = btn.dataset.prefer === id;
        btn.textContent = on ? '当前首选' : '设为首选';
        btn.classList.toggle('is-on', on);
        btn.closest('.lb-squad-card')?.classList.toggle('is-on', on);
      });
    });
  }

  private settingsHtml(): string {
    const mute = audio.isMuted ? '声音：关' : '声音：开';
    const bgm = audio.isBgmEnabled ? 'BGM：开' : 'BGM：关';
    const vol = Math.round(audio.volumeLevel * 100);
    return `
      <p class="lb-sheet-lead">声音设置存在这台浏览器里。</p>
      <div class="lb-audio">
        <button type="button" data-mute>${mute}</button>
        <button type="button" data-bgm>${bgm}</button>
        <label>音量 <input type="range" min="0" max="100" value="${vol}" data-vol /></label>
      </div>
      <p class="lb-sheet-lead">局内右上角也可以一键静音。暂停用 P 或 Esc。</p>
    `;
  }

  private bindSettings(root: HTMLElement): void {
    const muteBtn = root.querySelector<HTMLButtonElement>('[data-mute]');
    const bgmBtn = root.querySelector<HTMLButtonElement>('[data-bgm]');
    const vol = root.querySelector<HTMLInputElement>('[data-vol]');
    const sync = () => {
      if (muteBtn) muteBtn.textContent = audio.isMuted ? '声音：关' : '声音：开';
      if (bgmBtn) bgmBtn.textContent = audio.isBgmEnabled ? 'BGM：开' : 'BGM：关';
      if (vol) vol.value = String(Math.round(audio.volumeLevel * 100));
      this.syncMuteChip();
    };
    muteBtn?.addEventListener('click', () => {
      audio.unlock();
      audio.toggleMute();
      sync();
    });
    bgmBtn?.addEventListener('click', () => {
      audio.unlock();
      audio.setBgmEnabled(!audio.isBgmEnabled);
      sync();
    });
    vol?.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(Number(vol.value) / 100);
    });
  }

  private profileHtml(): string {
    const beast = this.preferredId ? characterById(this.preferredId) : undefined;
    const prefer = beast ? `首选星兽：${esc(beast.name)}` : '还没有首选星兽。可以在编队里指定。';
    return `
      <p class="lb-sheet-lead">这是本机游客档案，没有账号，也不会上传。纪录保存在这台浏览器里，清掉站点数据就会消失。</p>
      <div class="lb-profile-card">
        <img alt="" src="${portraitURL(this.shownBeast().shape)}" />
        <div>
          <b>游客</b>
          <p>${prefer}</p>
          <p>最长存活 ${formatTime(this.highs.bestTimeSec)} · 最高击杀 ${this.highs.bestKills} · 已记录 ${this.runs.length} 局</p>
        </div>
      </div>
    `;
  }
}
