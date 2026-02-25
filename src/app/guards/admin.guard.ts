import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

const STORE_ADMIN_ROLE = 'STORE_ADMIN';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    router.navigate(['/admin/login']);
    return false;
  }
  const user = auth.user();
  if (user?.role !== STORE_ADMIN_ROLE) {
    router.navigate(['/admin/login']);
    return false;
  }
  return true;
};
