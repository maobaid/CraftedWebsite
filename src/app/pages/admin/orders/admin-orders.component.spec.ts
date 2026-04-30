import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AdminOrdersComponent } from './admin-orders.component';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { Order } from '../../../core/models/order.model';
import * as fileDownloadUtil from '../../../core/utils/file-download.util';

describe('AdminOrdersComponent receipt actions', () => {
  let fixture: ComponentFixture<AdminOrdersComponent>;
  let orderServiceSpy: jasmine.SpyObj<OrderService> & { orders: ReturnType<typeof signal<Order[]>> };

  const sampleOrder: Order = {
    id: 'order-1',
    customerId: 'cust-1',
    customer: { fullName: 'Customer One', phone: '55555555' },
    items: [],
    subtotal: 10,
    total: 10,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    orderServiceSpy = Object.assign(
      jasmine.createSpyObj<OrderService>('OrderService', [
        'updateOrderStatus',
        'resendOrderReceipt',
        'downloadOrderReceipt',
      ]),
      {
        orders: signal<Order[]>([sampleOrder]),
      },
    );
    orderServiceSpy.resendOrderReceipt.and.resolveTo({});
    orderServiceSpy.downloadOrderReceipt.and.resolveTo(
      new Blob(['pdf'], { type: 'application/pdf' }),
    );

    await TestBed.configureTestingModule({
      imports: [AdminOrdersComponent],
      providers: [
        { provide: OrderService, useValue: orderServiceSpy },
        {
          provide: AuthService,
          useValue: {
            user: () => ({ role: 'STORE_ADMIN', store_id: 'store-123' }),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOrdersComponent);
    fixture.detectChanges();
  });

  it('click resend calls API and shows success toast', fakeAsync(() => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const resendButton = buttons.find((b) =>
      b.textContent?.includes('Resend via WhatsApp'),
    );
    expect(resendButton).toBeTruthy();
    resendButton!.click();
    tick();
    fixture.detectChanges();

    expect(orderServiceSpy.resendOrderReceipt).toHaveBeenCalledWith(
      'store-123',
      'order-1',
    );
    expect(fixture.nativeElement.textContent).toContain('Receipt resent successfully');
  }));

  it('click download calls API and triggers blob download flow', fakeAsync(() => {
    const downloadSpy = spyOn(fileDownloadUtil, 'triggerPdfDownload');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const downloadButton = buttons.find((b) =>
      b.textContent?.includes('Download Receipt'),
    );
    expect(downloadButton).toBeTruthy();
    downloadButton!.click();
    tick();
    fixture.detectChanges();

    expect(orderServiceSpy.downloadOrderReceipt).toHaveBeenCalledWith(
      'store-123',
      'order-1',
    );
    expect(downloadSpy).toHaveBeenCalled();
  }));
});
