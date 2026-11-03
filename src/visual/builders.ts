import * as THREE from 'three';

export function stdMat(
  color: number,
  opts?: {
    emissive?: number;
    ei?: number;
    rough?: number;
    metal?: number;
    opacity?: number;
    map?: THREE.Texture | null;
  },
): THREE.MeshStandardMaterial {
  const transparent = opts?.opacity !== undefined && opts.opacity < 1;
  return new THREE.MeshStandardMaterial({
    color,
    map: opts?.map ?? null,
    emissive: opts?.emissive ?? color,
    emissiveIntensity: opts?.ei ?? 0.3,
    roughness: opts?.rough ?? 0.5,
    metalness: opts?.metal ?? 0.2,
    transparent,
    opacity: opts?.opacity ?? 1,
  });
}

export function addCast(m: THREE.Mesh): THREE.Mesh {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 焰心狐：头/身/四肢/尾/耳 */
export function buildFox(_color: number, accent: number, bodyMat: THREE.MeshStandardMaterial, accentMap?: THREE.Texture | null): {
  rig: THREE.Group;
  anim: { tail: THREE.Object3D; ears: THREE.Object3D[] };
} {
  const rig = new THREE.Group();
  const accentMat = stdMat(accent, { ei: 0.55, rough: 0.4, map: accentMap });

  const torso = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.35, 4, 8), bodyMat));
  torso.position.set(0, 0.55, 0);
  torso.scale.set(1.05, 1, 1.35);
  rig.add(torso);

  const head = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bodyMat));
  head.position.set(0, 0.95, 0.28);
  head.scale.set(1, 0.95, 1.1);
  rig.add(head);

  const snout = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 5), accentMat));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.88, 0.52);
  rig.add(snout);

  const ears: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const ear = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 4), accentMat));
    ear.position.set(sx * 0.18, 1.22, 0.22);
    ear.rotation.z = sx * -0.35;
    ear.rotation.x = -0.25;
    rig.add(ear);
    ears.push(ear);
  }

  for (const [lx, lz] of [
    [-0.22, 0.22],
    [0.22, 0.22],
    [-0.22, -0.28],
    [0.22, -0.28],
  ] as const) {
    const leg = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 3, 6), bodyMat));
    leg.position.set(lx, 0.22, lz);
    rig.add(leg);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.45);
  const t1 = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), accentMat));
  t1.rotation.x = Math.PI / 2.4;
  t1.position.z = -0.2;
  tail.add(t1);
  const tip = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), stdMat(0xfff1a8, { ei: 0.8 })));
  tip.position.set(0, 0.05, -0.48);
  tail.add(tip);
  rig.add(tail);

  const chestGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 }),
  );
  chestGlow.position.set(0, 0.62, 0.22);
  rig.add(chestGlow);

  return { rig, anim: { tail, ears } };
}

/** 潮汐龟：壳/头/四肢 */
export function buildTurtle(color: number, accent: number, bodyMat: THREE.MeshStandardMaterial, accentMap?: THREE.Texture | null): {
  rig: THREE.Group;
  anim: { shell: THREE.Object3D };
} {
  const rig = new THREE.Group();
  const shellMat = stdMat(accent, { ei: 0.45, rough: 0.35, metal: 0.35, map: accentMap });

  const belly = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), bodyMat));
  belly.position.y = 0.38;
  belly.scale.set(1.15, 0.7, 1.25);
  rig.add(belly);

  const shell = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), shellMat));
  shell.position.y = 0.58;
  shell.scale.set(1.2, 0.55, 1.3);
  rig.add(shell);

  // 壳纹板块
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const plate = addCast(
      new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), stdMat(color, { ei: 0.25, rough: 0.6 })),
    );
    plate.position.set(Math.cos(a) * 0.28, 0.78, Math.sin(a) * 0.32);
    plate.rotation.y = a;
    rig.add(plate);
  }

  const head = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bodyMat));
  head.position.set(0, 0.48, 0.55);
  rig.add(head);

  for (const [lx, lz] of [
    [-0.35, 0.28],
    [0.35, 0.28],
    [-0.35, -0.32],
    [0.35, -0.32],
  ] as const) {
    const flipper = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.32), bodyMat));
    flipper.position.set(lx, 0.18, lz);
    flipper.rotation.y = lx > 0 ? -0.25 : 0.25;
    rig.add(flipper);
  }

  const crest = addCast(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), shellMat));
  crest.position.set(0, 0.72, 0);
  crest.rotation.x = Math.PI / 2.5;
  rig.add(crest);

  return { rig, anim: { shell } };
}

