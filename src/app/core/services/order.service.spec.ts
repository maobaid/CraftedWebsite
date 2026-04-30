import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { AuthService } from './auth.service';
import { StoreCustomerService } from './store-customer.service';
import { ProductService } from './product.service';

describe('OrderService receipt APIs', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  const authStub = {
    user: () => ({ store_id: 'store-123' }),
    getAccessToken: () => 'token-123',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrderService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
        {
          provide: StoreCustomerService,
          useValue: { getCustomerById: () => null, getAddresses: () => null },
        },
        { provide: ProductService, useValue: { getByIdApi: () => null } },
      ],
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('resendOrderReceipt calls resend endpoint with auth header', async () => {
    const promise = service.resendOrderReceipt('store-123', 'order-777');
    const req = httpMock.expectOne(
      '/stores/store-123/orders/order-777/receipt/resend',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ message: 'resent' });
    await expectAsync(promise).toBeResolvedTo({ message: 'resent' });
  });

  it('downloadOrderReceipt returns receipt blob', async () => {
    const promise = service.downloadOrderReceipt('store-123', 'order-777');
    const req = httpMock.expectOne('/stores/store-123/orders/order-777/receipt');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    const pdfBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
    req.flush(pdfBlob);
    await expectAsync(promise).toBeResolvedTo(pdfBlob);
  });

  it('resendOrderReceipt throws parsed backend message on failure', async () => {
    const promise = service.resendOrderReceipt('store-123', 'order-999');
    const req = httpMock.expectOne(
      '/stores/store-123/orders/order-999/receipt/resend',
    );
    req.flush({ message: 'receipt not found' }, { status: 404, statusText: 'NF' });
    await expectAsync(promise).toBeRejectedWithError('receipt not found');
  });
});
