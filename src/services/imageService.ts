import sharp from 'sharp';

export interface OptimizeOptions {
  imageCount?: number;
  maxDimension?: number;
  quality?: number;
}

/**
 * Parses base64 data string into buffer and mime type
 */
function parseBase64(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      buffer: Buffer.from(matches[2], 'base64'),
    };
  }

  // Check if raw base64 string without data URI scheme
  if (/^[A-Za-z0-9+/=]+$/.test(dataUrl.slice(0, 100)) && dataUrl.length > 500) {
    try {
      return {
        mimeType: 'image/jpeg',
        buffer: Buffer.from(dataUrl, 'base64'),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Optimizes a single image buffer or base64 string using sharp.
 * Rule based on total image count:
 * - 1 to 2 images: High quality (max 1600px, quality 88)
 * - > 2 images: Reduced quality & size (max 1080px, quality 65)
 */
export async function optimizeImageBase64(
  dataUrlOrBuffer: string | Buffer,
  options: OptimizeOptions = {}
): Promise<string> {
  try {
    let inputBuffer: Buffer;
    let originalMime = 'image/jpeg';

    if (Buffer.isBuffer(dataUrlOrBuffer)) {
      inputBuffer = dataUrlOrBuffer;
    } else {
      const parsed = parseBase64(dataUrlOrBuffer);
      if (!parsed) {
        // If it's an external URL (e.g. https://...), return as-is
        return dataUrlOrBuffer;
      }
      inputBuffer = parsed.buffer;
      originalMime = parsed.mimeType;
    }

    // Skip non-image types (e.g. video)
    if (originalMime.startsWith('video/')) {
      return typeof dataUrlOrBuffer === 'string' ? dataUrlOrBuffer : '';
    }

    const imageCount = options.imageCount ?? 1;

    // Rule:
    // If <= 2 images: High quality (max 1600px, JPEG quality 88)
    // If > 2 images: Reduced quality (max 1080px, JPEG quality 65)
    let maxDim = options.maxDimension;
    let quality = options.quality;

    if (!maxDim) {
      maxDim = imageCount <= 2 ? 1600 : 1080;
    }

    if (!quality) {
      quality = imageCount <= 2 ? 88 : 65;
    }

    const sharpInstance = sharp(inputBuffer);
    const metadata = await sharpInstance.metadata();

    // Auto rotate based on EXIF
    sharpInstance.rotate();

    // Resize proportionally if dimensions exceed maxDim
    if (
      (metadata.width && metadata.width > maxDim) ||
      (metadata.height && metadata.height > maxDim)
    ) {
      sharpInstance.resize({
        width: maxDim,
        height: maxDim,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to webp or jpeg with target quality
    // JPEG has universal compatibility for base64 data URLs in web & mobile
    const outputBuffer = await sharpInstance
      .jpeg({
        quality,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();

    return `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;
  } catch (err) {
    console.warn('[ImageService] Optimization error, returning original:', err);
    return typeof dataUrlOrBuffer === 'string' ? dataUrlOrBuffer : '';
  }
}

/**
 * Optimizes an array of post media items.
 * Applies the 1-2 images vs >2 images rule across all attachments.
 */
export async function optimizePostMedia(
  media: Array<{ type?: string; url: string; caption?: string }> = []
): Promise<Array<{ type: string; url: string; caption?: string }>> {
  if (!Array.isArray(media) || media.length === 0) return [];

  const imageItems = media.filter((m) => !m.type || m.type === 'image');
  const imageCount = imageItems.length;

  const optimizedMedia: Array<{ type: string; url: string; caption?: string }> = [];

  for (const item of media) {
    if (item.type === 'video') {
      optimizedMedia.push({
        type: 'video',
        url: item.url,
        caption: item.caption,
      });
      continue;
    }

    if (item.url && item.url.startsWith('data:image')) {
      const optimizedUrl = await optimizeImageBase64(item.url, { imageCount });
      optimizedMedia.push({
        type: 'image',
        url: optimizedUrl,
        caption: item.caption,
      });
    } else {
      optimizedMedia.push({
        type: item.type || 'image',
        url: item.url,
        caption: item.caption,
      });
    }
  }

  return optimizedMedia;
}

/**
 * Optimizes memory meta photos (then & now)
 */
export async function optimizeMemoryMeta(memoryMeta: any): Promise<any> {
  if (!memoryMeta || typeof memoryMeta !== 'object') return memoryMeta;

  const result = { ...memoryMeta };

  if (result.thenPhotoUrl && result.thenPhotoUrl.startsWith('data:image')) {
    result.thenPhotoUrl = await optimizeImageBase64(result.thenPhotoUrl, { imageCount: 2 });
  }

  if (result.nowPhotoUrl && result.nowPhotoUrl.startsWith('data:image')) {
    result.nowPhotoUrl = await optimizeImageBase64(result.nowPhotoUrl, { imageCount: 2 });
  }

  return result;
}
