import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/customer-layout/customer-layout.component').then((m) => m.CustomerLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
      { path: 'cart', loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent) },
      { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent) },
      { path: 'order-success/:id', loadComponent: () => import('./pages/order-success/order-success.component').then((m) => m.OrderSuccessComponent) },
      { path: 'product/:id', loadComponent: () => import('./pages/product-detail/product-detail.component').then((m) => m.ProductDetailComponent) },
    ],
  },
  {
    path: 'admin',
    children: [
      { path: 'login', loadComponent: () => import('./pages/admin/login/admin-login.component').then((m) => m.AdminLoginComponent) },
      {
        path: '',
        canActivate: [adminGuard],
        loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
        children: [
          { path: '', loadComponent: () => import('./pages/admin/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
          { path: 'products', loadComponent: () => import('./pages/admin/products/admin-products.component').then((m) => m.AdminProductsComponent) },
          { path: 'discounts', loadComponent: () => import('./pages/admin/discounts/admin-discounts.component').then((m) => m.AdminDiscountsComponent) },
          { path: 'coupons', loadComponent: () => import('./pages/admin/coupons/admin-coupons.component').then((m) => m.AdminCouponsComponent) },
          { path: 'orders', loadComponent: () => import('./pages/admin/orders/admin-orders.component').then((m) => m.AdminOrdersComponent) },
          { path: 'customers', loadComponent: () => import('./pages/admin/customers/admin-customers.component').then((m) => m.AdminCustomersComponent) },
          { path: 'delivery', loadComponent: () => import('./pages/admin/delivery/admin-delivery.component').then((m) => m.AdminDeliveryComponent) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
