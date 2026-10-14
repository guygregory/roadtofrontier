import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_IMAGE_H, CARD_IMAGE_W, CARD_SCALE, CARD_W } from '../src/sharecard';

describe('share card', () => {
  it('exports an exact 1080 x 1350 social portrait', () => {
    expect(CARD_W * CARD_SCALE).toBe(1080);
    expect(CARD_H * CARD_SCALE).toBe(1350);
    expect(CARD_IMAGE_W).toBe(1080);
    expect(CARD_IMAGE_H).toBe(1350);
  });
});
