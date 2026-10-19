/**
 * Utility to optimize and resize images on client-side before uploading.
 * Preserves 100% of the image content (no cropping, strict aspect ratio preservation)
 * while resizing large dimensions (e.g. 4000px down to max 1200px) and compressing,
 * ensuring fast upload, small file size, and crisp display.
 */
export async function resizeImageBeforeUpload(
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<File> {
  // Only process standard raster images, preserve SVGs and GIFs
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // If dimensions are already within limit and file is small (< 350KB), no need to compress
      if (width <= maxDimension && height <= maxDimension && file.size <= 350 * 1024) {
        resolve(file);
        return;
      }

      // Calculate new dimensions preserving exact aspect ratio (no cropping)
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const mimeType = file.type === 'image/png' && file.size < 500 * 1024 ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const extension = mimeType === 'image/png' ? '.png' : '.jpg';
          const newName = file.name.replace(/\.[^.]+$/, '') + extension;
          const resized = new File([blob], newName, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(resized);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
