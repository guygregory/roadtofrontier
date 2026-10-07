import type { Gfx, Sprite } from './gfx';
import { C } from './palette';

// Global character -> palette index map used by all ASCII pixel art below.
const MAP: Record<string, number> = {
  k: C.BLACK, w: C.WHITE, l: C.LGREY, g: C.GREY, d: C.DGREY, n: C.NEARBLACK,
  r: C.MSRED, v: C.MSGREEN, b: C.MSBLUE, y: C.MSYELLOW,
  R: C.RED, G: C.GREEN, Y: C.YELLOW, c: C.CYAN, p: C.PINK, u: C.PURPLE,
  N: C.NAVY, B: C.ROYAL, e: C.BLUE, z: C.DNAVY,
  o: C.ORANGE, h: C.BROWN, H: C.DBROWN, s: C.SKIN, S: C.SKIN2,
  D: C.DGREEN, m: C.MGREEN, x: C.DRED, X: C.MRED,
  t: C.SLATE, T: C.LSLATE, C: C.CREAM,
};

export function makeSprite(rows: string[]): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch !== '.' && MAP[ch] !== undefined) px[y * w + x] = MAP[ch];
    }
  }
  return { w, h, px };
}

const ART: Record<string, string[]> = {
  skill: [
    '................',
    '................',
    '................',
    '.......kk.......',
    '.....kkBBkk.....',
    '...kkBBNNBBkk...',
    '.kkBBNNNNNNBBkk.',
    'kBBNNNNNNNNNNBBk',
    '.kkNNNNNNNNNNkky',
    '...kkNNNNNNkk.y.',
    '....kkkkkkkk..y.',
    '....kNNNNNNk..y.',
    '....kNNNNNNk.yyy',
    '....kkNNNNkk.yyy',
    '......kkkk......',
    '................',
  ],
  offer: [
    '................',
    '................',
    '......y..y......',
    '.....y.yy.y.....',
    '..kkkkkyykkkkk..',
    '..kooooyyooook..',
    '..kooooyyooook..',
    '..kkkkkyykkkkk..',
    '...khhhyyhhhk...',
    '...khhhyyhhhk...',
    '...khhhyyhhhk...',
    '...khhhyyhhhk...',
    '...khhhyyhhhk...',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  cart: [
    '................',
    'kkkk............',
    '...k............',
    '...kkkkkkkkkkkk.',
    '...kbbbbbbbbbbk.',
    '....kbbbbbbbbk..',
    '....kbrrbvvbbk..',
    '.....kbbbbbbk...',
    '.....kkkkkkkk...',
    '.....k..........',
    '.....kkkkkkkkk..',
    '................',
    '......kk...kk...',
    '.....kddk.kddk..',
    '......kk...kk...',
    '................',
  ],
  coin: [
    '................',
    '...........w....',
    '..........www...',
    '....kkkkkkkkw...',
    '..kkYYYYYYYYkk..',
    '.kYYYYYYYYYYYYk.',
    '.khYYYYYYYYYYhk.',
    '.kyhhhhhhhhhhyk.',
    '.kyyyyyyyyyyyyk.',
    '.khhhhhhhhhhhhk.',
    '.kyyyyyyyyyyyyk.',
    '.khhhhhhhhhhhhk.',
    '.kyyyyyyyyyyyyk.',
    '..kkyyyyyyyykk..',
    '....kkkkkkkk....',
    '................',
  ],
  megaphone: [
    '................',
    '..........k.....',
    '........kkk.....',
    '......kkrrk.....',
    '....kkrrrrk...w.',
    '.kkkrrrrrrk..w..',
    '.kwkrrrrrrk.....',
    '.kwkrrrrrrk.www.',
    '.kwkrrrrrrk.....',
    '.kkkrrrrrrk..w..',
    '....kkrrrrk...w.',
    '....k.kkrrk.....',
    '....kk..kkk.....',
    '.....k..........',
    '.....kk.........',
    '................',
  ],
  flame: [
    '................',
    '.......kk.......',
    '......kRRk......',
    '......kRRk......',
    '.....kRooRk.....',
    '.....kRooRk.....',
    '....kRooooRk....',
    '....kRoYYoRk....',
    '...kRooYYooRk...',
    '...kRoYwwYoRk...',
    '..kRooYwwYooRk..',
    '..kRoYwwwwYoRk..',
    '..kRoYwwwwYoRk..',
    '...kRoYYYYoRk...',
    '....kkRRRRkk....',
    '......kkkk......',
  ],
  monitor: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kddddddddddddk.',
    '.kdNNNNNNNNNNdk.',
    '.kdNGGGNNNNNNdk.',
    '.kdNNNYYYYNNNdk.',
    '.kdNNNcccNNNNdk.',
    '.kdNGGGGGNNNNdk.',
    '.kdNNNppppNNNdk.',
    '.kdNNNNNNNNNNdk.',
    '.kddddddddddddk.',
    '.kkkkkkkkkkkkkk.',
    '......kddk......',
    '....kkddddkk....',
    '....kkkkkkkk....',
    '................',
  ],
  trophy: [
    '................',
    '...kkkkkkkkkk...',
    '.kkkYYYYwYyykkk.',
    'kk.kYYYYwYyyk.kk',
    'k..kYYYYwYyyk..k',
    'kk.kYYYYYYyyk.kk',
    '.kkkkYYYYyykkkk.',
    '....kYYYYyyk....',
    '.....kYYyyk.....',
    '......kYyk......',
    '......kYyk......',
    '.....kkYykk.....',
    '....kYYYyyyk....',
    '...kkkkkkkkkk...',
    '...khhhhhhhhk...',
    '...kkkkkkkkkk...',
  ],
  briefcase: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '.....kh..hk.....',
    '.kkkkkkkkkkkkkk.',
    '.kooooooooooook.',
    '.khhhhhhhhhhhhk.',
    '.khhhhhkkhhhhhk.',
    '.kkkkkkYYkkkkkk.',
    '.khhhhhkkhhhhhk.',
    '.khhhhhhhhhhhhk.',
    '.khhhhhhhhhhhhk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  headset: [
    '................',
    '.....kkkkkk.....',
    '...kkddddddkk...',
    '..kdd......ddk..',
    '.kd..........dk.',
    '.kd..........dk.',
    'kkkk........kkkk',
    'kbbk........kbbk',
    'kbbk........kbbk',
    'kbbk........kbbk',
    'kkkk........kkkk',
    '.kd.............',
    '..kd............',
    '...kdddkk.......',
    '.......kRk......',
    '........k.......',
  ],
  handshake: [
    '................',
    '................',
    '................',
    '................',
    'kk............kk',
    'bbk..........koo',
    'bbbkkk....kkkooo',
    'bbbksskkkkssSooo',
    'bbbkssssssssSooo',
    'bbbksSsSsSssSooo',
    'bbbkkssssssskooo',
    'bbk..kkkkkkk.koo',
    'kk............kk',
    '................',
    '................',
    '................',
  ],
  clipboard: [
    '................',
    '......kkkk......',
    '....kkkllkkk....',
    '...khkkkkkkhk...',
    '...khwwwwwwhk...',
    '...khwGwggwhk...',
    '...khGwwwwwhk...',
    '...khwwwwwwhk...',
    '...khwGwggwhk...',
    '...khGwwwwwhk...',
    '...khwwwwwwhk...',
    '...khwRwggwhk...',
    '...khwwwwwwhk...',
    '...khhhhhhhhk...',
    '...kkkkkkkkkk...',
    '................',
  ],
  hire: [
    '................',
    '...kkkkkk.......',
    '..kHHHHHHk......',
    '..kssssssk......',
    '..kskssksk......',
    '..kssssssk......',
    '...kssssk.......',
    '....kkkk........',
    '..kkbbbbkk...G..',
    '.kbbbbbbbbk..G..',
    '.kbbbbbbbbkGGGGG',
    '.kbbbbbbbbk..G..',
    '.kbbbbbbbbk..G..',
    '.kkkkkkkkkk.....',
    '................',
    '................',
  ],
  calendar: [
    '................',
    '...k.......k....',
    '.kkkkkkkkkkkkkk.',
    '.kRRRRRRRRRRRRk.',
    '.kRRRRRRRRRRRRk.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwgwgwgwgwgwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwgwgwgwRRwwwk.',
    '.kwwwwwwwRRwwwk.',
    '.kwgwgwgwgwgwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  rocket: [
    '.......kk.......',
    '......kwwk......',
    '.....kwwwwk.....',
    '.....kwbbwk.....',
    '.....kwbbwk.....',
    '.....kwwwwk.....',
    '.....kwwwwk.....',
    '....kkwwwwkk....',
    '...krkwwwwkrk...',
    '..krrkwwwwkrrk..',
    '..krkkkkkkkkrk..',
    '..kk..kook..kk..',
    '......kYYk......',
    '.......YY.......',
    '.......o........',
    '................',
  ],
  bank: [
    '................',
    '.......kk.......',
    '.....kkllkk.....',
    '...kkllllllkk...',
    '.kkllllllllllkk.',
    '.kkkkkkkkkkkkkk.',
    '..klkklkklkklk..',
    '..klkklkklkklk..',
    '..klkklkklkklk..',
    '..klkklkklkklk..',
    '..klkklkklkklk..',
    '.kkkkkkkkkkkkkk.',
    'kllllllllllllllk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
  ],
  chartdown: [
    '................',
    'k...............',
    'kRR.............',
    'k.RR............',
    'k..RR....R......',
    'k...RR..RRR.....',
    'k....RRRR.RR....',
    'k......R...RR...',
    'k...........RR..',
    'k............RR.',
    'k..........RRRR.',
    'k...........RRR.',
    'k............RR.',
    'k...............',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  server: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kddddddddddk..',
    '..kdGdRdkkkkdk..',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
    '..kddddddddddk..',
    '..kdRdRdkkkkdk..',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
    '..kddddddddddk..',
    '..kdRdRdkkkkdk..',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  hourglass: [
    '................',
    '...kkkkkkkkkk...',
    '....kyyyyyyk....',
    '....kyyyyyyk....',
    '.....kyyyyk.....',
    '......kyyk......',
    '.......kk.......',
    '.......kk.......',
    '......k..k......',
    '.....k.yy.k.....',
    '....k.yyyy.k....',
    '....kyyyyyyk....',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................',
  ],
  door: [
    '................',
    '.kkkkkkk........',
    '.kNNNNNk...kk...',
    '.kNNNNNk..kssk..',
    '.kNNNNNk..kssk..',
    '.kNNNNNk...kk...',
    '.kNNNNyk..kbbk..',
    '.kNNNNNk.kbbbbk.',
    '.kNNNNNk..kbbk..',
    '.kNNNNNk..kbbk..',
    '.kNNNNNk..kddk..',
    '.kNNNNNk.kd..dk.',
    '.kNNNNNk.kd...dk',
    'kkkkkkkkk.......',
    '................',
    '................',
  ],
  warning: [
    '................',
    '.......kk.......',
    '......kYYk......',
    '......kYYk......',
    '.....kYYYYk.....',
    '.....kYkkYk.....',
    '....kYYkkYYk....',
    '....kYYkkYYk....',
    '...kYYYkkYYYk...',
    '...kYYYkkYYYk...',
    '..kYYYYYYYYYYk..',
    '..kYYYYkkYYYYk..',
    '.kYYYYYkkYYYYYk.',
    '.kYYYYYYYYYYYYk.',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  heartbreak: [
    '................',
    '................',
    '..kkkk....kkkk..',
    '.kRRRRk..kRRRRk.',
    'kRRwRRRkkRRRRRRk',
    'kRwwRRRRkRRRRRRk',
    'kRRRRRRkRRRRRRRk',
    'kRRRRRRRkRRRRRRk',
    '.kRRRRRkRRRRRRk.',
    '..kRRRRRkRRRRk..',
    '...kRRRkRRRRk...',
    '....kRRRkRRk....',
    '.....kRRkRk.....',
    '......kRkk......',
    '.......kk.......',
    '................',
  ],
  shield: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kBBBBBBBBBBk..',
    '..kBBBBwwBBBBk..',
    '..kBBBBwwBBBBk..',
    '..kBBBBwwBBBBk..',
    '..kBBBBwwBBBBk..',
    '..kBBBBwwBBBBk..',
    '...kBBBBBBBBk...',
    '...kBBBwwBBBk...',
    '....kBBwwBBk....',
    '.....kBBBBk.....',
    '......kBBk......',
    '.......kk.......',
    '................',
    '................',
  ],
  bulb: [
    '......kkkk......',
    '....kkYYYYkk....',
    '...kYYwwYYYYk...',
    '..kYYwYYYYYYYk..',
    '..kYwYYYYYYYYk..',
    '..kYYYYYYYYYYk..',
    '..kYYYYYYYYYYk..',
    '...kYYYYYYYYk...',
    '....kYYYYYYk....',
    '.....kYYYYk.....',
    '.....kddddk.....',
    '.....kggggk.....',
    '.....kddddk.....',
    '......kkkk......',
    '................',
    '................',
  ],
  star: [
    '................',
    '.......kk.......',
    '......kYYk......',
    '......kYYk......',
    '.....kYYYYk.....',
    'kkkkkkYwYYkkkkkk',
    'kYYYYYwYYYYYYYYk',
    '.kYYYYYYYYYYYYk.',
    '..kYYYYYYYYYYk..',
    '...kYYYYYYYYk...',
    '...kYYYYYYYYk...',
    '..kYYYYkkYYYYk..',
    '..kYYYk..kYYYk..',
    '.kYYkk....kkYYk.',
    '.kkk........kkk.',
    '................',
  ],
  mail: [
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kwkwwwwwwwwwwkwk',
    'kwwkwwwwwwwwkwwk',
    'kwwwkwwwwwwkwwwk',
    'kwwwwkwwwwkwwwwk',
    'kwwwwwkkkkwwwwwk',
    'kwwwwkwwwwkwwwwk',
    'kwwwkwwwwwwkwwwk',
    'kwwkwwwwwwwwkwwk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
    '................',
  ],
  cloud: [
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kwwbbk.....',
    '....kwbbbbbkkk..',
    '..kkbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbek',
    'kbwbbbbbbbbbbbek',
    'kbbbbbbbbbbbbbek',
    'kebbbbbbbbbbbeek',
    '.keeeeeeeeeeeek.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  gear: [
    '................',
    '......kkkk......',
    '...kk.kggk.kk...',
    '..kggkkggkkggk..',
    '..kgggggggggk...',
    '...kggkkkkggk...',
    '.kkggk....kggkk.',
    '.kgggk....kgggk.',
    '.kgggk....kgggk.',
    '.kkggk....kggkk.',
    '...kggkkkkggk...',
    '..kgggggggggk...',
    '..kggkkggkkggk..',
    '...kk.kggk.kk...',
    '......kkkk......',
    '................',
  ],
  people: [
    '................',
    '................',
    '....kkk...kkk...',
    '...kssskkksssk..',
    '...kssskkksssk..',
    '....kkkkskkkk...',
    '...kbbkkskkook..',
    '..kbbbbkkkoooo k',
    '..kbbbbk.koooo k',
    '..kbbbbk.koooo..',
    '..kkkkkk.kkkkk..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

// Alex, your friendly Partner Development Manager (24x24).
const PDM = [
  '........kkkkkkk.........',
  '......kkHHHHHHHkk.......',
  '.....kHHHHHHHHHHHk......',
  '....kHHHHHHHHHHHHHk.....',
  '....kHHHssssssHHHHk.....',
  '...kHHHssssssssHHHHk....',
  '...kHHsssssssssssHHk....',
  '...kHsskksssskkssHHk....',
  '...kHssssssssssssHk.....',
  '...kSssswkssswkssSk.....',
  '...kSsssssssssssssSk....',
  '....kssssssSsssssk......',
  '....ksssssSSsssssk......',
  '....kssssssssssssk......',
  '.....ksssRRRRssssk......',
  '.....kssssRRsssk........',
  '......kkssssssk.........',
  '........kssssk..........',
  '.....kkkkBssBkkkk.......',
  '...kkBBBBBwwBBBBBkk.....',
  '..kBBBBBBBwwBBBBBBBk....',
  '..kBBBBBBBwwBBBBBBBk....',
  '.kBBBBBBBBwwBBBBBBBBk...',
  '.kBBBBBBBBwwBBBBBBBBk...',
];

// Sam, your distributor account manager (24x24): glasses, headset, Kickstart Distribution polo and lanyard.
const DISTI = [
  '........kkkkkkkk........',
  '......kknnnnnnnnkk......',
  '.....knnnnnnnnnnnnk.....',
  '....knnnnnnnnnnnnnnk....',
  '....knnnSSSSSSSSnnnk....',
  '...knnSSSSSSSSSSSSnnk...',
  '...knSSSSSSSSSSSSSSnk...',
  '..ddkSkkkkkSSkkkkkSkdd..',
  '..ddkSkcwckkkkcwckSkdd..',
  '..ddkSkckckSSkckckSkdd..',
  '...dkSkkkkkSSkkkkkSkd...',
  '....kSSSSSShhSSSSSSk.d..',
  '....kSSSSSSSSSSSSSSk.d..',
  '....kSSSSSSSSSSSSSSkd...',
  '.....kSSkSSSSSSkSSkd....',
  '.....kSSSkkkkkkSSSk.....',
  '......kkSSSSSSSSkk......',
  '........kkSSSSkk........',
  '.....kkkkoSSSSokkkk.....',
  '...kkoooooYwwYoooookk...',
  '..koooooooYwwYoooooook..',
  '..kooooooooYYooooooook..',
  '.koooooooooYYoooooooook.',
  '.kooooooooowwoooooooook.',
];

/** MAICPP programme email (24x24): an envelope sealed with the four-square logo, with an unread badge. */
function inboxRows(): string[] {
  const badge = ['.RRR.', 'RwwRR', 'RRwRR', 'RRwRR', '.RRR.'];
  const rows: string[] = [];
  for (let r = 0; r < 24; r++) {
    let row = '';
    for (let c = 0; c < 24; c++) {
      let ch = '.';
      if (r >= 1 && r <= 5 && c >= 18 && c <= 22) ch = badge[r - 1][c - 18];
      if (r >= 6 && r <= 20 && c >= 1 && c <= 21) {
        const d = r - 6;
        if (r === 6 || r === 20 || c === 1 || c === 21) ch = 'k';
        else if ((c - 1 === d || 21 - c === d) && d <= 10) ch = 'k';
        else if (r < 16 && c - 1 > d && 21 - c > d) ch = 'l';
        else ch = 'w';
      }
      const sx = c - 9;
      const sy = r - 13;
      if (sx >= 0 && sx < 5 && sy >= 0 && sy < 5 && sx !== 2 && sy !== 2) ch = sy < 2 ? (sx < 2 ? 'r' : 'v') : sx < 2 ? 'b' : 'y';
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

// Your other Partner Development Managers (24x24). PDMs move on every few years; see game/advisor.ts.
const PDM_ART: Record<string, string[]> = {
  alex: PDM,
  // Priya: long black hair, gold earrings
  priya: [
    '........kkkkkkkk........',
    '......kknnnnnnnnkk......',
    '.....knnnnnnnnnnnnk.....',
    '....knnndnnnnnnnnnnk....',
    '...knnnnnnnSSnnnnnnnk...',
    '...knnnnnSSSSSSnnnnnk...',
    '...knnnSSSSSSSSSSnnnk...',
    '...knnSkkkSSSSkkkSnnk...',
    '...knnSSSSSSSSSSSSnnk...',
    '...knnSwkSSSSSSkwSnnk...',
    '...knnSSSSSSSSSSSSnnk...',
    '...knySSSSShhSSSSSynk...',
    '...knnSSSSSSSSSSSSnnk...',
    '...knnSSSSSSSSSSSSnnk...',
    '...knnSSSXXXXXXSSSnnk...',
    '...knnnSSSSXXSSSSnnnk...',
    '...knnnnkSSSSSSknnnnk...',
    '..knnnnnnkSSSSknnnnnnk..',
    '..knnnnnkuuSSuuknnnnnk..',
    '.knnnnkuuuuuuuuuuknnnnk.',
    '.knnnkuuuuuuuuuuuuknnnk.',
    '.knnkuuuuuuuuuuuuuuknnk.',
    '.kkkuuuuuuuuuuuuuuuukkk.',
    '.kuuuuuuuuuuuuuuuuuuuuk.',
  ],
  // Kwame: short beard, grey suit, green tie
  kwame: [
    '........................',
    '........kkkkkkkk........',
    '......kknnnnnnnnkk......',
    '.....knnnnnnnnnnnnk.....',
    '....knnnnnnnnnnnnnnk....',
    '....knhhhhhhhhhhhhnk....',
    '....khhhhhhhhhhhhhhk....',
    '....khkkkhhhhhhkkkhk....',
    '....khhhhhhhhhhhhhhk....',
    '....khhwkhhhhhhkwhhk....',
    '....khhhhhhhhhhhhhhk....',
    '....khhhhhHHHHhhhhhk....',
    '....khhhhhhhhhhhhhhk....',
    '....knhhhhhhhhhhhhnk....',
    '....knnhhwwwwwwhhnnk....',
    '.....knnnhhhhhhnnnk.....',
    '......knnnnnnnnnnk......',
    '........kkhhhhkk........',
    '.....kkkTwhhhhwTkkk.....',
    '...kkTTTTwwvvwwTTTTkk...',
    '..kTTTTTTtwvvwtTTTTTTk..',
    '..kTTTTTTTtvvtTTTTTTTk..',
    '.kTTTTTTTTTvvTTTTTTTTTk.',
    '.kTTTTTTTTTvvTTTTTTTTTk.',
  ],
  // Mei: bob with a fringe, pearl earrings
  mei: [
    '........kkkkkkkk........',
    '......kknnnnnnnnkk......',
    '.....knnnnnnnnnnnnk.....',
    '....knnnnnnnnnnnnnnk....',
    '...knnnndnnnnnnnnnnnk...',
    '...knnnnnnnnnnnnnnnnk...',
    '...knnnnnnnnnnnnnnnnk...',
    '...knnssssssssssssnnk...',
    '...knnssssssssssssnnk...',
    '...knnswksssssskwsnnk...',
    '...knnssssssssssssnnk...',
    '...knwsssssSSssssswnk...',
    '...knnssssssssssssnnk...',
    '...knnssssssssssssnnk...',
    '...knnsssXXXXXXsssnnk...',
    '...kknnssssssssssnnkk...',
    '......kksssssssskk......',
    '........kksssskk........',
    '......kkXXssssXXkk......',
    '....kkXXXXXssXXXXXkk....',
    '...kXXXXXXXXXXXXXXXXk...',
    '..kXXXXXXXXXXXXXXXXXXk..',
    '.kXXXXXXXXXXXXXXXXXXXXk.',
    '.kXXXXXXXXXXXXXXXXXXXXk.',
  ],
  // Aisha: green hijab
  aisha: [
    '........kkkkkkkk........',
    '......kkDDDDDDDDkk......',
    '.....kDDDmmDDDDDDDk.....',
    '....kDDDmDDDDDDDDDDk....',
    '....kDDDDDDDDDDDDDDk....',
    '...kDDDDSSSSSSSSDDDDk...',
    '...kDDDSSSSSSSSSSDDDk...',
    '...kDDSkkkSSSSkkkSDDk...',
    '...kDDSSSSSSSSSSSSDDk...',
    '...kDDSwkSSSSSSkwSDDk...',
    '...kDDSSSSSSSSSSSSDDk...',
    '...kDDSSSSShhSSSSSDDk...',
    '...kDDSSSSSSSSSSSSDDk...',
    '...kDDSSSSSSSSSSSSDDk...',
    '...kDDSSSXXXXXXSSSDDk...',
    '...kDDDSSSSXXSSSSDDDk...',
    '...kDDDDSSSSSSSSDDDDk...',
    '...kDDDDDDSSSSDDDDDDk...',
    '..kDDDDDDDDDDDDDDDDDDk..',
    '.kDDDmDDDDDDDDDDDDDDDDk.',
    '.kDDDDDDDDDDDDDDDDDDDDk.',
    '.ktDDDDDDDDDDDDDDDDDDtk.',
    'kttDDDDDDDDDDDDDDDDDDttk',
    'ktttDDDDDDDDDDDDDDDDtttk',
  ],
  // Diego: silver hair, glasses, moustache, cardigan
  diego: [
    '........................',
    '........kkkkkkkk........',
    '......kkllllllllkk......',
    '.....klllgllllllllk.....',
    '....kllllSSSSSSllllk....',
    '....kllSSSSSSSSSSllk....',
    '....klSgggSSSSgggSlk....',
    '....kSkkkkkSSkkkkkSk....',
    '....kSkcwckkkkcwckSk....',
    '....kSkckckSSkckckSk....',
    '....kSkkkkkSSkkkkkSk....',
    '....kSSSSSShhSSSSSSk....',
    '....kSSSSSSSSSSSSSSk....',
    '....kSSSSggggggSSSSk....',
    '....kSSSgSxxxxSgSSSk....',
    '.....kSSSSSSSSSSSSk.....',
    '......kkSSSSSSSSkk......',
    '........kkSSSSkk........',
    '.....kkkhwSSSSwhkkk.....',
    '...kkhhhhhwwwwhhhhhkk...',
    '..khhhhhhhhhhhhhhhhhhk..',
    '..khhhhhhhhhhhhhhhhhhk..',
    '.khhhhhhhhhhhhhhhhhhhhk.',
    '.khhhhhhhhhhhhhhhhhhhhk.',
  ],
};

const FLOPPY = [
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '.kNNNNNNkkkkkkkkkkkkkkkkkNNNNNk.',
  '.kNNNNNNkllllllllllllllkNNNNNNk.',
  '.kNNNNNNklllkkkklllllllkNNNNNNk.',
  '.kNNNNNNklllkNNklllllllkNNNNNNk.',
  '.kNNNNNNklllkNNklllllllkNNNNNNk.',
  '.kNNNNNNklllkNNklllllllkNNNNNNk.',
  '.kNNNNNNklllkkkklllllllkNNNNNNk.',
  '.kNNNNNNkllllllllllllllkNNNNNNk.',
  '.kNNNNNNkkkkkkkkkkkkkkkkNNNNNNk.',
  '.kNNNNNNNNNNNNNNNNNNNNNNNNNNNNk.',
  '.kNNNNNNNNNNNNNNNNNNNNNNNNNNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kkNNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kNkNwwwwwwwwwwwwwwwwwwwwwwNNNk.',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
  '................................',
];

const POINTER = [
  'k.........',
  'kk........',
  'kwk.......',
  'kwwk......',
  'kwwwk.....',
  'kwwwwk....',
  'kwwwwwk...',
  'kwwwwwwk..',
  'kwwwwwwwk.',
  'kwwwwkkkkk',
  'kwwkwk....',
  'kwk.kwk...',
  'kk..kwk...',
  'k....kwk..',
  '.....kwk..',
  '......k...',
];

const cache = new Map<string, Sprite>();

export type IconId = keyof typeof ART;

export function icon(id: string): Sprite {
  let s = cache.get(id);
  if (!s) {
    const rows = ART[id] ?? ART.bulb;
    s = makeSprite(rows.map((r) => r.replace(/ /g, '.')));
    cache.set(id, s);
  }
  return s;
}

export const SPR = {
  get pdm(): Sprite {
    return cachedArt('pdm', PDM);
  },
  get disti(): Sprite {
    return cachedArt('disti', DISTI);
  },
  get inbox(): Sprite {
    return cachedArt('inbox', inboxRows());
  },
  get floppy(): Sprite {
    return cachedArt('floppy', FLOPPY);
  },
  get pointer(): Sprite {
    return cachedArt('pointer', POINTER);
  },
};

/**
 * Portrait for whoever is advising you (see game/advisor.ts): 'disti', 'inbox', or 'pdm:<id>'
 * for a Partner Development Manager.
 */
export function advisorSprite(id: string): Sprite {
  if (id === 'disti') return SPR.disti;
  if (id === 'inbox') return SPR.inbox;
  const pdm = id.startsWith('pdm:') ? id.slice(4) : 'alex';
  return cachedArt(`pdm:${pdm}`, PDM_ART[pdm] ?? PDM);
}

function cachedArt(key: string, rows: string[]): Sprite {
  let s = cache.get('@' + key);
  if (!s) {
    s = makeSprite(rows);
    cache.set('@' + key, s);
  }
  return s;
}

/** The four-square Microsoft logo, drawn as pixel art at any size. */
export function msLogo(g: Gfx, x: number, y: number, square: number, gap = 1): void {
  g.rect(x, y, square, square, C.MSRED);
  g.rect(x + square + gap, y, square, square, C.MSGREEN);
  g.rect(x, y + square + gap, square, square, C.MSBLUE);
  g.rect(x + square + gap, y + square + gap, square, square, C.MSYELLOW);
}

/** Small shield badge for a Solutions Partner designation. */
export function designationBadge(g: Gfx, x: number, y: number, colour: number, earned: boolean): void {
  const rows = ['kkkkkkkkkk', 'kcccccccck', 'kcccccccck', 'kcccccccck', 'kcccccccck', '.kcccccck.', '..kcccck..', '...kcck...', '....kk....'];
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      if (ch === 'k') g.pset(x + rx, y + ry, C.BLACK);
      else g.pset(x + rx, y + ry, earned ? colour : C.DGREY);
    }
  }
  if (earned) {
    g.pset(x + 4, y + 2, C.WHITE);
    g.pset(x + 3, y + 3, C.WHITE);
    g.pset(x + 4, y + 3, C.WHITE);
    g.pset(x + 5, y + 3, C.WHITE);
    g.pset(x + 4, y + 4, C.WHITE);
  }
}

/** Procedural company HQ that grows with headcount; windows twinkle. */
export function drawHQ(g: Gfx, x: number, baseY: number, staff: number, t: number, name: string): void {
  const floors = Math.max(1, Math.min(5, Math.ceil(staff / 10)));
  const width = staff >= 60 ? 44 : staff >= 30 ? 36 : 28;
  const fh = 9;
  const top = baseY - floors * fh - 4;
  // building body
  g.rect(x, top, width, baseY - top, C.SLATE);
  g.rect(x, top, 2, baseY - top, C.LSLATE);
  g.rect(x + width - 2, top, 2, baseY - top, C.NAVY);
  g.rect(x - 2, top - 3, width + 4, 3, C.DGREY);
  // roof sign with Microsoft partner colours
  msLogo(g, x + width / 2 - 4, top - 11, 3, 1);
  for (let f = 0; f < floors; f++) {
    const fy = top + 4 + f * fh;
    for (let wx = x + 4; wx < x + width - 6; wx += 6) {
      const seed = (wx * 31 + fy * 17) % 97;
      const lit = (Math.floor(t * 0.5 + seed) % 7) !== 0 && seed % 5 !== 0;
      g.rect(wx, fy, 4, 5, lit ? C.YELLOW : C.DNAVY);
      if (lit) g.pset(wx, fy, C.CREAM);
    }
  }
  // door
  g.rect(x + width / 2 - 3, baseY - 7, 6, 7, C.DBROWN);
  g.pset(x + width / 2 + 1, baseY - 4, C.MSYELLOW);
  // ground
  g.rect(x - 8, baseY, width + 16, 2, C.DGREEN);
  void name;
}
