import { DIFFICULTY } from './data';
import { turnLabel } from './format';
import type { GameState } from './types';

export const SHARE_URL = 'https://aka.ms/roadtofrontier';
export const SHARE_TAG = '#roadtofrontier';

/** Headline for the end screen and share card. */
export function outcomeTitle(s: GameState): string {
  switch (s.endKind) {
    case 'frontier':
      return 'FRONTIER PARTNER!';
    case 'poty':
      return 'PARTNER OF THE YEAR!';
    case 'bankrupt':
      return 'OUT OF BUSINESS';
    case 'removed':
      return 'MEMBERSHIP REMOVED';
    default:
      return 'GAME OVER';
  }
}

/** Pre-written post encouraging others to play. Kept well under X's 280 characters. */
export function shareMessage(s: GameState, score: number): string {
  const diff = DIFFICULTY[s.difficulty].name;
  const when = turnLabel(s.flags.endTurn ?? Math.max(0, s.turn - 1));
  const tail = `Score: ${score} on ${diff} difficulty.`;
  let head: string;
  let ask: string;
  switch (s.endKind) {
    case 'frontier':
      head = `🚀 ${s.company} made it to Frontier Partner in ${when}, in ROAD TO FRONTIER - a retro Microsoft partner journey game!`;
      ask = 'Can you get there faster?';
      break;
    case 'poty':
      head = `🏆 ${s.company} won Microsoft Partner of the Year in ${when}, in ROAD TO FRONTIER - a retro Microsoft partner journey game!`;
      ask = 'Can you beat my score?';
      break;
    case 'bankrupt':
      head = `💾 ${s.company} ran out of cash in ${when} on the ROAD TO FRONTIER - a retro Microsoft partner journey game.`;
      ask = 'Think you can run a better partner business?';
      break;
    default:
      head = `💾 ${s.company} lost its MAICPP membership in ${when} on the ROAD TO FRONTIER - a retro Microsoft partner journey game.`;
      ask = 'Think you can do better?';
  }
  return `${head} ${tail} ${ask} Play it here: ${SHARE_URL} ${SHARE_TAG}`;
}

export type ShareNetwork = 'linkedin' | 'x';

/** Share-intent URL with the message pre-filled. */
export function shareIntentUrl(network: ShareNetwork, message: string): string {
  const t = encodeURIComponent(message);
  return network === 'linkedin' ? `https://www.linkedin.com/feed/?shareActive=true&text=${t}` : `https://x.com/intent/post?text=${t}`;
}

/** e.g. frontier-result-2026-10-25.png */
export function shareImageName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `frontier-result-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`;
}
