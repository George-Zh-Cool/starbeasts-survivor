/** Canvas 程序生成贴图 / Atlas，无外网资源 */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')!];
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r|0},${g|0},${b|0},${a})`;
}

export function makeGroundTexture(size = 512): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#10182a');
  g.addColorStop(0.45, '#152038');
  g.addColorStop(1, '#0c1220');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.04 + Math.random() * 0.08;
    const shade = Math.random() < 0.5 ? 40 : 90;
    ctx.fillStyle = `rgba(${shade},${shade + 10},${shade + 30},${a})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }

  for (let i = 0; i < 48; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 28;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(90,140,220,0.14)');
    grd.addColorStop(1, 'rgba(90,140,220,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(70,90,130,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return c;
}

/** 弱细节层：半透明白噪 + 细裂纹，叠在地表上不抢戏 */
export function makeGroundDetailTexture(size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.03 + Math.random() * 0.07;
    const v = 180 + Math.floor(Math.random() * 60);
    ctx.fillStyle = rgba(v, v, v + 10, a);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = 'rgba(140,170,220,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 稀疏苔点
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 5;
    ctx.fillStyle = rgba(60, 120, 140, 0.06);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function makeNoiseNormalHint(size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 110 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v},${v},${200 + (v % 40)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

/** 焰心狐：毛发条纹 atlas（2x2 变体） */
export function makeFurAtlas(base: number, accent: number, size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  const [ar, ag, ab] = hexToRgb(accent);
  const cell = size / 2;
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const ox = cx * cell;
      const oy = cy * cell;
      const grd = ctx.createLinearGradient(ox, oy, ox + cell, oy + cell);
      grd.addColorStop(0, rgba(br, bg, bb, 1));
      grd.addColorStop(1, rgba(Math.min(255, br + 30), Math.min(255, bg + 10), bb, 1));
      ctx.fillStyle = grd;
      ctx.fillRect(ox, oy, cell, cell);
      for (let i = 0; i < 28; i++) {
        const x = ox + Math.random() * cell;
        ctx.strokeStyle = rgba(ar, ag, ab, 0.25 + Math.random() * 0.35);
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(x, oy);
        ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 12, oy + cell * 0.5, x + (Math.random() - 0.5) * 8, oy + cell);
        ctx.stroke();
      }
      // 暖色斑点
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = rgba(ar, ag, ab, 0.18);
        ctx.beginPath();
        ctx.arc(ox + Math.random() * cell, oy + Math.random() * cell, 2 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return c;
}

/** 潮汐龟：六角鳞片 / 壳纹 atlas */
export function makeScaleAtlas(base: number, accent: number, size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  const [ar, ag, ab] = hexToRgb(accent);
  ctx.fillStyle = rgba(br, bg, bb, 1);
  ctx.fillRect(0, 0, size, size);

  const drawHex = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  const R = 18;
  const h = R * Math.sqrt(3);
  for (let row = -1; row < size / h + 2; row++) {
    for (let col = -1; col < size / (R * 1.5) + 2; col++) {
      const x = col * R * 1.5;
      const y = row * h + (col % 2 ? h * 0.5 : 0);
      drawHex(x, y, R * 0.92);
      const bright = ((row + col) & 1) === 0;
      ctx.fillStyle = bright
        ? rgba(ar, ag, ab, 0.55)
        : rgba(Math.max(0, br - 20), Math.max(0, bg - 10), Math.min(255, bb + 20), 0.85);
      ctx.fill();
      ctx.strokeStyle = rgba(255, 255, 255, 0.12);
      ctx.lineWidth = 1;
      ctx.stroke();
      // 壳中心高光
      ctx.fillStyle = rgba(255, 255, 255, 0.08);
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** 风刃隼：羽纹 atlas */
export function makeFeatherAtlas(base: number, accent: number, size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  const [ar, ag, ab] = hexToRgb(accent);
  ctx.fillStyle = rgba(br, bg, bb, 1);
  ctx.fillRect(0, 0, size, size);

  for (let band = 0; band < 10; band++) {
    const y0 = (band / 10) * size;
    ctx.fillStyle = rgba(ar, ag, ab, band % 2 === 0 ? 0.22 : 0.08);
    ctx.fillRect(0, y0, size, size / 10);
  }
  for (let i = 0; i < 36; i++) {
    const x = (i / 36) * size;
    ctx.strokeStyle = rgba(255, 255, 255, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 8, size * 0.5, x - 4, size);
    ctx.stroke();
    ctx.strokeStyle = rgba(ar, ag, ab, 0.35);
    ctx.beginPath();
    ctx.moveTo(x + 3, 0);
    ctx.lineTo(x + 3, size);
    ctx.stroke();
  }
  // 羽尖深色
  const tip = ctx.createLinearGradient(0, 0, 0, size);
  tip.addColorStop(0, rgba(0, 0, 0, 0));
  tip.addColorStop(0.7, rgba(0, 0, 0, 0));
  tip.addColorStop(1, rgba(20, 30, 50, 0.35));
  ctx.fillStyle = tip;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** 敌人：暗晶裂纹 */
export function makeCrystalAtlas(base: number, size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  ctx.fillStyle = rgba(br, bg, bb, 1);
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.35, size * 0.35, 4, size * 0.5, size * 0.5, size * 0.7);
  g.addColorStop(0, rgba(255, 255, 255, 0.35));
  g.addColorStop(1, rgba(0, 0, 0, 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = rgba(220, 240, 255, 0.45);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

/** 敌人：狼毛 / 甲壳简易纹 */
export function makeBeastAtlas(base: number, accent: number, kind: 'wolf' | 'beetle' | 'elite', size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  const [ar, ag, ab] = hexToRgb(accent);
  ctx.fillStyle = rgba(br, bg, bb, 1);
  ctx.fillRect(0, 0, size, size);
  if (kind === 'wolf') {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * size;
      ctx.strokeStyle = rgba(ar, ag, ab, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 10, size);
      ctx.stroke();
    }
  } else if (kind === 'beetle') {
    for (let y = 0; y < size; y += 10) {
      ctx.strokeStyle = rgba(ar, ag, ab, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(size * 0.5, y + 6, size, y);
      ctx.stroke();
    }
  } else {
    // elite plates
    for (let y = 0; y < size; y += 16) {
      for (let x = 0; x < size; x += 16) {
        ctx.strokeStyle = rgba(ar, ag, ab, 0.4);
        ctx.strokeRect(x + 1, y + 1, 14, 14);
        ctx.fillStyle = rgba(255, 209, 102, 0.08);
        ctx.fillRect(x + 3, y + 3, 10, 10);
      }
    }
  }
  return c;
}

/** Boss：装甲板纹 */
export function makeBossPlateAtlas(base: number, accent: number, size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const [br, bg, bb] = hexToRgb(base);
  const [ar, ag, ab] = hexToRgb(accent);
  ctx.fillStyle = rgba(br, bg, bb, 1);
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 28) {
    for (let x = 0; x < size; x += 36) {
      const inset = 3;
      ctx.fillStyle = rgba(Math.min(255, br + 25), Math.min(255, bg + 15), Math.min(255, bb + 15), 0.9);
      ctx.fillRect(x + inset, y + inset, 36 - inset * 2, 28 - inset * 2);
      ctx.strokeStyle = rgba(ar, ag, ab, 0.55);
      ctx.lineWidth = 2;
      ctx.strokeRect(x + inset, y + inset, 36 - inset * 2, 28 - inset * 2);
      ctx.fillStyle = rgba(255, 255, 255, 0.1);
      ctx.fillRect(x + 8, y + 6, 12, 4);
    }
  }
  // 能量缝
  ctx.strokeStyle = rgba(ar, ag, ab, 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 6) * size);
    ctx.lineTo(size, (i / 6) * size + 8);
    ctx.stroke();
  }
  return c;
}
