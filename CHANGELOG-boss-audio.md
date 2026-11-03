# 本次增量：Boss/事件 · 音效 · 本机纪录（2026-11-03）

## Build

`npm run build` ✅ 通过（tsc + vite）

## 改动文件

### 新增
- `src/audio/Audio.ts` — Web Audio 程序化 SFX/BGM，静音/音量/BGM 存 localStorage
- `src/data/bosses.ts` — Boss 定义与缩放
- `src/entities/Boss.ts` — Boss 实体（冲撞/环形弹幕/召唤 + 简易世界血条）
- `src/entities/HostileProjectile.ts` — Boss 敌对弹幕
- `src/game/EventDirector.ts` — 定时事件调度
- `src/game/HighScores.ts` — 本机最高存活/击杀

### 修改
- `src/game/Game.ts` — 接入事件、Boss、音效、纪录、短暂奖励
- `src/game/Combat.ts` — Boss 伤害、敌对弹幕、受伤/射击音效
- `src/game/Spawner.ts` — 精英潮倍率、Boss 在场时降压
- `src/entities/Player.ts` — takeDamage 在实际扣血时返回 true（便于受伤音）
- `src/ui/HUD.ts` — 事件横幅、静音按钮
- `src/ui/GameOver.ts` — 本机最高 + 新纪录标记
- `src/ui/CharacterSelect.ts` — 声音/BGM/音量、本机纪录展示
- `src/style.css` — 事件横幅与音频 UI
- `README.md` — 已实现 / 操作 / Boss 规则

## Boss / 事件规则

| 时间 | 事件 |
|------|------|
| 60s | Boss **裂空巨角**（冲撞 + 召唤） |
| 90s | **精英潮** ~12s 高密度 |
| 120s | Boss **星环邪核**（环形弹幕 + 召唤） |
| 150s | 精英潮 |
| 180s+ | 每 30s 交替强化 Boss / 精英潮 |

击败 Boss：多颗经验球 + ~8s 移速/射速短暂强化；HUD「Boss 来袭」等提示。

## 音效清单

射击、击杀、拾取经验、升级、受伤、Boss 警告、精英潮、Boss 击败、Game Over；可选循环低音 BGM。  
选角界面：声音开关 / BGM 开关 / 音量；HUD 🔊 一键静音。键：`starbeasts_mute` / `starbeasts_volume` / `starbeasts_bgm`。

## 本机纪录

`starbeasts_best_time`、`starbeasts_best_kills`；选角与 Game Over 展示。

## 如何验证

1. `npm run dev`，选角后开声音，确认射击/击杀/拾取音。
2. 活到 60s 看 Boss 横幅与警告音；击败后经验与短暂强化。
3. 90s 精英潮；120s 第二 Boss 环形弹幕。
4. 死亡后看本机最高；再开一局验证纪录保留与静音持久化。
5. `npm run build` 必须通过。

## 已知问题

- Boss 弹幕未对象池化（数量有限，局内 dispose）
- 拾取音每个经验球都响，密集时偏吵
- Boss 世界血条朝向为固定倾角，非严格 billboard
- 短暂奖励期间若大幅改 attackInterval 的升级，到期还原用除法，极端情况可能有微小误差
- Three.js 打包体积 >500kB 警告（原有）
