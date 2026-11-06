/** Procedural SFX / BGM via Web Audio API. Settings persisted in localStorage. */

const LS_MUTE = 'starbeasts_mute';
const LS_VOL = 'starbeasts_volume';
const LS_BGM = 'starbeasts_bgm';

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

function loadNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private muted = loadBool(LS_MUTE, false);
  private volume = Math.max(0, Math.min(1, loadNum(LS_VOL, 0.7)));
  private bgmEnabled = loadBool(LS_BGM, true);
  private bgmNodes: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode }[] = [];
  private bgmRunning = false;

  /** Call from a user gesture (click) to unlock AudioContext. */
  unlock(): void {
    this.ensureCtx();
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.bgmEnabled && !this.muted) this.startBgm();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  get volumeLevel(): number {
    return this.volume;
  }

  setMuted(v: boolean): void {
    this.muted = v;
    save(LS_MUTE, v ? '1' : '0');
    this.applyGains();
    if (!v && this.bgmEnabled) this.startBgm();
    if (v) this.stopBgm();
  }

  setBgmEnabled(v: boolean): void {
    this.bgmEnabled = v;
    save(LS_BGM, v ? '1' : '0');
    if (v && !this.muted) this.startBgm();
    else this.stopBgm();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    save(LS_VOL, String(this.volume));
    this.applyGains();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.bgmGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyGains();
    }
    return this.ctx;
  }

  private applyGains(): void {
    if (!this.master || !this.sfxGain || !this.bgmGain) return;
    const master = this.muted ? 0 : this.volume;
    this.master.gain.value = master;
    this.sfxGain.gain.value = 1;
    this.bgmGain.gain.value = this.bgmEnabled ? 0.22 : 0;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.12,
    slideTo?: number,
  ): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseBurst(dur: number, gain = 0.08, filterFreq = 1200): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playShoot(): void {
    this.tone(780, 0.042, 'square', 0.05, 440);
    this.noiseBurst(0.02, 0.028, 2100);
  }

  playAuraTick(): void {
    this.tone(280, 0.04, 'sine', 0.03);
  }

  playHit(): void {
    const now = performance.now();
    if (now - this.hitLast < 42) return;
    this.hitLast = now;
    this.tone(980, 0.032, 'square', 0.042, 520);
    this.noiseBurst(0.025, 0.035, 1900);
  }

  playKill(): void {
    this.tone(620, 0.04, 'square', 0.055, 340);
    this.tone(190, 0.07, 'sawtooth', 0.065, 70);
    this.noiseBurst(0.045, 0.05, 1500);
  }

  private pickupLast = 0;
  private hitLast = 0;
  private readonly pickupMinGapMs = 55;

  playPickup(): void {
    const now = performance.now();
    if (now - this.pickupLast < this.pickupMinGapMs) return;
    this.pickupLast = now;
    this.tone(880, 0.08, 'sine', 0.06, 1320);
  }

  playLevelUp(): void {
    this.tone(523, 0.07, 'triangle', 0.09);
    setTimeout(() => this.tone(659, 0.07, 'triangle', 0.09), 52);
    setTimeout(() => this.tone(1046, 0.12, 'sine', 0.07), 104);
  }

  playHurt(): void {
    this.tone(160, 0.14, 'sawtooth', 0.1, 70);
    this.noiseBurst(0.1, 0.07, 400);
  }

  playBossWarn(): void {
    this.tone(110, 0.25, 'square', 0.1);
    setTimeout(() => this.tone(90, 0.3, 'square', 0.11), 180);
    setTimeout(() => this.tone(70, 0.4, 'sawtooth', 0.12), 380);
  }

  playEliteTide(): void {
    this.tone(340, 0.12, 'triangle', 0.07, 520);
    setTimeout(() => this.tone(420, 0.14, 'triangle', 0.07), 100);
  }

  playGameOver(): void {
    this.tone(330, 0.2, 'sawtooth', 0.1, 180);
    setTimeout(() => this.tone(196, 0.35, 'sawtooth', 0.09, 90), 200);
    setTimeout(() => this.tone(98, 0.5, 'triangle', 0.08), 420);
  }

  playSmash(): void {
    this.noiseBurst(0.12, 0.1, 900);
    this.tone(120, 0.1, 'sawtooth', 0.08, 60);
  }

  playCrystalBreak(): void {
    this.tone(880, 0.06, 'triangle', 0.07, 1400);
    this.noiseBurst(0.08, 0.05, 2200);
    setTimeout(() => this.tone(1320, 0.08, 'sine', 0.05), 40);
  }

  playEvolve(): void {
    this.tone(440, 0.12, 'square', 0.09);
    setTimeout(() => this.tone(554, 0.12, 'square', 0.09), 90);
    setTimeout(() => this.tone(659, 0.14, 'triangle', 0.1), 180);
    setTimeout(() => this.tone(880, 0.22, 'sine', 0.08), 280);
    this.noiseBurst(0.15, 0.06, 1400);
  }

  playSynergy(): void {
    this.tone(523, 0.1, 'triangle', 0.08);
    setTimeout(() => this.tone(784, 0.18, 'sine', 0.09), 100);
  }

  playBossDefeat(): void {
    this.tone(392, 0.12, 'square', 0.09);
    setTimeout(() => this.tone(523, 0.12, 'square', 0.09), 90);
    setTimeout(() => this.tone(659, 0.2, 'triangle', 0.1), 180);
    this.noiseBurst(0.2, 0.1, 600);
  }

  startBgm(): void {
    if (!this.bgmEnabled || this.muted || this.bgmRunning) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    this.stopBgm();
    this.bgmRunning = true;

    const makeDrone = (freq: number, type: OscillatorType, gainVal: number, lfoRate: number) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      lfo.type = 'sine';
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value = freq * 0.01;
      g.gain.value = gainVal;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(this.bgmGain!);
      osc.start();
      lfo.start();
      this.bgmNodes.push({ osc, lfo, gain: g });
    };

    makeDrone(55, 'sine', 0.35, 0.08);
    makeDrone(82.5, 'triangle', 0.18, 0.12);
    makeDrone(110, 'sine', 0.1, 0.05);
  }

  stopBgm(): void {
    for (const n of this.bgmNodes) {
      try {
        n.osc.stop();
        n.lfo.stop();
      } catch {
        /* already stopped */
      }
      try {
        n.osc.disconnect();
        n.lfo.disconnect();
        n.gain.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.bgmNodes = [];
    this.bgmRunning = false;
  }

  dispose(): void {
    this.stopBgm();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.bgmGain = null;
    }
  }
}

/** Singleton used across the game. */
export const audio = new AudioManager();
