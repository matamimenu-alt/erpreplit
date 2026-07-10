/**
 * Read a File as base64 (no data: prefix), compressing large images first so
 * mobile camera photos don't balloon the request. PDFs and small files pass
 * through untouched.
 */
export type PreparedFile = { base64: string; mimeType: string; dataUrl: string };

const MAX_EDGE = 2200; // long-edge cap — plenty for OCR legibility
const JPEG_QUALITY = 0.82;

export async function prepareInvoiceFile(file: File): Promise<PreparedFile> {
  const isImage = file.type.startsWith("image/");
  // Non-images (PDF) or already-small images: send as-is.
  if (!isImage || file.size < 900_000) {
    const dataUrl = await readAsDataUrl(file);
    return { base64: stripPrefix(dataUrl), mimeType: file.type, dataUrl };
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  if (scale >= 1) {
    return { base64: stripPrefix(dataUrl), mimeType: file.type, dataUrl };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64: stripPrefix(dataUrl), mimeType: file.type, dataUrl };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const outUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { base64: stripPrefix(outUrl), mimeType: "image/jpeg", dataUrl: outUrl };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function stripPrefix(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}
