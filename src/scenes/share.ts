import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { paragraph } from '../engine/font';
import { ui } from '../engine/ui';
import { downloadBlob } from '../files';
import { shareImageName, shareIntentUrl, shareMessage, ShareNetwork } from '../game/share';
import { CARD_H, drawShareCard, shareCardBlob } from '../sharecard';

/** Preview the share card, then post it to LinkedIn or X (image downloaded, message pre-filled and copied). */
export class ShareScene implements Scene {
  music = undefined;

  constructor(
    private back: Scene,
    private score: number,
  ) {}

  private saveImage(app: App, then?: () => void): void {
    const s = app.state!;
    const name = shareImageName();
    shareCardBlob(s, this.score).then(
      (blob) => {
        downloadBlob(name, blob);
        then?.();
      },
      () => app.toast('Could not create the image'),
    );
  }

  private share(app: App, network: ShareNetwork): void {
    const s = app.state!;
    const msg = shareMessage(s, this.score);
    // Copy first and open the tab straight away: both need the click that is still "fresh".
    navigator.clipboard?.writeText(msg).catch(() => undefined);
    window.open(shareIntentUrl(network, msg), '_blank', 'noopener');
    const where = network === 'linkedin' ? 'LinkedIn' : 'X';
    this.saveImage(app, () =>
      app.message(
        `SHARE ON ${network === 'linkedin' ? 'LINKEDIN' : 'X'}`,
        `${where} has opened in a new tab with your post written for you (it's on your clipboard too).\n\nYour result card was downloaded as {y}${shareImageName()}{/} - attach it to the post, then hit Post!`,
        'good',
        'megaphone',
      ),
    );
    audio.sfx('coin');
  }

  frame(app: App): void {
    const s = app.state;
    const g = app.g;
    if (!s) return;
    drawShareCard(g, s, this.score);
    g.rect(0, CARD_H, 320, 256 - CARD_H, C.DNAVY);
    g.hline(0, 319, CARD_H, C.MSYELLOW);
    paragraph(
      g,
      'Share your result! We pre-write the post with a link to the game and {c}#roadtofrontier{/}, and download this card for you to attach.',
      8,
      CARD_H + 6,
      304,
      C.CREAM,
      10,
    );
    const y = 222;
    if (ui.button(8, y, 72, 14, 'LINKEDIN', { style: 'box', colour: C.MSBLUE })) this.share(app, 'linkedin');
    if (ui.button(86, y, 72, 14, 'X', { style: 'box' })) this.share(app, 'x');
    if (ui.button(164, y, 72, 14, 'SAVE IMAGE', { style: 'box' })) this.saveImage(app, () => app.toast(`Saved ${shareImageName()}`));
    if (ui.button(242, y, 70, 14, 'BACK', { style: 'box' }) || ui.back()) app.go(this.back);
  }
}
