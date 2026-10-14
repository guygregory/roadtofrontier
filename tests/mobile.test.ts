import { afterEach, describe, expect, it, vi } from 'vitest';
import { devicePortrait } from '../src/mobile';

afterEach(() => vi.unstubAllGlobals());

describe('device orientation independent of keyboard viewport', () => {
  it.each([
    ['portrait-primary', true],
    ['portrait-secondary', true],
    ['landscape-primary', false],
    ['landscape-secondary', false],
  ])('uses %s rather than viewport dimensions', (type, portrait) => {
    vi.stubGlobal('screen', { orientation: { type } });
    vi.stubGlobal('window', { innerWidth: portrait ? 844 : 390, innerHeight: portrait ? 390 : 844 });
    expect(devicePortrait()).toBe(portrait);
  });

  it.each([[0, true], [180, true], [90, false], [-90, false]])('supports legacy iOS angle %s', (angle, portrait) => {
    vi.stubGlobal('screen', {});
    vi.stubGlobal('window', { orientation: angle, innerWidth: 844, innerHeight: 100 });
    expect(devicePortrait()).toBe(portrait);
  });

  it('returns unknown without an orientation API, leaving the typing layout decision to the caller', () => {
    vi.stubGlobal('screen', {});
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 100 });
    expect(devicePortrait()).toBeNull();
  });
});