/** 风刃隼：身/翼/喙/冠 */
export function buildFalcon(_color: number, accent: number, bodyMat: THREE.MeshStandardMaterial, accentMap?: THREE.Texture | null): {
  rig: THREE.Group;
  anim: { wings: THREE.Object3D[] };
} {
  const rig = new THREE.Group();
  const accentMat = stdMat(accent, { ei: 0.6, rough: 0.35, map: accentMap });

  const body = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), bodyMat));
  body.position.y = 0.7;
  body.scale.set(1, 1, 1.2);
  rig.add(body);

  const head = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bodyMat));
  head.position.set(0, 1.05, 0.18);
  rig.add(head);

  const beak = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), accentMat));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.0, 0.38);
  rig.add(beak);

  const crest = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.22), accentMat));
  crest.position.set(0, 1.22, 0.05);
  rig.add(crest);

  const wings: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.15, 0.75, 0);
    const w = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.28), bodyMat));
    w.position.x = sx * 0.28;
    w.rotation.z = sx * 0.35;
    wing.add(w);
    const tip = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), accentMat));
    tip.rotation.z = sx * Math.PI / 2;
    tip.position.set(sx * 0.58, 0.02, 0);
    wing.add(tip);
    rig.add(wing);
    wings.push(wing);
  }

  const tail = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), accentMat));
  tail.rotation.x = Math.PI / 2.2;
  tail.position.set(0, 0.55, -0.4);
  rig.add(tail);

  return { rig, anim: { wings } };
}

export type EnemyAnim = {
  spin?: THREE.Object3D[];
  bob?: THREE.Object3D[];
};

/** 敌人多部件低模；半径用于缩放，中心仍在 y=0 */
export function buildEnemyVisual(
  shape: 'crystal' | 'wolf' | 'beetle' | 'elite',
  radius: number,
  color: number,
  bodyMat: THREE.MeshStandardMaterial,
  elite: boolean,
  detailMap?: THREE.Texture | null,
): { rig: THREE.Group; anim: EnemyAnim } {
  const rig = new THREE.Group();
  const r = radius;
  const accent = elite ? 0xffd166 : color;
  const accentMat = stdMat(accent, { ei: elite ? 0.75 : 0.4, rough: 0.4, map: detailMap });
  const anim: EnemyAnim = { spin: [], bob: [] };

  if (shape === 'crystal') {
    const core = addCast(new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.85, 0), bodyMat));
    core.position.y = r;
    rig.add(core);
    anim.spin!.push(core);
    for (let i = 0; i < 3; i++) {
      const shard = addCast(new THREE.Mesh(new THREE.TetrahedronGeometry(r * 0.35, 0), accentMat));
      const a = (i / 3) * Math.PI * 2;
      shard.position.set(Math.cos(a) * r * 0.7, r * 0.7, Math.sin(a) * r * 0.7);
      rig.add(shard);
      anim.spin!.push(shard);
    }
  } else if (shape === 'wolf') {
    const torso = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.45, r * 0.35, 3, 6), bodyMat));
    torso.position.y = r * 0.85;
    torso.scale.set(1, 1, 1.4);
    torso.rotation.x = Math.PI / 2;
    rig.add(torso);
    const head = addCast(new THREE.Mesh(new THREE.ConeGeometry(r * 0.4, r * 0.7, 4), bodyMat));
    head.rotation.x = Math.PI / 2;
    head.position.set(0, r * 0.95, r * 0.55);
    rig.add(head);
    for (const sx of [-1, 1]) {
      const ear = addCast(new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.28, 3), accentMat));
      ear.position.set(sx * r * 0.22, r * 1.35, r * 0.25);
      rig.add(ear);
    }
    const tail = addCast(new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.55, 4), accentMat));
    tail.rotation.x = Math.PI / 2.5;
    tail.position.set(0, r * 0.8, -r * 0.65);
    rig.add(tail);
    anim.bob!.push(tail);
  } else if (shape === 'beetle') {
    const shell = addCast(new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 8, 6), bodyMat));
    shell.position.y = r * 0.65;
    shell.scale.set(1.25, 0.7, 1.1);
    rig.add(shell);
    const head = addCast(new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 6, 5), accentMat));
    head.position.set(0, r * 0.55, r * 0.7);
    rig.add(head);
    for (const sx of [-1, 1]) {
      const horn = addCast(new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.4, 4), accentMat));
      horn.position.set(sx * r * 0.2, r * 0.85, r * 0.75);
      horn.rotation.x = -0.6;
      rig.add(horn);
    }
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const zi = ((i % 3) - 1) * r * 0.35;
      const leg = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.06, r * 0.25, 2, 4), bodyMat));
      leg.position.set(side * r * 0.75, r * 0.25, zi);
      leg.rotation.z = side * 0.7;
      rig.add(leg);
    }
  } else {
    // elite 督卫：双层装甲 + 肩甲
    const core = addCast(new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.7, 0), bodyMat));
    core.position.y = r * 0.95;
    rig.add(core);
    const armor = addCast(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.95, 0), accentMat));
    armor.position.y = r;
    armor.scale.set(1.05, 0.75, 1.05);
    rig.add(armor);
    for (const sx of [-1, 1]) {
      const pauldron = addCast(new THREE.Mesh(new THREE.BoxGeometry(r * 0.45, r * 0.25, r * 0.5), accentMat));
      pauldron.position.set(sx * r * 0.75, r * 1.25, 0);
      pauldron.rotation.z = sx * -0.35;
      rig.add(pauldron);
    }
    const crest = addCast(new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.7, 5), stdMat(0xffd166, { ei: 0.9 })));
    crest.position.set(0, r * 1.85, 0);
    rig.add(crest);
    anim.spin!.push(crest);
    // 精英脚底光环
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.9, r * 1.35, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff006e,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    rig.add(ring);
    anim.bob!.push(ring);
  }

  return { rig, anim };
}

