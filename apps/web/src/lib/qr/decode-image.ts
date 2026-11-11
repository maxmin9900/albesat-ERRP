/** Decode QR payload from PNG/JPEG/WebP using jsQR + html5-qrcode fallbacks. */

export const QR_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/*";

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image file"));
    };
    img.src = url;
  });
}

async function decodeWithJsQr(file: File): Promise<string | null> {
  const jsQR = (await import("jsqr")).default;
  const img = await loadImageFromFile(file);
  const scales = [1, 1.5, 2, 3];

  for (const scale of scales) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    if (result?.data?.trim()) return result.data.trim();
  }
  return null;
}

async function decodeWithHtml5Qrcode(file: File): Promise<string | null> {
  const regionId = `qr-decode-${Date.now()}`;
  const host = document.createElement("div");
  host.id = regionId;
  host.style.position = "fixed";
  host.style.left = "-9999px";
  host.style.top = "0";
  host.style.width = "512px";
  host.style.height = "512px";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const { Html5Qrcode } = await import("html5-qrcode");
  const scanner = new Html5Qrcode(regionId);

  try {
    const decoded = await scanner.scanFile(file, false);
    return decoded?.trim() || null;
  } catch {
    return null;
  } finally {
    try {
      scanner.clear();
    } catch {
      /* already cleared */
    }
    host.remove();
  }
}

/** Suggest code from filename when OCR/decode fails (e.g. QC-2026-ABC.png). */
export function suggestCodeFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  if (base.length >= 3) return base;
  return null;
}

export async function decodeQrFromImageFile(file: File): Promise<string> {
  const fromJsQr = await decodeWithJsQr(file);
  if (fromJsQr) return fromJsQr;

  const fromHtml5 = await decodeWithHtml5Qrcode(file);
  if (fromHtml5) return fromHtml5;

  throw new Error("Could not read QR from image");
}
