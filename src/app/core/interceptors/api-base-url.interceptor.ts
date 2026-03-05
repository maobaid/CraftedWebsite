import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Prepends environment.apiUrl to requests to /auth and /stores so the backend
 * is called from env instead of the dev server proxy.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  if (
    (url.startsWith('/auth') || url.startsWith('/stores')) &&
    !url.startsWith('http')
  ) {
    const base = environment.apiUrl.replace(/\/$/, '');
    req = req.clone({ url: `${base}${url.startsWith('/') ? url : '/' + url}` });
  }
  return next(req);
};
