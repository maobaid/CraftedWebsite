import { Component, signal, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { OtpService } from '../../core/services/otp.service';
import { DeliverySettingsService } from '../../core/services/delivery-settings.service';
import { DiscountService } from '../../core/services/discount.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { CartItem } from '../../core/models/product.model';
import { CustomerInfo, DeliverySlot } from '../../core/models/order.model';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule, RouterLink, HeroIconComponent],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  step = signal(1);
  phoneVerified = signal(false);
  otpSent = signal(false);
  otpLoading = signal(false);
  verifyLoading = signal(false);
  submitLoading = signal(false);
  otpError = signal('');
  defaultDeliveryMessage = '';

  private fb = inject(FormBuilder);
  phoneForm = this.fb.group({
    // Kuwaiti mobile: optional +965 or 965, optional leading 0, then 8 digits starting with 5, 6, or 9
    phone: [
      '',
      [
        Validators.required,
        Validators.pattern(/^\s*(?:\+?965)?[\s-]*0?[569]\d{7}\s*$/),
      ],
    ],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  customerForm = this.fb.group({
    fullName: ['', Validators.required],
    email: [''],
    address: [''],
  });

  deliveryForm = this.fb.group({
    scheduleDelivery: [false],
    date: [''],
    time: [''],
  });

  private orderService = inject(OrderService);
  private otpService = inject(OtpService);
  private deliverySettings = inject(DeliverySettingsService);
  private discountService = inject(DiscountService);
  private router = inject(Router);
  cart = inject(CartService);

  constructor() {
    this.defaultDeliveryMessage = this.deliverySettings.getDefaultMessage();
  }

  cartItems = computed(() => this.cart.cart());
  subtotal = computed(() => this.cart.subtotal());
  discountApplied = computed(() => this.discountService.getAppliedDiscountAmount(this.subtotal()));
  total = computed(() => Math.max(0, this.subtotal() - this.discountApplied()));
  canProceedFromStep1 = computed(() => this.phoneVerified());

  sendOtp(): void {
    const phone = this.phoneForm.get('phone')?.value?.trim();
    if (!phone) return;
    this.otpError.set('');
    this.otpLoading.set(true);
    this.otpService.sendOtp(phone).then((res) => {
      this.otpLoading.set(false);
      if (res.success) {
        this.otpSent.set(true);
      } else {
        this.otpError.set(res.message);
      }
    });
  }

  verifyOtp(): void {
    const phone = this.phoneForm.get('phone')?.value?.trim();
    const otp = this.phoneForm.get('otp')?.value?.trim();
    if (!phone || !otp) return;
    this.otpError.set('');
    this.verifyLoading.set(true);
    this.otpService.verifyOtp(phone, otp).then((res) => {
      this.verifyLoading.set(false);
      if (res.success) {
        this.phoneVerified.set(true);
        // Clear any previous error
        this.otpError.set('');
        const existing = this.orderService.getCustomerByPhone(phone.replace(/\D/g, ''));
        if (existing) {
          this.customerForm.patchValue({
            fullName: existing.fullName,
            email: existing.email ?? '',
            address: existing.address ?? '',
          });
        }
      } else {
        this.otpError.set(res.message);
      }
    });
  }

  nextStep(): void {
    if (this.step() === 1 && !this.phoneVerified()) return;
    if (this.step() === 2) {
      const firstOrder = !this.orderService.getCustomerByPhone(
        this.phoneForm.get('phone')?.value?.replace(/\D/g, '') ?? ''
      )?.address;
      if (firstOrder && !this.customerForm.get('address')?.value?.trim()) {
        this.customerForm.get('address')?.setErrors({ required: true });
        return;
      }
    }
    this.step.update((s) => Math.min(4, s + 1));
  }

  prevStep(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  getDeliveryMessage(): string {
    const delivery = this.deliveryForm.value;
    if (delivery.scheduleDelivery && delivery.date) {
      return delivery.time
        ? `موعد التوصيل: ${delivery.date} - ${delivery.time}`
        : `موعد التوصيل: ${delivery.date}`;
    }
    return this.defaultDeliveryMessage;
  }

  private productDiscountService = inject(ProductDiscountService);

  getPriceInfo(item: CartItem) {
    this.productDiscountService.discounts();
    return this.productDiscountService.getEffectivePrice(item.product);
  }

  submitOrder(): void {
    const phone = this.phoneForm.get('phone')?.value?.trim() ?? '';
    const customer: CustomerInfo = {
      phone,
      fullName: this.customerForm.get('fullName')?.value?.trim() ?? '',
      email: this.customerForm.get('email')?.value?.trim() || undefined,
      address: this.customerForm.get('address')?.value?.trim() || undefined,
    };

    const delivery = this.deliveryForm.value;
    let deliverySlot: DeliverySlot | undefined;
    if (delivery.scheduleDelivery && delivery.date) {
      deliverySlot = {
        date: delivery.date,
        time: delivery.time || undefined,
        scheduled: true,
      };
    }

    const order = {
      customer,
      items: this.cartItems(),
      subtotal: this.subtotal(),
      total: this.total(),
      status: 'pending' as const,
      deliverySlot,
      deliveryMessage: this.getDeliveryMessage(),
      discountCode: this.discountService.appliedCode() || undefined,
      discountAmount: this.discountApplied() || undefined,
      paymentStatus: 'pending' as const,
    };

    this.submitLoading.set(true);
    const created = this.orderService.createOrder(order);
    this.cart.clear();
    this.discountService.clearAppliedCoupon();
    this.submitLoading.set(false);
    this.router.navigate(['/order-success', created.id]);
  }
}
