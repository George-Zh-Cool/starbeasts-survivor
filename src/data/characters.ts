export type WeaponKind = 'projectile' | 'aura';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  description: string;
  color: number;
  accent: number;
  /** Body geometry hint for rendering */
  shape: 'fox' | 'turtle' | 'falcon' | 'marten' | 'lizard';
  base: {
    maxHp: number;
    moveSpeed: number;
    damage: number;
    attackInterval: number;
    projectileSpeed: number;
    projectileCount: number;
    pierce: number;
    pickupRadius: number;
    lifeSteal: number;
    auraRadius?: number;
  };
  weaponKind: WeaponKind;
  tags: string[];
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'flamefox',
    name: '焰心狐',
    title: '炽焰游侠',
    description: '高伤脆皮远程压制，单发火力强，需靠走位换输出窗口。',
    color: 0xff5a36,
    accent: 0xffd166,
    shape: 'fox',
    weaponKind: 'projectile',
    tags: ['高伤害', '火系弹道'],
    base: {
      maxHp: 85,
      moveSpeed: 7.4,
      damage: 16,
      attackInterval: 0.48,
      projectileSpeed: 20,
      projectileCount: 1,
      pierce: 0,
      pickupRadius: 2.2,
      lifeSteal: 0,
    },
  },
  {
    id: 'tideturtle',
    name: '潮汐龟',
    title: '深潮卫士',
    description: '血厚环攻坦克，输出偏慢，适合贴身消耗与扛伤。',
    color: 0x2ec4b6,
    accent: 0x90e0ef,
    shape: 'turtle',
    weaponKind: 'aura',
    tags: ['高坦度', '水波环攻'],
    base: {
      maxHp: 155,
      moveSpeed: 5.4,
      damage: 7,
      attackInterval: 0.42,
      projectileSpeed: 0,
      projectileCount: 0,
      pierce: 0,
      pickupRadius: 2.4,
      lifeSteal: 0.025,
      auraRadius: 3.4,
    },
  },
  {
    id: 'windfalcon',
    name: '风刃隼',
    title: '疾风猎手',
    description: '射速与移速拔尖，单发偏弱，擅长风筝与多段打击。',
    color: 0x7b2cbf,
    accent: 0xc77dff,
    shape: 'falcon',
    weaponKind: 'projectile',
    tags: ['高射速', '高移速'],
    base: {
      maxHp: 78,
      moveSpeed: 9.5,
      damage: 6.5,
      attackInterval: 0.24,
      projectileSpeed: 25,
      projectileCount: 1,
      pierce: 0,
      pickupRadius: 2.6,
      lifeSteal: 0,
    },
  },
  {
    id: 'frostmarten',
    name: '霜铃貂',
    title: '霜铃探路',
    description: '中速霜弹，命中会把敌人钉慢一拍，适合拉扯而不是硬拼。',
    color: 0x7ecbff,
    accent: 0xe7f8ff,
    shape: 'marten',
    weaponKind: 'projectile',
    tags: ['霜控', '中射速'],
    base: {
      maxHp: 96,
      moveSpeed: 8.1,
      damage: 8.5,
      attackInterval: 0.32,
      projectileSpeed: 19,
      projectileCount: 1,
      pierce: 0,
      pickupRadius: 2.5,
      lifeSteal: 0,
    },
  },
  {
    id: 'stormlizard',
    name: '雷脊蜥',
    title: '近雷突击',
    description: '短程电弧又沉又疼，身板比狐厚，要贴上去才打得满。',
    color: 0xf4d35e,
    accent: 0x7b3fe4,
    shape: 'lizard',
    weaponKind: 'projectile',
    tags: ['近程高压', '电弧'],
    base: {
      maxHp: 128,
      moveSpeed: 6.3,
      damage: 14,
      attackInterval: 0.52,
      projectileSpeed: 15,
      projectileCount: 1,
      pierce: 0,
      pickupRadius: 2.1,
      lifeSteal: 0,
    },
  },
];

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`未知角色: ${id}`);
  return c;
}
