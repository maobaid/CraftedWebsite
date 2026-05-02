/** Must match server limit for customization image uploads. */
export const CUSTOMIZATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const CUSTOMIZATION_IMAGE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXTENSION_ALLOWLIST = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function fileExtensionLower(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  return name.slice(i + 1).trim().toLowerCase();
}

/**
 * Client-side gate before POST. Server still enforces magic bytes and limits.
 * @returns Arabic error message, or null if OK to attempt upload.
 */
export function validateCustomizationImageFileBeforeUpload(file: File): string | null {
  if (file.size > CUSTOMIZATION_IMAGE_MAX_BYTES) {
    return 'حجم الصورة يتجاوز ٥ م.ب كحدّ أقصى.';
  }

  const mt = file.type.trim().toLowerCase();
  if (mt) {
    if (!CUSTOMIZATION_IMAGE_ALLOWED_MIME_TYPES.has(mt)) {
      return 'يُسمح فقط بصور JPEG أو PNG أو WebP أو GIF.';
    }
    return null;
  }

  const ext = fileExtensionLower(file.name);
  if (!EXTENSION_ALLOWLIST.has(ext)) {
    return 'امتداد الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو GIF.';
  }
  return null;
}
