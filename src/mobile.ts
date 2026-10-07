/** Touch-first device (phone/tablet): no hover and a coarse pointer. Desktop keeps the classic layout. */
export const isMobile =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** True when launched from the home screen as an installed web app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (typeof window.matchMedia === 'function' &&
      (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Platform-appropriate wording for the "add to home screen" hint. */
export function homeScreenHint(): string {
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios ? 'TAP SHARE > ADD TO HOME SCREEN TO INSTALL' : 'MENU > ADD TO HOME SCREEN TO INSTALL';
}

/** Best effort: go fullscreen and lock to landscape (only some browsers allow it). */
export function lockLandscape(): void {
  const el = document.documentElement;
  const lock = () => {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    void o?.lock?.('landscape').catch(() => undefined);
  };
  if (!document.fullscreenElement && el.requestFullscreen && !isStandalone()) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock);
  } else {
    lock();
  }
}
