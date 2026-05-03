import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { EMPTY } from 'rxjs';

/**
 * Interceptor that:
 * - Logs the user out and clears the token when the access token is expired (based on JWT exp claim).
 * - Also logs out on 401 responses from the backend.
 */
export const authExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // If token is already expired, log out before sending the request.
  if (auth.isTokenExpired()) {
    auth.logout();
    return EMPTY;
  }

  return next(req).pipe(
    tap({
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          auth.logout();
        }
      },
    }),
  );
};
