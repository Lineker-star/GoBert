export type CompressedImage = { dataUrl: string; size: number; width: number; height: number };

// Compress an image file to a JPEG data URL under maxBytes (default 200 KB).
export async function compressImage(
  file: File,
  maxBytes = 200 * 1024,
  maxDim = 1280,
): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.8;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  // progressively reduce quality then dimensions until under the limit
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  while (dataUrl.length * 0.75 > maxBytes && width > 320) {
    width = Math.round(width * 0.7);
    height = Math.round(height * 0.7);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(bitmap, 0, 0, width, height);
    dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  }

  const size = Math.round((dataUrl.length * 3) / 4); // base64 -> bytes
  return { dataUrl, size, width, height };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}