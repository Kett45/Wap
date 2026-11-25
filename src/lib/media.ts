// Packed Avatar Format (||| separator), Canvas image compression within Firestore Rules limits, and Web Audio recording

export const AVATAR_SEPARATOR = '|||';
export const MAX_AVATAR_BASE64_CHARS = 350000; // Strictly under 360000 Firestore Rule limit
export const MAX_CHAT_IMAGE_BASE64_CHARS = 440000; // Strictly under 460000 Firestore Rule limit
export const MAX_CHAT_AUDIO_BASE64_CHARS = 95000; // Strictly under 100000 Firestore Rule limit

export function normalizeBase64ImageSrc(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
}

export function stripDataUriPrefix(raw: string): string {
  const idx = raw.indexOf('base64,');
  if (idx !== -1) return raw.slice(idx + 7);
  return raw.trim();
}

export function unpackAvatars(packed?: string | null): string[] {
  if (!packed) return [];
  return packed
    .split(AVATAR_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function packAvatars(rawItems: string[]): string {
  const stripped = rawItems.map(stripDataUriPrefix).filter(Boolean);
  const result: string[] = [];
  let totalLen = 0;
  for (const item of stripped) {
    const added = item.length + (result.length > 0 ? AVATAR_SEPARATOR.length : 0);
    if (totalLen + added <= MAX_AVATAR_BASE64_CHARS) {
      result.push(item);
      totalLen += added;
    }
  }
  return result.join(AVATAR_SEPARATOR);
}

export function getPrimaryAvatarSrc(packed?: string | null): string {
  const items = unpackAvatars(packed);
  if (items.length === 0) return '';
  return normalizeBase64ImageSrc(items[0]);
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildEmailDirectoryKey(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const hash = await sha256Hex(normalized);
  return `em_${hash.slice(0, 40)}`;
}

export interface CompressedImageResult {
  base64Raw: string; // Raw base64 without data: prefix
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  hash: string;
}

export async function compressImageFile(
  file: File,
  options: { maxDim?: number; maxChars?: number } = {}
): Promise<CompressedImageResult> {
  const maxDim = options.maxDim ?? 720;
  const maxChars = options.maxChars ?? 160000;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('ملف الصورة غير صالح'));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تجهيز ضغط الصورة');

  let quality = 0.82;
  let curW = width;
  let curH = height;
  let outDataUrl = '';
  let base64Raw = '';

  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = curW;
    canvas.height = curH;
    ctx.clearRect(0, 0, curW, curH);
    ctx.drawImage(img, 0, 0, curW, curH);
    outDataUrl = canvas.toDataURL('image/jpeg', quality);
    base64Raw = stripDataUriPrefix(outDataUrl);
    if (base64Raw.length <= maxChars) break;
    if (quality > 0.45) {
      quality -= 0.12;
    } else {
      curW = Math.max(120, Math.round(curW * 0.78));
      curH = Math.max(120, Math.round(curH * 0.78));
    }
  }

  if (base64Raw.length > maxChars) {
    throw new Error('حجم الصورة كبير جداً بعد الضغط، اختر صورة أصغر.');
  }

  const hash = (await sha256Hex(base64Raw.slice(0, 4096))).slice(0, 32);
  return {
    base64Raw,
    dataUrl: outDataUrl,
    width: curW,
    height: curH,
    mimeType: 'image/jpeg',
    hash,
  };
}

export function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(stripDataUriPrefix(String(reader.result)));
    reader.onerror = () => reject(new Error('تعذر قراءة التسجيل الصوتي'));
    reader.readAsDataURL(blob);
  });
}
