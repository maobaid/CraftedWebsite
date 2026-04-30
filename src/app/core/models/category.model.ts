/** Matches backend CreateCategoryDto / Category response */
export interface Category {
  id?: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  products_count?: number;
}

/** Slug pattern: lowercase letters, numbers, hyphens only (e.g. my-category-1) */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || '';
}
