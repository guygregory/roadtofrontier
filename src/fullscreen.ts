export function toggleFullscreen(): void {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    void el.requestFullscreen?.().catch(() => undefined);
  } else {
    void document.exitFullscreen?.().catch(() => undefined);
  }
}