export function buildBossHorn(radius: number, mat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial): {
  parts: THREE.Object3D[];
  bodyGeo: THREE.BufferGeometry;
  bodyY: number;
} {
  const parts: THREE.Object3D[] = [];
  const bodyGeo = new THREE.CapsuleGeometry(radius * 0.55, radius * 0.9, 4, 8);
  const bodyY = radius * 1.05;

  // 肩甲
  for (const sx of [-1, 1]) {
    const shoulder = addCast(new THREE.Mesh(new THREE.BoxGeometry(radius * 0.55, radius * 0.35, radius * 0.7), mat));
    shoulder.position.set(sx * radius * 0.7, radius * 1.45, 0);
    shoulder.rotation.z = sx * -0.4;
    parts.push(shoulder);
  }
  // 三巨角
  for (const [sx, sy] of [
    [0, 0],
    [0.5, -0.05],
    [-0.5, -0.05],
  ] as const) {
    const horn = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.22, radius * 1.1, 5), accentMat));
    horn.position.set(sx * radius * 0.55, radius * 2.15 + sy, radius * 0.15);
    horn.rotation.x = -0.55;
    parts.push(horn);
  }
  // 腰环
  const belt = addCast(new THREE.Mesh(new THREE.TorusGeometry(radius * 0.7, 0.08, 6, 20), accentMat));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = radius * 0.65;
  parts.push(belt);
  // 脚下警示环
  const warn = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.95, radius * 1.4, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff4d6d,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.06;
  parts.push(warn);

  return { parts, bodyGeo, bodyY };
}

export function buildBossCore(radius: number, mat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial): {
  parts: THREE.Object3D[];
  bodyGeo: THREE.BufferGeometry;
  bodyY: number;
} {
  const parts: THREE.Object3D[] = [];
  const bodyGeo = new THREE.IcosahedronGeometry(radius * 0.75, 1);
  const bodyY = radius;

  const shellMat = mat.clone();
  shellMat.transparent = true;
  shellMat.opacity = 0.35;
  shellMat.depthWrite = false;
  const outer = addCast(new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.05, 0), shellMat));
  outer.position.y = radius;
  outer.scale.setScalar(0.92);
  parts.push(outer);

  for (let i = 0; i < 2; i++) {
    const ring = addCast(
      new THREE.Mesh(new THREE.TorusGeometry(radius * (1.1 + i * 0.25), 0.1, 8, 28), accentMat),
    );
    ring.position.y = radius;
    ring.rotation.x = Math.PI / 2 + i * 0.4;
    ring.rotation.z = i * 0.6;
    parts.push(ring);
  }

  const core = addCast(new THREE.Mesh(new THREE.SphereGeometry(radius * 0.32, 12, 10), accentMat));
  core.position.y = radius;
  parts.push(core);

  // 悬浮碎片
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const shard = addCast(new THREE.Mesh(new THREE.TetrahedronGeometry(radius * 0.18, 0), accentMat));
    shard.position.set(Math.cos(a) * radius * 1.35, radius + Math.sin(i) * 0.3, Math.sin(a) * radius * 1.35);
    parts.push(shard);
  }

  const warn = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.0, radius * 1.45, 36),
    new THREE.MeshBasicMaterial({
      color: 0x7b2cbf,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.06;
  parts.push(warn);

  return { parts, bodyGeo, bodyY };
}
