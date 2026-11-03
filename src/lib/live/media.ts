// Image helpers for uploads: shrink a photo in the browser before it leaves the phone.

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, max: number): HTMLCanvasElement {
  const s = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.width || 1) * s));
  c.height = Math.max(1, Math.round((img.height || 1) * s));
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** A JPEG no larger than `max` px on its longest side. */
export async function resizeToBlob(file: Blob, max = 900, quality = 0.84): Promise<Blob> {
  const c = draw(await loadImage(file), max);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality));
}

/** Base64 (no data: prefix) of a resized JPEG, for the biodata reader. */
export async function toJpegBase64(file: Blob, max = 1600): Promise<string> {
  const c = draw(await loadImage(file), max);
  return c.toDataURL('image/jpeg', 0.86).split(',')[1] ?? '';
}

/** Turns a data URL back into a Blob (for photos picked before sign-in data was ready). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(body ?? '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
