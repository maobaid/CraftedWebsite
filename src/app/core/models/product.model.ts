// Product model matches backend DTO exactly
export interface ProductVariant {
  id: string;
  color: string | null;
  size: string | null;
  price_override: number | string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
}

/** Payload for create/update product (no server ids on nested variants). */
export interface ProductVariantInput {
  color?: string | null;
  size?: string | null;
  price_override?: number | null;
  stock_quantity: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export type ProductCustomizationKind = 'TEXT' | 'IMAGE';
export type ProductTextMode = 'SINGLE_WORD' | 'SENTENCE';

/** Returned with product list/get/create/update (normalized client-side). */
export interface ProductCustomization {
  id: string;
  label: string;
  sort_order: number;
  kind: ProductCustomizationKind;
  required: boolean;
  max_chars: number | null;
  text_mode: ProductTextMode | null;
}

/** Row for create/update product (optional id for existing customization). */
export interface ProductCustomizationInputRow {
  id?: string;
  label: string;
  kind: ProductCustomizationKind;
  required?: boolean;
  sort_order?: number;
  max_chars?: number | null;
  text_mode?: ProductTextMode | null;
}

/** Per checkout line — TEXT lines send text_value only; IMAGE send image_url only. */
export interface CartLineCustomization {
  product_customization_id: string;
  text_value?: string;
  image_url?: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  colors: string[];
  sizes: string[];
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
  is_low_stock: boolean;
  variants: ProductVariant[];
  customizations?: ProductCustomization[];
}

/** GET /stores/:storeId/products/best-sellers row (product fields + sales count). */
export interface BestSellerProduct extends Product {
  units_sold: number;
}

export const DEFAULT_PRODUCT_IMAGE =
  '/B1DFDACD-BCB9-489E-85BF-0F4E7A263DF5.JPG';

/** Snapshot from order API for past orders / receipts. */
export interface OrderCustomizationValueSnapshot {
  product_customization_id?: string;
  label_snapshot?: string;
  kind?: string;
  text_mode?: string | null;
  text_value?: string | null;
  image_url?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  /** Resolved variant when product uses variant stock; sent at checkout as product_variant_id. */
  product_variant_id?: string;
  selectedColorHex?: string;
  selectedSize?: string;
  /** Customer selections while cart is pending checkout. */
  customizations?: CartLineCustomization[];
  /** Populated when order line is loaded from API. */
  customization_values?: OrderCustomizationValueSnapshot[];
}

export function normalizeColorKey(c: string | null | undefined): string {
  return (c ?? '').trim().toLowerCase();
}

export function sortedProductCustomizations(
  product: Pick<Product, 'customizations'> | undefined | null,
): ProductCustomization[] {
  const raw = product?.customizations;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...raw].sort((a, b) => {
    const oa =
      typeof a.sort_order === 'number' && Number.isFinite(a.sort_order)
        ? a.sort_order
        : 0;
    const ob =
      typeof b.sort_order === 'number' && Number.isFinite(b.sort_order)
        ? b.sort_order
        : 0;
    return oa - ob || a.label.localeCompare(b.label);
  });
}

/** Valid public image URL for order payload (http or https). */
export function isValidHttpProductImageUrl(u: string): boolean {
  const s = u.trim();
  if (!s) return false;
  try {
    const x = new URL(s);
    return (
      (x.protocol === 'https:' || x.protocol === 'http:') && !!x.hostname
    );
  } catch {
    return false;
  }
}

export function sanitizeSingleWordText(value: string): string {
  return value.replace(/\s+/g, '');
}

/** Label for a cart/checkout line from `product.customizations` by id. */
export function customizationOptionLabel(
  product: Pick<Product, 'customizations'> | undefined,
  productCustomizationId: string | undefined | null,
): string {
  const id = (productCustomizationId ?? '').trim();
  if (!id) return 'تخصيص';
  const c = product?.customizations?.find((x) => x.id === id);
  return (c?.label ?? '').trim() || 'تخصيص';
}

export function parsePriceOverride(
  v: number | string | null | undefined,
): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** API may send product.price as a string; normalize for display and cart math. */
export function parseNonNegativeProductPrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.trim());
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

export function productHasVariants(p: Pick<Product, 'variants'>): boolean {
  return Array.isArray(p.variants) && p.variants.length > 0;
}

export function isVariantSelectable(v: ProductVariant): boolean {
  return v.is_active !== false && v.stock_quantity > 0;
}

