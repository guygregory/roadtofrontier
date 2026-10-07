// 4-channel chiptune engine in the spirit of the Amiga's Paula chip:
// pulse lead, fast "VBL" arpeggios or electric-piano chords, bass and noise drums, all synthesised
// with Web Audio. Each financial year has its own in-game tune (see gameSong).

type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'sawtooth';

export interface BarDef {
  /** One chord, or two separated by a space (the second starts half way through the bar). */
  chord: string; // e.g. Am, F, Dm9, Gm7 C7, Bbmaj7, Em7b5
  lead?: string; // 16 tokens: note (A4, C#5, Bb4), '.' hold, '-' rest
  bass?: 'octave' | 'root' | 'walk' | 'bossa' | 'funk' | 'none';
  drums?: 'beat' | 'half' | 'fill' | 'swing' | 'swingfill' | 'bossa' | 'groove' | 'groovefill' | 'none';
  arp?: boolean;
  /** Electric-piano chord comping rhythm. */
  keys?: 'charleston' | 'bossa' | 'stabs' | 'pad';
}

export interface SongDef {
  title: string;
  bpm: number;
  loop: boolean;
  leadWave: Wave;
  bars: BarDef[];
  /** Lead volume (default 0.16). */
  leadVol?: number;
  /** Plucked lead (vibes / e-piano) instead of a sustained one. */
  leadPluck?: boolean;
  /** 0 = straight; 1 = full triplet swing on the off-beat eighths. */
  swing?: number;
  /** Overall level trim (default 1), so that every in-game tune sounds about as loud. */
  gain?: number;
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

/** Chord qualities as semitones above the root (4-note jazz voicings drop the fifth from 9th chords). */
export const CHORD_TYPES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 10, 14],
  m9: [0, 3, 10, 14],
  maj9: [0, 4, 11, 14],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
};

/** Notes of a chord with its root in the given octave, e.g. chordNotes('Dm9', 4). */
export function chordNotes(chord: string, octave: number): number[] {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(chord);
  const ivs = m ? CHORD_TYPES[m[2]] : undefined;
  if (!m || !ivs) return [noteToMidi(`A${octave}`)];
  const root = (octave + 1) * 12 + NOTE_INDEX[m[1]];
  return ivs.map((i) => root + i);
}

/** The chord sounding at a row (0-15) of a bar. */
export function chordAt(bar: BarDef, row: number): string {
  const chords = bar.chord.split(/\s+/);
  return chords[row >= 8 && chords.length > 1 ? 1 : 0];
}

/** Rows (and lengths, in rows) of each keys comping rhythm, for one-chord and two-chord bars. */
const KEYS_RHYTHM: Record<NonNullable<BarDef['keys']>, { one: [number, number][]; two: [number, number][] }> = {
  charleston: { one: [[0, 3], [6, 2]], two: [[0, 3], [8, 3]] },
  bossa: { one: [[0, 3], [6, 3], [12, 2]], two: [[0, 3], [6, 2], [8, 3], [14, 2]] },
  stabs: { one: [[3, 1], [6, 2], [11, 1], [14, 2]], two: [[3, 1], [6, 2], [11, 1], [14, 2]] },
  pad: { one: [[0, 16]], two: [[0, 8], [8, 8]] },
};

// --- Songs -------------------------------------------------------------------

