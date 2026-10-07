import { describe, it, expect } from 'vitest';
import { CHORD_TYPES, GAME_SONGS, SONGS, chordAt, chordNotes, gameSong, noteToMidi, walkingBass } from '../src/engine/audio';

const quality = (chord: string) => /^[A-G](?:#|b)?(.*)$/.exec(chord)?.[1] ?? '?';

/** Pitch classes (semitones above the root) a melody note may use over a chord. */
function allowed(chord: string, strong: boolean): Set<number> {
  const q = quality(chord);
  const ivs = CHORD_TYPES[q].map((i) => i % 12);
  const minor = q.startsWith('m') && !q.startsWith('maj');
  // 9th-chord voicings drop the fifth, but it is still part of the harmony.
  const set = new Set([...ivs, ...(/9/.test(q) ? [7] : [])]);
  set.add(2); // 9th
  set.add(9); // 6th / 13th
  if (minor || !strong) set.add(5); // 11th: on minor chords, or in passing
  if (q === 'm7b5') set.add(8);
  if (q === '') set.add(11); // a plain triad can take its major 7th colour...
  if (q === 'm') set.add(10); // ...or minor 7th
  return set;
}

describe('music', () => {
  it('has a different tune for each financial year, in rotation', () => {
    expect(GAME_SONGS).toEqual(['hub', 'hub2', 'hub3', 'hub4']);
    expect([27, 28, 29, 30, 31, 32, 35].map(gameSong)).toEqual(['hub', 'hub2', 'hub3', 'hub4', 'hub', 'hub2', 'hub']);
    expect(new Set(GAME_SONGS.map((n) => SONGS[n].title)).size).toBe(4);
  });

  it('every song is well formed', () => {
    for (const [name, song] of Object.entries(SONGS)) {
      expect(song.title, name).toBeTruthy();
      song.bars.forEach((bar, i) => {
        const where = `${name} bar ${i + 1}`;
        const chords = bar.chord.split(/\s+/);
        expect(chords.length, where).toBeLessThanOrEqual(2);
        for (const c of chords) expect(CHORD_TYPES[quality(c)], `${where}: ${c}`).toBeDefined();
        if (bar.lead) {
          const toks = bar.lead.split(/\s+/);
          expect(toks.length, where).toBe(16);
          for (const t of toks) if (t !== '.' && t !== '-') expect(noteToMidi(t), `${where}: ${t}`).toBeGreaterThan(0);
        }
      });
    }
  });

  it('the FY tunes are variations on the in-game theme: they open with its motif, up a fourth then a minor third', () => {
    for (const name of GAME_SONGS) {
      const first = SONGS[name].bars[0].lead!.split(/\s+/).filter((t) => t !== '.' && t !== '-').map(noteToMidi);
      expect([first[1] - first[0], first[2] - first[1]], name).toEqual([5, 3]);
    }
  });

  it('melody notes fit the harmony: chord tones or 9th/11th/13th tensions', () => {
    for (const name of GAME_SONGS) {
      SONGS[name].bars.forEach((bar, i) => {
        bar.lead!.split(/\s+/).forEach((tok, row) => {
          if (tok === '.' || tok === '-') return;
          const chord = chordAt(bar, row);
          const pc = (((noteToMidi(tok) - chordNotes(chord, 4)[0]) % 12) + 12) % 12;
          const strong = row % 4 === 0;
          expect(allowed(chord, strong).has(pc), `${name} bar ${i + 1} row ${row}: ${tok} over ${chord}`).toBe(true);
        });
      });
    }
  });

  it('the melodies stay in a comfortable range', () => {
    for (const name of GAME_SONGS) {
      for (const bar of SONGS[name].bars) {
        for (const tok of bar.lead!.split(/\s+/)) {
          if (tok === '.' || tok === '-') continue;
          expect(noteToMidi(tok)).toBeGreaterThanOrEqual(noteToMidi('F4'));
          expect(noteToMidi(tok)).toBeLessThanOrEqual(noteToMidi('C6'));
        }
      }
    }
  });

  it('walking bass lines resolve by half step into the next bar', () => {
    const song = SONGS.hub2;
    song.bars.forEach((_, i) => {
      const line = walkingBass(song, i);
      expect(line).toHaveLength(4);
      for (const n of line) {
        expect(n).toBeGreaterThanOrEqual(33);
        expect(n).toBeLessThanOrEqual(52);
      }
      const nextRoot = walkingBass(song, (i + 1) % song.bars.length)[0];
      expect(Math.abs(line[3] - nextRoot), `bar ${i + 1}`).toBe(1);
    });
  });

  it('parses jazz chords', () => {
    expect(chordNotes('Fmaj7', 4)).toEqual([65, 69, 72, 76]);
    expect(chordNotes('Dm9', 4)).toEqual([62, 65, 72, 76]);
    expect(chordNotes('Em7b5', 4)).toEqual([64, 67, 70, 74]);
    expect(chordNotes('Bbm6', 3)).toEqual([58, 61, 65, 67]);
    expect(chordNotes('Am', 4)).toEqual([69, 72, 76]);
  });
});
