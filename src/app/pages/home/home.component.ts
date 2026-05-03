import { Component, OnInit, computed, inject } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AppliesTo, ProductDiscount } from '../../core/models/product.model';
import { Coupon } from '../../core/models/discount.model';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { CouponService } from '../../core/services/coupon.service';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { BestSellerProduct } from '../../core/models/product.model';

/** Number of products on the home grid from the current storefront list slice. */
const HOME_PRODUCT_SLICE = 12;

/** Best sellers carousel length (API max 50). */
const HOME_BEST_SELLERS_LIMIT = 10;

export type HomeOfferCard =
  | { kind: 'discount'; discount: ProductDiscount }
  | { kind: 'coupon'; coupon: Coupon };

export function hueFromOfferSeed(seed: string): number {
  const s = seed || '0';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return Math.abs(h) % 360;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, NgStyle, NgClass],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly productSliceLimit = HOME_PRODUCT_SLICE;

  private route = inject(ActivatedRoute);

  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  private discountService = inject(ProductDiscountService);
  private couponService = inject(CouponService);

  /** Selected category slug from `?category=`. */
  readonly selectedCategorySlug = toSignal(
    this.route.queryParamMap.pipe(
      map((pm) => {
        const c = pm.get('category');
        return typeof c === 'string' ? c.trim() || null : null;
      }),
    ),
    { initialValue: null as string | null },
  );

  storefrontCategories = computed(() =>
    this.categoryService.categories().filter((c) => c.is_active && c.id && c.slug),
  );

  private selectedCategoryId = computed(() => {
    const slug = this.selectedCategorySlug();
    if (!slug) return null;
    const cat = this.storefrontCategories().find((x) => x.slug === slug);
    return cat?.id ?? null;
  });

  filteredProductGrid = computed(() => {
    const all = this.productService.products();
    const catId = this.selectedCategoryId();
    const list =
      catId != null ? all.filter((p) => p.category_id === catId) : all;
    return list.slice(0, HOME_PRODUCT_SLICE);
  });

  hasCategoryFilter = computed(() => this.selectedCategoryId() != null);

  /** Active products only; order left as returned by the API. */
  bestSellersForHome = computed(() =>
    this.productService.bestSellers().filter((p) => p.is_active),
  );

  homeOffers = computed((): HomeOfferCard[] => {
    this.discountService.discounts();
    this.couponService.coupons();
    const now = Date.now();

    const merged: { end: number; card: HomeOfferCard }[] = [];

    for (const d of this.discountService.discounts()) {
      if (d.is_active === false) continue;
      const start = new Date(d.start_date).getTime();
      const end = new Date(d.end_date).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (now < start || now > end) continue;
      merged.push({
        end,
        card: { kind: 'discount', discount: d },
      });
    }

    for (const c of this.couponService.coupons()) {
      if (!c.is_active) continue;
      const exp = new Date(c.expires_at).getTime();
      if (!Number.isFinite(exp) || exp <= now) continue;
      merged.push({
        end: exp,
        card: { kind: 'coupon', coupon: c },
      });
    }

    merged.sort((a, b) => a.end - b.end);
    return merged.map((m) => m.card);
  });

  offerCardBackground(seed: string): Record<string, string> {
    const h = hueFromOfferSeed(seed);
    const h2 = (h + 42) % 360;
    return {
      background: `linear-gradient(135deg, hsl(${h} 40% 91%) 0%, hsl(${h2} 30% 96%) 100%)`,
    };
  }

  offerSeed(card: HomeOfferCard): string {
    return card.kind === 'discount'
      ? card.discount.id ??
          card.discount.name ??
          `d-${card.discount.percentage}`
      : card.coupon.code;
  }

  discountScopeLabel(at: AppliesTo): string {
    switch (at) {
      case 'ALL_PRODUCTS':
        return 'جميع المنتجات';
      case 'CATEGORY':
        return 'تصنيف محدد';
      case 'SPECIFIC_PRODUCTS':
        return 'منتجات محددة';
      default:
        return 'عرض متجر';
    }
  }

  formatOfferEnd(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('ar-KW', { dateStyle: 'medium' });
    } catch {
      return iso;
    }
  }

  /** Large numeral for the offer card side rail (discount %). */
  discountSideNumber(d: ProductDiscount): string {
    const n = Math.round(Number(d.percentage));
    return String(Math.max(0, Math.min(100, n)));
  }

  /** Large numeral for coupon rail: % or fixed amount. */
  couponSideNumber(c: Coupon): string {
    if (c.type === 'PERCENTAGE') {
      const n = Math.round(Number(c.value));
      return String(Math.max(0, Math.min(100, n)));
    }
    const v = Number(c.value);
    return Number.isFinite(v) && !Number.isInteger(v) ? v.toFixed(2) : String(v);
  }

  couponSideIsPercentage(c: Coupon): boolean {
    return c.type === 'PERCENTAGE';
  }

  couponBenefitLines(coupon: Coupon): string {
    const min =
      coupon.minimum_order_amount != null && coupon.minimum_order_amount > 0
        ? ` · حد أدنى للطلب: ${coupon.minimum_order_amount} د.ك`
        : '';
    const val =
      coupon.type === 'PERCENTAGE'
        ? `خصم ${coupon.value}%`
        : `خصم ${coupon.value} د.ك`;
    return val + min;
  }

  copyCouponCode(code: string): void {
    if (!code.trim()) return;
    void navigator.clipboard?.writeText(code.trim());
  }

  ngOnInit(): void {
    this.productService.refreshBestSellers({ limit: HOME_BEST_SELLERS_LIMIT });
  }

  /** Caption under product cards for storefront best sellers. */
  bestSellerCaption(p: BestSellerProduct): string {
    const windowDays = this.productService.bestSellersWindowDays();
    const n = p.units_sold;
    const fmt = new Intl.NumberFormat('ar-KW').format(n);
    if (windowDays !== null) {
      return `${fmt} مبيعاً خلال آخر ${windowDays} يوماً`;
    }
    return `${fmt} مبيعاً`;
  }
}
