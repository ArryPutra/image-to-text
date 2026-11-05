import type { ImageDimensions, ProcessedImage } from '../types';

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Format bytes to readable string (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Modern scheduler.yield helper to yield to main thread during loops
 */
export async function yieldToMain(): Promise<void> {
  if (typeof window !== 'undefined' && 'scheduler' in window && 'yield' in (window as any).scheduler) {
    return await (window as any).scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Validates file type and size
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type || 'unknown'}). Please provide a PNG, JPG, or WEBP image.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds the 15 MB size limit (${formatBytes(file.size)}). Please choose a smaller image.`,
    };
  }

  return { valid: true };
}

/**
 * Loads an image to verify integrity and retrieve dimensions
 */
export function inspectImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return reject(new Error(validation.error));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const dimensions: ImageDimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };

      if (dimensions.width === 0 || dimensions.height === 0) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('Image has invalid zero dimensions.'));
      }

      resolve({
        file,
        name: file.name || 'clipboard-screenshot.png',
        size: file.size,
        formattedSize: formatBytes(file.size),
        dimensions,
        previewUrl: objectUrl,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read this image. The file may be corrupted or in an unrecognized format.'));
    };

    img.src = objectUrl;
  });
}

export interface PreparedVariants {
  primary: Blob | File;
  upscaled: Blob | null;
  scaleFactor: number;
  width: number;
  height: number;
  cropCandidateArea: (bbox: { x0: number; y0: number; x1: number; y1: number }, pad?: number) => Promise<Blob | null>;
}

/**
 * Prepares image variants for multi-pass OCR:
 * 1. Primary image (validated, memory-capped if > 3600px).
 * 2. High-resolution upscaled variant for small images/logos (e.g. 324x244 -> 648x488).
 * 3. Crop candidate area helper for Pass 3 (PSM 7 targeted line recognition).
 */
export async function prepareImageVariants(
  file: File | Blob,
  options?: { enhanceContrast?: boolean }
): Promise<PreparedVariants> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      try {
        const origWidth = img.naturalWidth;
        const origHeight = img.naturalHeight;

        // Base canvas
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = origWidth;
        baseCanvas.height = origHeight;
        const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });

        if (!baseCtx) {
          URL.revokeObjectURL(objectUrl);
          return resolve({
            primary: file,
            upscaled: null,
            scaleFactor: 1,
            width: origWidth,
            height: origHeight,
            cropCandidateArea: async () => null,
          });
        }

        // Fill white background (crucial for transparent PNG logos like UT logo!)
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(0, 0, origWidth, origHeight);
        baseCtx.drawImage(img, 0, 0);

        // Optional contrast boost
        if (options?.enhanceContrast) {
          const imgData = baseCtx.getImageData(0, 0, origWidth, origHeight);
          const data = imgData.data;
          let minLum = 255;
          let maxLum = 0;

          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }

          const range = maxLum - minLum;
          if (range > 10 && range < 220) {
            const factor = 255 / range;
            for (let i = 0; i < data.length; i += 4) {
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              const stretched = Math.min(255, Math.max(0, (lum - minLum) * factor));
              data[i] = stretched;
              data[i + 1] = stretched;
              data[i + 2] = stretched;
              if (i % 250000 === 0) await yieldToMain();
            }
            baseCtx.putImageData(imgData, 0, 0);
          }
        }

        const primaryBlob: Blob = await new Promise((r) => baseCanvas.toBlob((b) => r(b || file), 'image/png'));

        // Upscale variant if image is small (< 1000px width or < 750px height)
        let upscaledBlob: Blob | null = null;
        let scaleFactor = 1;

        if (origWidth < 1000 || origHeight < 750) {
          scaleFactor = Math.min(2.5, Math.max(1.8, 1200 / Math.max(origWidth, origHeight)));
          const upCanvas = document.createElement('canvas');
          upCanvas.width = Math.round(origWidth * scaleFactor);
          upCanvas.height = Math.round(origHeight * scaleFactor);
          const upCtx = upCanvas.getContext('2d');
          if (upCtx) {
            upCtx.imageSmoothingEnabled = true;
            upCtx.imageSmoothingQuality = 'high';
            upCtx.fillStyle = '#ffffff';
            upCtx.fillRect(0, 0, upCanvas.width, upCanvas.height);
            upCtx.drawImage(baseCanvas, 0, 0, upCanvas.width, upCanvas.height);
            upscaledBlob = await new Promise((r) => upCanvas.toBlob(r, 'image/png'));
          }
        }

        // Helper to crop candidate line for Pass 3 (PSM 7)
        const cropCandidateArea = async (
          bbox: { x0: number; y0: number; x1: number; y1: number },
          pad = 8
        ): Promise<Blob | null> => {
          try {
            const x = Math.max(0, bbox.x0 - pad);
            const y = Math.max(0, bbox.y0 - pad);
            const w = Math.min(origWidth - x, (bbox.x1 - bbox.x0) + pad * 2);
            const h = Math.min(origHeight - y, (bbox.y1 - bbox.y0) + pad * 2);

            if (w <= 0 || h <= 0) return null;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = w;
            cropCanvas.height = h;
            const cCtx = cropCanvas.getContext('2d');
            if (!cCtx) return null;

            cCtx.fillStyle = '#ffffff';
            cCtx.fillRect(0, 0, w, h);
            cCtx.drawImage(baseCanvas, x, y, w, h, 0, 0, w, h);

            return await new Promise((r) => cropCanvas.toBlob(r, 'image/png'));
          } catch {
            return null;
          }
        };

        URL.revokeObjectURL(objectUrl);
        resolve({
          primary: primaryBlob,
          upscaled: upscaledBlob,
          scaleFactor,
          width: origWidth,
          height: origHeight,
          cropCandidateArea,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({
          primary: file,
          upscaled: null,
          scaleFactor: 1,
          width: 0,
          height: 0,
          cropCandidateArea: async () => null,
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        primary: file,
        upscaled: null,
        scaleFactor: 1,
        width: 0,
        height: 0,
        cropCandidateArea: async () => null,
      });
    };

    img.src = objectUrl;
  });
}
