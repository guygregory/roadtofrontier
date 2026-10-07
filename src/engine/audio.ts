// 4-channel chiptune engine in the spirit of the Amiga's Paula chip:
// pulse lead, fast "VBL" arpeggios, bass and noise drums, all synthesised with Web Audio.

type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'sawtooth';

export interface BarDef {
  chord: string; // e.g. Am, F, C, G, E, Bb, Dm, A
  lead?: string; // 16 tokens: note (A4, C#5, Bb4), '.' hold, '-' rest
  bass?: 'octave' | 'root' | 'none';
  drums?: 'beat' | 'half' | 'fill' | 'none';
  arp?: boolean;
}

export interface SongDef {
  bpm: number;
  loop: boolean;
  leadWave: Wave;
  bars: BarDef[];
}

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteToMidi(n: string): number {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(n);
  if (!m) return -1;
  return (parseInt(m[2], 10) + 1) * 12 + NOTE_INDEX[m[1]];
}

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function chordNotes(chord: string, octave: number): number[] {
  const m = /^([A-G](?:#|b)?)(m?)(7?)$/.exec(chord);
  if (!m) return [noteToMidi(`A${octave}`)];
  const root = (octave + 1) * 12 + NOTE_INDEX[m[1]];
  const third = m[2] === 'm' ? 3 : 4;
  const notes = [root, root + third, root + 7];
  if (m[3]) notes.push(root + (m[2] === 'm' ? 10 : 10));
  return notes;
}

// --- Songs -------------------------------------------------------------------

const TITLE: SongDef = {
  bpm: 128,
  loop: true,
  leadWave: 'pulse25',
  bars: [
    { chord: 'Am', bass: 'octave', drums: 'half', arp: true },
    { chord: 'F', bass: 'octave', drums: 'half', arp: true },
    { chord: 'C', bass: 'octave', drums: 'half', arp: true },
    { chord: 'G', bass: 'octave', drums: 'fill', arp: true },
    { chord: 'Am', lead: 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'F', lead: 'F5 . . . E5 . . . C5 . . . A4 . . .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'C', lead: 'G4 . C5 . E5 . G5 . F5 . E5 . D5 . E5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'G', lead: 'D5 . . . B4 . . . G4 . . . B4 . D5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'Am', lead: 'E5 . . . A5 . . . G5 . E5 . D5 . C5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'F', lead: 'A4 . C5 . F5 . . . E5 . C5 . A4 . C5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'G', lead: 'B4 . D5 . G5 . . . F5 . D5 . B4 . D5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'E', lead: 'E5 . . . G#5 . . . B5 . . . E5 . - .', bass: 'octave', drums: 'fill', arp: true },
    { chord: 'F', lead: 'C6 . . . A5 . . . F5 . . . A5 . C6 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'G', lead: 'B5 . . . G5 . . . D5 . . . G5 . B5 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'Am', lead: 'C6 . B5 . A5 . G5 . E5 . . . A5 . . .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'E', lead: 'B5 . . . . . . . G#5 . . . E5 . . .', bass: 'octave', drums: 'fill', arp: true },
  ],
};

const HUB: SongDef = {
  bpm: 100,
  loop: true,
  leadWave: 'pulse12',
  bars: [
    { chord: 'Dm', lead: 'A4 . . . D5 . . . F5 . . . E5 . D5 .', bass: 'root', drums: 'half', arp: true },
    { chord: 'Bb', lead: 'F5 . . . . . . . D5 . . . - . . .', bass: 'root', drums: 'half', arp: true },
    { chord: 'F', lead: 'C5 . . . F5 . . . A5 . . . G5 . F5 .', bass: 'root', drums: 'half', arp: true },
    { chord: 'C', lead: 'E5 . . . . . . . C5 . . . - . . .', bass: 'root', drums: 'half', arp: true },
    { chord: 'Dm', lead: 'D5 . F5 . A5 . . . G5 . F5 . E5 . D5 .', bass: 'octave', drums: 'half', arp: true },
    { chord: 'Bb', lead: 'D5 . . . F5 . . . Bb5 . . . A5 . G5 .', bass: 'octave', drums: 'half', arp: true },
    { chord: 'C', lead: 'G5 . . . E5 . . . C5 . . . E5 . G5 .', bass: 'octave', drums: 'half', arp: true },
    { chord: 'A', lead: 'A5 . . . . . . . C#5 . . . E5 . . .', bass: 'octave', drums: 'fill', arp: true },
  ],
};

const WIN: SongDef = {
  bpm: 140,
  loop: false,
  leadWave: 'pulse25',
  bars: [
    { chord: 'C', lead: 'C5 . E5 . G5 . C6 . . . G5 . C6 . . .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'F', lead: 'A5 . . . C6 . . . F6 . . . E6 . D6 .', bass: 'octave', drums: 'beat', arp: true },
    { chord: 'G', lead: 'D6 . . . B5 . G5 . D6 . . . . . . .', bass: 'octave', drums: 'fill', arp: true },
    { chord: 'C', lead: 'C6 . . . . . . . . . . . - . . .', bass: 'root', drums: 'none', arp: true },
  ],
};

const LOSE: SongDef = {
  bpm: 84,
  loop: false,
  leadWave: 'pulse50',
  bars: [
    { chord: 'Am', lead: 'E5 . . . C5 . . . A4 . . . . . . .', bass: 'root', drums: 'none', arp: true },
    { chord: 'E', lead: 'G#4 . . . . . . . B4 . . . . . . .', bass: 'root', drums: 'none', arp: true },
    { chord: 'Am', lead: 'A4 . . . . . . . . . . . - . . .', bass: 'root', drums: 'none', arp: true },
  ],
};

export const SONGS: Record<string, SongDef> = { title: TITLE, hub: HUB, win: WIN, lose: LOSE };

// --- Engine --------------------------------------------------------------------

export type Sfx = 'move' | 'select' | 'back' | 'error' | 'coin' | 'alarm' | 'good' | 'type' | 'disk' | 'levelup' | 'tick';

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private waves: Partial<Record<Wave, PeriodicWave>> = {};
  private noise!: AudioBuffer;
  private song: SongDef | null = null;
  private songName = '';
  private nextRowTime = 0;
  private row = 0;
  private timer: number | null = null;
  musicOn = true;
  sfxOn = true;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (autoplay policy). */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0;
      this.sfxBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.songName && !this.timer) this.startScheduler();
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.02);
  }

  private wave(w: Wave): PeriodicWave | null {
    if (!this.ctx) return null;
    if (w === 'triangle' || w === 'sawtooth') return null;
    let pw = this.waves[w];
    if (!pw) {
      const duty = w === 'pulse12' ? 0.125 : w === 'pulse25' ? 0.25 : 0.5;
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      }
      pw = this.ctx.createPeriodicWave(real, imag);
      this.waves[w] = pw;
    }
    return pw;
  }

  private osc(w: Wave): OscillatorNode {
    const o = this.ctx!.createOscillator();
    const pw = this.wave(w);
    if (pw) o.setPeriodicWave(pw);
    else o.type = w as OscillatorType;
    return o;
  }

  playSong(name: string): void {
    if (this.songName === name) return;
    this.stopSong();
    this.songName = name;
    this.song = SONGS[name] ?? null;
    this.row = 0;
    if (this.ctx) this.startScheduler();
  }

  stopSong(): void {
    this.songName = '';
    this.song = null;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startScheduler(): void {
    if (!this.ctx || !this.song) return;
    this.nextRowTime = this.ctx.currentTime + 0.08;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  private schedule(): void {
    const ctx = this.ctx;
    const song = this.song;
    if (!ctx || !song) return;
    const rowDur = 60 / song.bpm / 4;
    const total = song.bars.length * 16;
    // If we fell far behind (e.g. hidden tab), resync instead of bursting.
    if (this.nextRowTime < ctx.currentTime - 0.25) this.nextRowTime = ctx.currentTime + 0.05;
    while (this.nextRowTime < ctx.currentTime + 0.25) {
      if (this.row >= total) {
        if (!song.loop) {
          this.stopSong();
          return;
        }
        this.row = 0;
      }
      this.playRow(song, this.row, this.nextRowTime, rowDur);
      this.row++;
      this.nextRowTime += rowDur;
    }
  }

  private playRow(song: SongDef, row: number, t: number, rowDur: number): void {
    const bar = song.bars[Math.floor(row / 16)];
    const r = row % 16;
    // Lead
    if (bar.lead) {
      const toks = bar.lead.split(/\s+/);
      const tok = toks[r] ?? '.';
      if (tok !== '.' && tok !== '-') {
        let len = 1;
        while (r + len < 16 && (toks[r + len] ?? '.') === '.') len++;
        this.note(song.leadWave, noteToMidi(tok), t, len * rowDur, 0.16, true);
      }
    }
    // Arpeggio: chord cycled at 50Hz like a VBL-driven Amiga tracker
    if (bar.arp && r % 8 === 0) {
      const notes = chordNotes(bar.chord, 4);
      this.arp(notes, t, rowDur * 8, 0.055);
    }
    // Bass
    const root = chordNotes(bar.chord, 2)[0];
    if (bar.bass === 'octave' && r % 2 === 0) {
      this.note('pulse50', root + (r % 4 === 2 ? 12 : 0), t, rowDur * 1.6, 0.13, false);
    } else if (bar.bass === 'root' && r % 4 === 0) {
      this.note('triangle', root + 12, t, rowDur * 3.5, 0.3, false);
    }
    // Drums
    const d = bar.drums ?? 'none';
    if (d === 'beat') {
      if (r === 0 || r === 8 || r === 10) this.kick(t);
      if (r === 4 || r === 12) this.snare(t);
      if (r % 2 === 0) this.hat(t, 0.05);
    } else if (d === 'half') {
      if (r === 0) this.kick(t);
      if (r === 8) this.snare(t);
      if (r % 4 === 2) this.hat(t, 0.04);
    } else if (d === 'fill') {
      if (r === 0 || r === 8) this.kick(t);
      if (r === 4) this.snare(t);
      if (r >= 12) this.snare(t, 0.6);
      if (r % 2 === 0 && r < 12) this.hat(t, 0.05);
    }
  }

  private note(w: Wave, midi: number, t: number, dur: number, vol: number, vibrato: boolean, bus?: GainNode): void {
    if (!this.ctx || midi < 0) return;
    const o = this.osc(w);
    const g = this.ctx.createGain();
    const f = midiToFreq(midi);
    o.frequency.setValueAtTime(f, t);
    if (vibrato && dur > 0.25) {
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setTargetAtTime(vol * 0.7, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + Math.max(0.02, dur - 0.02), 0.02);
    o.connect(g);
    g.connect(bus ?? this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.15);
  }

  private arp(notes: number[], t: number, dur: number, vol: number): void {
    if (!this.ctx) return;
    const o = this.osc('pulse12');
    const g = this.ctx.createGain();
    const tick = 1 / 50;
    let i = 0;
    for (let tt = t; tt < t + dur; tt += tick) {
      o.frequency.setValueAtTime(midiToFreq(notes[i % notes.length]), tt);
      i++;
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.05, 0.3);
    g.gain.setTargetAtTime(0, t + dur - 0.03, 0.02);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private kick(t: number, bus?: GainNode): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g);
    g.connect(bus ?? this.musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, bus?: GainNode): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol = 1): void {
    this.noiseHit(t, 0.14, 0.35 * vol, 'bandpass', 1800);
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    g.gain.setValueAtTime(0.25 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, 0.04, vol * 2, 'highpass', 7000);
  }

  sfx(kind: Sfx): void {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.005;
    const bus = this.sfxBus;
    const blip = (w: Wave, n: number, at: number, d: number, v: number) => this.note(w, n, at, d, v, false, bus);
    switch (kind) {
      case 'move':
        blip('pulse25', 84, t, 0.03, 0.12);
        break;
      case 'tick':
        blip('pulse12', 96, t, 0.015, 0.06);
        break;
      case 'select':
        blip('pulse25', 79, t, 0.05, 0.15);
        blip('pulse25', 86, t + 0.05, 0.07, 0.15);
        break;
      case 'back':
        blip('pulse25', 79, t, 0.05, 0.13);
        blip('pulse25', 72, t + 0.05, 0.07, 0.13);
        break;
      case 'error':
        blip('pulse50', 40, t, 0.18, 0.18);
        blip('pulse50', 41, t, 0.18, 0.1);
        break;
      case 'coin':
        blip('pulse25', 83, t, 0.06, 0.15);
        blip('pulse25', 88, t + 0.06, 0.18, 0.15);
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          blip('pulse50', 76, t + i * 0.2, 0.1, 0.12);
          blip('pulse50', 71, t + i * 0.2 + 0.1, 0.1, 0.12);
        }
        break;
      case 'good':
        [72, 76, 79, 84].forEach((n, i) => blip('pulse25', n, t + i * 0.06, 0.08, 0.13));
        break;
      case 'levelup':
        [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => blip('pulse25', n, t + i * 0.07, 0.12, 0.13));
        this.kick(t, bus);
        break;
      case 'type':
        this.noiseHit(t, 0.025, 0.25, 'highpass', 3000, bus);
        break;
      case 'disk': {
        // Floppy drive head stepping: a burst of dull mechanical clicks
        for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.09 + Math.random() * 0.02, 0.03, 0.5, 'bandpass', 900 + Math.random() * 400, bus);
        break;
      }
    }
  }
}

export const audio = new Audio();
