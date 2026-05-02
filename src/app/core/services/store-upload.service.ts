import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isValidHttpProductImageUrl } from '../models/product.model';

/** POST multipart to `/stores/:storeId/customization-uploads/image` part name must be exactly `file`. */
const CUSTOMIZATION_UPLOAD_RELATIVE_PATH =
  'customization-uploads/image' as const;

export class CustomizationUploadError extends Error {
  override readonly name = 'CustomizationUploadError';

  constructor(
    message: string,
    public readonly httpStatus?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

function parseRetryAfterSeconds(res: HttpErrorResponse): number | undefined {
  const raw = res.headers.get('Retry-After');
  if (!raw?.trim()) return undefined;
  const asInt = parseInt(raw.trim(), 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const sec = Math.ceil((asDate - Date.now()) / 1000);
    return sec > 0 ? sec : undefined;
  }
  return undefined;
}

function extractNestedMessage(errorBody: unknown): string {
  if (typeof errorBody === 'string' && errorBody.trim()) {
    return errorBody.trim();
  }
  if (!errorBody || typeof errorBody !== 'object') return '';
  const o = errorBody as Record<string, unknown>;
  const m = o['message'];
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m)) {
    return m.map((x) => String(x)).filter(Boolean).join(' ').trim();
  }
  return '';
}

/**
 * API returns JSON `{ url: "https://..." }` for successful customization image upload.
 */
function extractUrlFromUploadResponse(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const url = (body as Record<string, unknown>)['url'];
  if (typeof url === 'string' && isValidHttpProductImageUrl(url)) {
    return url.trim();
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class StoreUploadService {
  private http = inject(HttpClient);

  uploadCustomizationImage(file: File): Observable<string> {
    const storeId = environment.storeId?.trim();
    if (!storeId) {
      return throwError(
        () =>
          new CustomizationUploadError('المتجر غير مهيأ.', undefined, undefined),
      );
    }

    const fd = new FormData();
    fd.append('file', file, file.name);
    const urlPath = `/stores/${storeId}/${CUSTOMIZATION_UPLOAD_RELATIVE_PATH}`;

    return this.http.post<unknown>(urlPath, fd).pipe(
      map((body) => {
        const resolved = extractUrlFromUploadResponse(body);
        if (!resolved) {
          throw new CustomizationUploadError(
            'استجابة غير متوقعة من الخادم بعد الرفع (يتوقع وجود الحقل url).',
            undefined,
            undefined,
          );
        }
        return resolved;
      }),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          const retryAfterSeconds = parseRetryAfterSeconds(err);
          const apiDetail = extractNestedMessage(err.error);

          switch (err.status) {
            case 400:
              return throwError(
                () =>
                  new CustomizationUploadError(
                    apiDetail ||
                      'تعذر قبول الصورة: تحقّق من النوع، الحجم، والملف (قد يكون تالفاً أو مغيّر الامتداد).',
                    400,
                    undefined,
                  ),
              );
            case 404:
              return throwError(
                () =>
                  new CustomizationUploadError(
                    'المتجر غير موجود أو معرّف المتجر غير صحيح.',
                    404,
                    undefined,
                  ),
              );
            case 429: {
              const calm =
                'رفعتَ صوراً كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.';
              const suffix =
                retryAfterSeconds != null
                  ? ` يُمكنك المحاولة بعد نحو ${retryAfterSeconds} ثانية.`
                  : '';
              return throwError(
                () =>
                  new CustomizationUploadError(
                    calm + suffix,
                    429,
                    retryAfterSeconds,
                  ),
              );
            }
            default: {
              const fallback =
                apiDetail ||
                err.message ||
                `تعذر رفع الصورة (${err.status || 'خطأ شبكة'}).`;
              return throwError(
                () =>
                  new CustomizationUploadError(
                    fallback,
                    err.status,
                    undefined,
                  ),
              );
            }
          }
        }
        if (err instanceof CustomizationUploadError) {
          return throwError(() => err);
        }
        if (err instanceof Error) {
          return throwError(() => err);
        }
        return throwError(() => new Error('تعذر رفع الصورة.'));
      }),
    );
  }
}
