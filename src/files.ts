/** Browser file helpers: downloads and a file picker, all static-hosting friendly (no server needed). */

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Open the file picker and read the chosen file as text. Resolves null if the player cancels.
 * Must be called soon after a click or key press (browsers require a recent user gesture).
 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = (v: { name: string; text: string } | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return finish(null);
      f.text().then(
        (text) => finish({ name: f.name, text }),
        () => finish(null),
      );
    });
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}