const TITLE: SongDef = {
  title: 'Road to Frontier',
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

/** The in-game theme (FY27, then every fourth year). */
const HUB: SongDef = {
  title: 'Partner Journey',
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

// Three variations on the in-game theme in a laid-back, jazzy city-builder style. Each one opens
// with the theme's rising A-D-F motif, re-harmonised and re-grooved.

/** Swing: the motif over Fmaj7, walking bass, ride cymbal and Charleston comping. */
const HUB2: SongDef = {
  title: 'Downtown Development',
  bpm: 96,
  loop: true,
  leadWave: 'pulse50',
  leadVol: 0.11,
  swing: 0.65,
  gain: 0.95,
  bars: [
    { chord: 'Fmaj7', lead: 'A4 . . . D5 . F5 . . . E5 . D5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Dm7', lead: 'C5 . . . . . A4 . . . C5 . D5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Gm7', lead: 'F5 . . . D5 . Bb4 . . . . . A4 . G4 .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'C7', lead: 'E5 . . . . . G5 . . . E5 . C5 . Bb4 .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Am7', lead: 'A4 . . . . . . . - . C5 . E5 . G5 .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'D7', lead: 'F#5 . . . . . E5 . . . D5 . C5 . A4 .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Gm7 C7', lead: 'Bb4 . . . D5 . . . E5 . . . G5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Fmaj7', lead: 'F5 . . . . . . . . . - . A4 . C5 .', bass: 'walk', drums: 'swingfill', keys: 'charleston' },
    { chord: 'Bbmaj7', lead: 'D5 . . . F5 . A5 . . . G5 . F5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Bbm6', lead: 'Db5 . . . . . C5 . . . Bb4 . . . - .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Am7', lead: 'C5 . . . E5 . . . G5 . . . A5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'D7', lead: 'F#5 . . . . . . . E5 . D5 . C5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Gm7', lead: 'Bb4 . . . D5 . F5 . . . A5 . G5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'C7', lead: 'E5 . . . . . D5 . . . C5 . Bb4 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Am7 D7', lead: 'A4 . . . C5 . . . F#5 . . . A5 . . .', bass: 'walk', drums: 'swing', keys: 'charleston' },
    { chord: 'Gm7 C7', lead: 'G5 . . . F5 . . . E5 . . . C5 . . .', bass: 'walk', drums: 'swingfill', keys: 'charleston' },
  ],
};

/** Bossa nova in D minor: flute lead, rim-click clave, shaker and nylon-guitar style comping. */
const HUB3: SongDef = {
  title: 'Bossa Budget',
  bpm: 126,
  loop: true,
  leadWave: 'triangle',
  leadVol: 0.24,
  gain: 0.68,
  bars: [
    { chord: 'Dm9', lead: 'A4 . . . . . D5 . . . F5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'G7', lead: 'E5 . . . . . D5 . . . . . - . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Cmaj7', lead: 'G4 . . . . . C5 . . . E5 . . . D5 .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'A7', lead: 'C#5 . . . . . . . E5 . . . - . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Dm7', lead: 'D5 . . . F5 . . . A5 . . . G5 . F5 .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Bbmaj7', lead: 'A5 . . . . . . . F5 . . . D5 . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Em7b5', lead: 'D5 . . . . . Bb4 . . . G4 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'A7', lead: 'A4 . . . C#5 . E5 . . . G5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Fmaj7', lead: 'A5 . . . . . G5 . . . F5 . . . E5 .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Bb7', lead: 'D5 . . . . . F5 . . . Ab5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Am7', lead: 'G5 . . . . . E5 . . . C5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'D7', lead: 'F#5 . . . . . E5 . . . D5 . . . C5 .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Gm7', lead: 'Bb4 . . . . . D5 . . . F5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'C7', lead: 'E5 . . . . . D5 . . . C5 . . . Bb4 .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'Em7b5', lead: 'G4 . . . . . Bb4 . . . D5 . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
    { chord: 'A7', lead: 'C#5 . . . . . E5 . . . - . . . . .', bass: 'bossa', drums: 'bossa', keys: 'bossa' },
  ],
};

/** Slow funk in G minor: plucked e-piano lead, slap bass and stabs, then arpeggios in the bridge. */
const HUB4: SongDef = {
  title: 'Night Shift',
  bpm: 88,
  loop: true,
  leadWave: 'pulse25',
  leadVol: 0.15,
  leadPluck: true,
  swing: 0.3,
  gain: 1.35,
  bars: [
    { chord: 'Gm9', lead: 'D5 . . G5 . . Bb5 . . . A5 . G5 . . .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'C9', lead: '- . . . . . D5 . E5 . . . G5 . E5 .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'Gm9', lead: 'D5 . . G5 . . Bb5 . . . C6 . Bb5 . A5 .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'C9', lead: 'G5 . . . . . E5 . . . D5 . . . - .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'Ebmaj7', lead: 'Bb4 . . . D5 . . G5 . . . . F5 . Eb5 .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'D7', lead: 'F#5 . . . . . . . A5 . . . C6 . . .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'Gm7', lead: 'Bb5 . . . A5 . G5 . . . F5 . D5 . . .', bass: 'funk', drums: 'groove', keys: 'stabs' },
    { chord: 'D7', lead: 'F#5 . . . . . . . . . . . - . D5 .', bass: 'funk', drums: 'groovefill', keys: 'stabs' },
    { chord: 'Bbmaj7', lead: 'F5 . . . . . D5 . . . A5 . . . . .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Cm7', lead: 'G5 . . . . . Eb5 . . . Bb4 . . . C5 .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Dm7', lead: 'D5 . . F5 . . A5 . . . G5 . F5 . . .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Gm7', lead: 'D5 . . . . . Bb4 . . . G4 . . . . .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Ebmaj7', lead: 'Eb5 . . . G5 . . Bb5 . . . . D5 . . .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'F7', lead: 'C5 . . . . . Eb5 . . . F5 . . . A5 .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Cm7 D7', lead: 'G5 . . . Eb5 . . . F#5 . . . A5 . . .', bass: 'funk', drums: 'groove', arp: true },
    { chord: 'Gm7', lead: 'G5 . . . . . . . . . . . - . . .', bass: 'funk', drums: 'groovefill', arp: true },
  ],
};

const WIN: SongDef = {
  title: 'Victory',
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
  title: 'Guru Meditation',
  bpm: 84,
  loop: false,
  leadWave: 'pulse50',
  bars: [
    { chord: 'Am', lead: 'E5 . . . C5 . . . A4 . . . . . . .', bass: 'root', drums: 'none', arp: true },
    { chord: 'E', lead: 'G#4 . . . . . . . B4 . . . . . . .', bass: 'root', drums: 'none', arp: true },
    { chord: 'Am', lead: 'A4 . . . . . . . . . . . - . . .', bass: 'root', drums: 'none', arp: true },
  ],
};

export const SONGS: Record<string, SongDef> = { title: TITLE, hub: HUB, hub2: HUB2, hub3: HUB3, hub4: HUB4, win: WIN, lose: LOSE };

/** In-game tunes, one per financial year in rotation: FY27 hub, FY28 hub2, ... then FY31 starts the cycle again. */
export const GAME_SONGS = ['hub', 'hub2', 'hub3', 'hub4'];

export function gameSong(fy: number): string {
  return GAME_SONGS[(((fy - 27) % GAME_SONGS.length) + GAME_SONGS.length) % GAME_SONGS.length];
}

/** Walking bass: a quarter note per beat, ending each bar with a half-step approach to the next root. */
export function walkingBass(song: SongDef, barIdx: number): number[] {
  const bar = song.bars[barIdx];
  const c1 = chordNotes(chordAt(bar, 0), 2);
  const c2 = chordNotes(chordAt(bar, 8), 2);
  const nextRoot = chordNotes(chordAt(song.bars[(barIdx + 1) % song.bars.length], 0), 2)[0];
  const fifth = (c: number[]) => c[0] + 7;
  let line: number[];
  if (c1[0] !== c2[0]) line = [c1[0], fifth(c1), c2[0]];
  else if (barIdx % 2 === 0) line = [c1[0], c1[1], fifth(c1)];
  else line = [c1[0], fifth(c1), c1[0] + (c1.length > 3 ? c1[3] - c1[0] : 9)];
  const last = line[2];
  // Half a step below or above the next root, whichever is nearer: it resolves on the next downbeat.
  const approach = Math.abs(nextRoot - 1 - last) <= Math.abs(nextRoot + 1 - last) ? nextRoot - 1 : nextRoot + 1;
  return [...line, approach].map((n) => (n > 52 ? n - 12 : n < 33 ? n + 12 : n));
}

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

  /** Name of the song playing (or queued until audio is unlocked). */
  get current(): string {
    return this.songName;
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
      this.musicBus.gain.value = this.musicLevel();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0;
      this.sfxBus.connect(this.master);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.songName && !this.timer) this.startScheduler();
  }

  private makeNoise(ctx: BaseAudioContext): AudioBuffer {
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** Music bus level: off, or the music volume trimmed for the song playing. */
  private musicLevel(): number {
    return this.musicOn ? 0.5 * (this.song?.gain ?? 1) : 0;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 0.05);
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
    if (this.ctx) {
      this.musicBus.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 0.05);
      this.startScheduler();
    }
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

  /**
   * Render the start of a song offline, through the same synthesis and music volume as live play.
   * Used by tests and tools; returns mono samples (empty where OfflineAudioContext is unavailable).
   */
  async renderSong(name: string, seconds: number, sampleRate = 22050): Promise<Float32Array> {
    const song = SONGS[name];
    if (!song || typeof OfflineAudioContext === 'undefined') return new Float32Array(0);
    const off = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const live = { ctx: this.ctx, master: this.master, musicBus: this.musicBus, sfxBus: this.sfxBus, noise: this.noise, waves: this.waves };
    try {
      this.ctx = off as unknown as AudioContext;
      this.waves = {};
      this.master = off.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(off.destination);
      this.musicBus = off.createGain();
      this.musicBus.gain.value = 0.5 * (song.gain ?? 1);
      this.musicBus.connect(this.master);
      this.sfxBus = this.musicBus;
      this.noise = this.makeNoise(off);
      const rowDur = 60 / song.bpm / 4;
      const total = song.bars.length * 16;
      for (let row = 0; row * rowDur < seconds; row++) {
        if (!song.loop && row >= total) break;
        this.playRow(song, row % total, 0.02 + row * rowDur, rowDur);
      }
    } finally {
      this.ctx = live.ctx;
      this.master = live.master;
      this.musicBus = live.musicBus;
      this.sfxBus = live.sfxBus;
      this.noise = live.noise;
      this.waves = live.waves;
    }
    const buf = await off.startRendering();
    return buf.getChannelData(0);
  }

  private playRow(song: SongDef, row: number, t: number, rowDur: number): void {
    const barIdx = Math.floor(row / 16);
    const bar = song.bars[barIdx];
    const r = row % 16;
    const chord = chordAt(bar, r);
    // Swing: off-beat eighths land later, up to a full triplet feel.
    const swingDelay = (song.swing ?? 0) * rowDur * (2 / 3);
    const sw = (x: number) => (x % 4 === 2 ? swingDelay : 0);
    const at = t + sw(r);
    // Lead
    if (bar.lead) {
      const toks = bar.lead.split(/\s+/);
      const tok = toks[r] ?? '.';
      if (tok !== '.' && tok !== '-') {
        let len = 1;
        while (r + len < 16 && (toks[r + len] ?? '.') === '.') len++;
        const dur = len * rowDur + sw(r + len) - sw(r);
        this.note(song.leadWave, noteToMidi(tok), at, dur, song.leadVol ?? 0.16, !song.leadPluck, undefined, song.leadPluck);
      }
    }
    // Arpeggio: chord cycled at 50Hz like a VBL-driven Amiga tracker
    if (bar.arp && r % 8 === 0) {
      const notes = chordNotes(chord, 4);
      this.arp(notes, t, rowDur * 8, 0.055);
    }
    // Electric piano comping
    if (bar.keys) {
      const rhythm = KEYS_RHYTHM[bar.keys][bar.chord.includes(' ') ? 'two' : 'one'];
      const hit = rhythm.find(([row0]) => row0 === r);
      if (hit) {
        const base = chordNotes(chord, 3)[0] < 52 ? 4 : 3;
        const pad = bar.keys === 'pad';
        this.chordStab(chordNotes(chord, base), at, hit[1] * rowDur * (pad ? 1 : 0.9), pad ? 0.035 : 0.045, pad);
      }
    }
    // Bass
    const root = chordNotes(chord, 2)[0];
    if (bar.bass === 'octave' && r % 2 === 0) {
      this.note('pulse50', root + (r % 4 === 2 ? 12 : 0), t, rowDur * 1.6, 0.13, false);
    } else if (bar.bass === 'root' && r % 4 === 0) {
      this.note('triangle', root + 12, t, rowDur * 3.5, 0.3, false);
    } else if (bar.bass === 'walk' && r % 4 === 0) {
      this.note('triangle', walkingBass(song, barIdx)[r / 4] + 12, t, rowDur * 3.6, 0.3, false, undefined, true);
    } else if (bar.bass === 'bossa' && r % 8 === 0) {
      this.note('triangle', root + 12, t, rowDur * 5.5, 0.3, false);
    } else if (bar.bass === 'bossa' && r % 8 === 6) {
      const fifth = root + 7 > 50 ? root - 5 : root + 7;
      this.note('triangle', fifth + 12, t, rowDur * 1.8, 0.26, false);
    } else if (bar.bass === 'funk') {
      const step = ({ 0: [0, 2], 3: [0, 1], 6: [12, 1], 8: [0, 2], 10: [7, 1], 12: [0, 1], 14: [12, 2] } as Record<number, [number, number]>)[r];
      if (step) this.note('pulse50', root + step[0], at, rowDur * step[1] * 0.85, 0.12, false, undefined, true);
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
    } else if (d === 'swing' || d === 'swingfill') {
      // Ride "ding, ding-a-ding", hi-hat foot on 2 and 4, feathered kick
      const fill = d === 'swingfill' && r >= 8;
      if (!fill && [0, 4, 6, 8, 12, 14].includes(r)) this.ride(at, r % 4 === 0 ? 0.06 : 0.045);
      if (!fill && (r === 4 || r === 12)) {
        this.chick(t);
        this.rim(t, 0.5);
      }
      if (r === 0) this.kick(t, undefined, 0.35);
      if (fill && r % 2 === 0) this.snare(at, 0.35 + (r - 8) * 0.06);
      if (fill && r === 14) this.kick(at, undefined, 0.45);
    } else if (d === 'bossa') {
      // Rim-click clave across two bars, "boom - ba - boom" kick and a shaker on every sixteenth
      const clave = barIdx % 2 === 0 ? [0, 6, 12] : [4, 10];
      if (clave.includes(r)) this.rim(t, 0.6);
      if (r === 0 || r === 8) this.kick(t, undefined, 0.45);
      if (r === 6 || r === 14) this.kick(t, undefined, 0.25);
      this.hat(t, r % 4 === 2 ? 0.035 : 0.018);
    } else if (d === 'groove' || d === 'groovefill') {
      const fill = d === 'groovefill' && r >= 10;
      if (r === 0 || r === 7 || (r === 10 && !fill)) this.kick(at, undefined, 0.6);
      if (r === 4 || (r === 12 && !fill)) this.snare(at, 0.9);
      if (!fill && (r === 6 || r === 15)) this.snare(at, 0.22);
      if (fill) this.snare(at, 0.4 + (r - 10) * 0.08);
      if (!fill && r % 2 === 0) this.hat(at, r === 14 ? 0.06 : 0.04);
    }
  }

  private note(w: Wave, midi: number, t: number, dur: number, vol: number, vibrato: boolean, bus?: GainNode, pluck = false): void {
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
    if (pluck) g.gain.setTargetAtTime(vol * 0.15, t + 0.012, 0.22);
    else g.gain.setTargetAtTime(vol * 0.7, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + Math.max(0.02, dur - 0.02), 0.02);
    o.connect(g);
    g.connect(bus ?? this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.15);
  }

  /** A soft electric-piano chord: every note at once, quick attack and a gentle decay. */
  private chordStab(notes: number[], t: number, dur: number, vol: number, pad: boolean): void {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (pad ? 0.08 : 0.006));
    g.gain.setTargetAtTime(vol * (pad ? 0.8 : 0.45), t + 0.02, pad ? 0.6 : 0.18);
    g.gain.setTargetAtTime(0, t + Math.max(0.03, dur - 0.03), 0.03);
    g.connect(this.musicBus);
    for (const n of notes) {
      const o = this.osc('triangle');
      o.frequency.setValueAtTime(midiToFreq(n), t);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.2);
    }
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

  private kick(t: number, bus?: GainNode, vol = 0.7): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
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

  /** Ride cymbal: a longer, airy wash. */
  private ride(t: number, vol: number): void {
    this.noiseHit(t, 0.22, vol, 'highpass', 5500);
    this.noiseHit(t, 0.06, vol * 0.8, 'bandpass', 9000);
  }

  /** Hi-hat closed with the foot. */
  private chick(t: number): void {
    this.noiseHit(t, 0.025, 0.05, 'highpass', 8500);
  }

  /** Rim click / cross-stick: a short woody tick. */
  private rim(t: number, vol: number): void {
    this.noiseHit(t, 0.03, 0.25 * vol, 'bandpass', 3200);
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1700, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    g.gain.setValueAtTime(0.18 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.05);
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
