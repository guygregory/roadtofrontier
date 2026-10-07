import type { App } from '../app';
import { audio } from '../engine/audio';
import { downloadBlob, pickTextFile } from '../files';
import { turnLabel } from '../game/format';
import { decodeSave, encodeSave, saveFileName, SaveError } from '../game/save';
import { resumeGame } from './flow';

/** Download the current game as frontier-YYYY-MM-DD.sav. */
export function exportSave(app: App): void {
  const s = app.state;
  if (!s) return;
  const name = saveFileName();
  try {
    downloadBlob(name, new Blob([encodeSave(s)], { type: 'application/octet-stream' }));
    app.markSaved();
    app.toast(`Saved ${name}`);
    audio.sfx('coin');
  } catch {
    app.toast('Could not save the game');
  }
}

/** Pick a .sav file and resume it. */
export function importSave(app: App): void {
  pickTextFile('.sav').then((file) => {
    if (!file) return;
    try {
      const s = decodeSave(file.text);
      resumeGame(app, s);
      app.markSaved();
      app.toast(`Loaded ${s.company} ${turnLabel(s.turn)}`);
      audio.sfx('levelup');
    } catch (e) {
      app.message('CAN\'T LOAD', e instanceof SaveError ? e.message : 'The save file could not be read.', 'bad', 'warning');
    }
  });
}