/** Unit price before coupon-level discounts: variant override or product base. */
export function getCartUnitBasePrice(
  product: Product,
  productVariantId?: string,
): number {
  if (productVariantId && product.variants?.length) {
    const variant = product.variants.find((x) => x.id === productVariantId);
    if (variant && variant.is_active !== false) {
      const override = parsePriceOverride(variant.price_override);
      if (override != null) return Math.max(0, override);
    }
  }
  return parseNonNegativeProductPrice(product.price);
}

/**
 * Match variant when color/size selections align with variant fields.
 * Empty selection skips that dimension only if variant has no value for it.
 */
export function findMatchingVariant(
  product: Product,
  colorHex: string,
  size: string,
): ProductVariant | null {
  if (!product.variants?.length) return null;
  const c = normalizeColorKey(colorHex);
  const s = size.trim();
  for (const v of product.variants) {
    if (v.is_active === false) continue;
    const vc = normalizeColorKey(v.color);
    const vs = (v.size ?? '').trim();
    if (c && vc !== c) continue;
    if (s && vs !== s) continue;
    if (!c && v.color) continue;
    if (!s && v.size) continue;
    return v;
  }
  return null;
}

/** Distinct colors from active variants (any stock) — storefront pickers; OOS handled via variantColorSelectable. */
export function uniqueVariantColors(product: Product): string[] {
  if (!product.variants?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of product.variants) {
    if (v.is_active === false || !v.color) continue;
    const key = normalizeColorKey(v.color);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.color.trim());
  }
  return out;
}

/**
 * Distinct sizes for optional selected color (hex); when empty, sizes from
 * active variants that do not require a color match (size-only dimension).
 */
export function uniqueVariantSizes(
  product: Product,
  selectedColorHex: string,
): string[] {
  if (!product.variants?.length) return [];
  const c = normalizeColorKey(selectedColorHex);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of product.variants) {
    if (v.is_active === false || !v.size?.trim()) continue;
    const vc = normalizeColorKey(v.color);
    if (c && vc !== c) continue;
    if (!c && v.color) continue;
    const sz = v.size.trim();
    if (seen.has(sz)) continue;
    seen.add(sz);
    out.push(sz);
  }
  return out;
}

export function variantColorSelectable(
  product: Product,
  hex: string,
  selectedSize: string,
): boolean {
  if (!product.variants?.length) return true;
  return product.variants.some(
    (v) =>
      isVariantSelectable(v) &&
      normalizeColorKey(v.color) === normalizeColorKey(hex) &&
      (!selectedSize.trim() ||
        (v.size ?? '').trim() === selectedSize.trim()),
  );
}

export function variantSizeSelectable(
  product: Product,
  size: string,
  selectedColorHex: string,
): boolean {
  if (!product.variants?.length) return true;
  const c = normalizeColorKey(selectedColorHex);
  const sz = size.trim();
  return product.variants.some((v) => {
    if (!isVariantSelectable(v)) return false;
    if ((v.size ?? '').trim() !== sz) return false;
    const vc = normalizeColorKey(v.color);
    if (c) return vc === c;
    return !v.color;
  });
}

/** Colors to show on card/PDP: variants drive when present, else product.colors */
export function displayColors(product: Product): string[] {
  if (productHasVariants(product)) {
    const u = uniqueVariantColors(product);
    if (u.length) return u;
  }
  return product.colors ?? [];
}

/** Sizes to show: filtered by selected color when using variants */
export function displaySizes(
  product: Product,
  selectedColorHex: string,
): string[] {
  if (productHasVariants(product)) {
    const fromVariants = uniqueVariantSizes(product, selectedColorHex);
    if (fromVariants.length) return fromVariants;
    return product.sizes ?? [];
  }
  return product.sizes ?? [];
}

/** Price to show for a product (no discount; discounts come from product_discount table). */
export function getProductPrice(product: Product): number {
  return parseNonNegativeProductPrice(product?.price);
}

// ─── Product discount (separate table: product_discount) ─────────────────────

export type AppliesTo = 'ALL_PRODUCTS' | 'CATEGORY' | 'SPECIFIC_PRODUCTS';

export interface ProductDiscount {
  id?: string;
  name: string;
  percentage: number;
  applies_to: AppliesTo;
  category_id?: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  product_ids: string[];
}

/** Result of applying discounts to a product (for display) */
export interface ProductPriceResult {
  price: number;
  originalPrice: number;
  discount: ProductDiscount | null;
}
