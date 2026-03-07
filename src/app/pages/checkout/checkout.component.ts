import { Component, signal, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { StoreCustomerService } from '../../core/services/store-customer.service';
import { OtpService } from '../../core/services/otp.service';
import { DeliverySettingsService } from '../../core/services/delivery-settings.service';
import { DiscountService } from '../../core/services/discount.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { CartItem } from '../../core/models/product.model';
import {
  CreateOrderDto,
  CreateOrderItemDto,
} from '../../core/models/order.model';
import { StoreCustomerResponse } from '../../core/models/customer.model';
import {
  Address,
  CreateAddressDto,
  formatAddressLine,
} from '../../core/models/address.model';
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

  existingCustomer = signal<StoreCustomerResponse | null>(null);
  addresses = signal<Address[]>([]);
  selectedAddressId = signal<string | null>(null);
  useNewAddress = signal(false);
  loadAddressesError = signal('');

  private fb = inject(FormBuilder);
  phoneForm = this.fb.group({
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
  });

  addressForm = this.fb.group({
    label: ['Home', [Validators.required, Validators.maxLength(100)]],
    country: ['KW', [Validators.required, Validators.maxLength(100)]],
    city: ['Kuwait City', [Validators.required, Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.maxLength(100)]],
    block: ['', [Validators.required, Validators.maxLength(50)]],
    street: ['', [Validators.required, Validators.maxLength(255)]],
    avenue: [''],
    building_number: ['', [Validators.required, Validators.maxLength(20)]],
    apartment_number: [''],
    is_default: [true],
  });

  deliveryForm = this.fb.group({
    scheduleDelivery: [false],
    date: [''],
    time: [''],
  });

  private orderService = inject(OrderService);
  private storeCustomer = inject(StoreCustomerService);
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
  discountApplied = computed(() =>
    this.discountService.getAppliedDiscountAmount(this.subtotal()),
  );
  total = computed(() => Math.max(0, this.subtotal() - this.discountApplied()));
  canProceedFromStep1 = computed(() => this.phoneVerified());

  formatAddressLine = formatAddressLine;

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
        this.otpError.set('');
        const normalizedPhone = phone.replace(/\D/g, '');
        this.storeCustomer
          .getCustomerByPhone(normalizedPhone)
          .subscribe((customer) => {
            this.existingCustomer.set(customer ?? null);
            if (customer) {
              this.customerForm.patchValue({
                fullName: customer.full_name ?? '',
                email: customer.email ?? '',
              });
              this.storeCustomer
                .getAddresses(customer.id)
                .subscribe((addrs) => {
                  this.addresses.set(addrs);
                  const defaultAddr =
                    addrs.find((a) => a.is_default) ?? addrs[0];
                  this.selectedAddressId.set(defaultAddr?.id ?? null);
                  this.useNewAddress.set(addrs.length === 0);
                });
            } else {
              this.addresses.set([]);
              this.selectedAddressId.set(null);
              this.useNewAddress.set(true);
            }
          });
      } else {
        this.otpError.set(res.message);
      }
    });
  }

  nextStep(): void {
    if (this.step() === 1 && !this.phoneVerified()) return;
    if (this.step() === 2) {
      const cust = this.existingCustomer();
      if (cust && !this.useNewAddress()) {
        if (!this.selectedAddressId()) {
          return;
        }
      } else {
        if (!this.customerForm.get('fullName')?.value?.trim()) {
          this.customerForm.get('fullName')?.setErrors({ required: true });
          return;
        }
        if (this.useNewAddress() || !cust) {
          this.addressForm.markAllAsTouched();
          if (this.addressForm.invalid) return;
        }
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

  buildScheduledDeliveryISO(): string | undefined {
    const delivery = this.deliveryForm.value;
    if (!delivery.scheduleDelivery || !delivery.date) return undefined;
    const date = delivery.date;
    const time = delivery.time || '12:00';
    try {
      return new Date(`${date}T${time}:00`).toISOString();
    } catch {
      return undefined;
    }
  }

  submitOrder(): void {
    const phone = (this.phoneForm.get('phone')?.value ?? '').replace(/\D/g, '');
    const fullName = (this.customerForm.get('fullName')?.value ?? '').trim();
    const email = (this.customerForm.get('email')?.value ?? '').trim();
    const items: CreateOrderItemDto[] = this.cartItems().map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
    }));
    const coupon_code = this.discountService.appliedCode() || undefined;
    const scheduled_delivery = this.buildScheduledDeliveryISO();

    const doCreateOrder = (customer_id: string, address_id: string) => {
      const dto: CreateOrderDto = {
        customer_id,
        address_id,
        items,
        coupon_code,
        scheduled_delivery,
      };
      this.submitLoading.set(true);
      this.orderService.createOrderApi(dto).subscribe({
        next: (order) => {
          this.submitLoading.set(false);
          if (order?.id) {
            this.cart.clear();
            this.discountService.clearAppliedCoupon();
            this.router.navigate(['/order-success', order.id]);
          }
        },
        error: () => this.submitLoading.set(false),
      });
    };

    const cust = this.existingCustomer();
    if (cust && !this.useNewAddress()) {
      const addrId = this.selectedAddressId();
      if (addrId) {
        doCreateOrder(cust.id, addrId);
      }
      return;
    }

    const addressValue = this.addressForm.value;
    const createAddressDto: CreateAddressDto = {
      label: (addressValue.label ?? 'Home').trim(),
      country: (addressValue.country ?? 'KW').trim(),
      city: (addressValue.city ?? '').trim(),
      state: (addressValue.state ?? '').trim(),
      block: (addressValue.block ?? '').trim(),
      street: (addressValue.street ?? '').trim(),
      avenue: (addressValue.avenue ?? '').trim() || null,
      building_number: (addressValue.building_number ?? '').trim(),
      apartment_number: (addressValue.apartment_number ?? '').trim() || null,
      is_default: addressValue.is_default ?? true,
    };

    if (cust) {
      this.submitLoading.set(true);
      this.storeCustomer.createAddress(cust.id, createAddressDto).subscribe({
        next: (addr) => {
          if (addr?.id) {
            doCreateOrder(cust.id, addr.id);
          } else {
            this.submitLoading.set(false);
          }
        },
        error: () => this.submitLoading.set(false),
      });
      return;
    }

    this.submitLoading.set(true);
    this.storeCustomer
      .createCustomer({
        phone_number: phone,
        full_name: fullName,
        email: email || undefined,
      })
      .subscribe({
        next: (newCustomer) => {
          if (!newCustomer?.id) {
            this.submitLoading.set(false);
            return;
          }
          this.storeCustomer
            .createAddress(newCustomer.id, createAddressDto)
            .subscribe({
              next: (addr) => {
                if (addr?.id) {
                  doCreateOrder(newCustomer.id, addr.id);
                } else {
                  this.submitLoading.set(false);
                }
              },
              error: () => this.submitLoading.set(false),
            });
        },
        error: () => this.submitLoading.set(false),
      });
  }
}
