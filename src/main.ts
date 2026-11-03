import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui-root');

if (!canvas || !uiRoot) {
  throw new Error('缺少 #game-canvas 或 #ui-root');
}

canvas.tabIndex = 0;
const game = new Game(canvas, uiRoot);

// HMR / cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
