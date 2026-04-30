import { HttpErrorResponse } from '@angular/common/http';

type ErrorPayload = {
  message?: string;
  error?: string;
};

export function parseApiErrorMessage(
  err: unknown,
  fallback = 'حدث خطأ غير متوقع',
): string {
  if (err instanceof HttpErrorResponse) {
    const payload = err.error as ErrorPayload | string | null;
    if (typeof payload === 'string' && payload.trim()) return payload;
    if (payload && typeof payload === 'object') {
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    }
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
