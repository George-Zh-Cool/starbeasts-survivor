import type { UpgradeDef } from '../data/upgrades';

export class UpgradeModal {
  private overlay: HTMLDivElement | null = null;

  show(uiRoot: HTMLElement, options: UpgradeDef[], onPick: (u: UpgradeDef) => void): void {
    this.hide();
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.width = 'min(760px, 94vw)';
    panel.innerHTML = `
      <div class="shell-kicker">战斗暂停</div>
      <div class="upgrade-title">拣一项强化</div>
      <div class="upgrade-sub">星尘只够改一件事。进化、词条，或者直接变强。</div>
      <div class="upgrade-grid"></div>
    `;
    const grid = panel.querySelector('.upgrade-grid')!;
    for (const u of options) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `upgrade-card${u.kind === 'evolve' ? ' evolve-card' : ''}${u.kind === 'trait' ? ' trait-card' : ''}`;
      const rarityLabel = u.rarity === 'common' ? '普通' : u.rarity === 'rare' ? '稀有' : '史诗';
      const kindLabel =
        u.kind === 'evolve' ? '进化' : u.kind === 'trait' ? '词条' : '强化';
      const tag = u.tag ? ` · ${u.tag}` : '';
      card.innerHTML = `
        <span class="rarity ${u.rarity}">${rarityLabel} · ${kindLabel}${tag}</span>
        <h3>${u.name}</h3>
        <p>${u.description}</p>
        ${u.synergyHint ? `<div class="synergy-hint">${u.synergyHint}</div>` : ''}
      `;
      card.addEventListener('click', () => {
        this.hide();
        onPick(u);
      });
      grid.appendChild(card);
    }
    this.overlay.appendChild(panel);
    uiRoot.appendChild(this.overlay);
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
