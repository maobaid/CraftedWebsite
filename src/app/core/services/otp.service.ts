import { Injectable } from '@angular/core';

/**
 * OTP service - replace with Twilio/Supabase Auth in production.
 * Development: accepts any 6-digit code when phone ends with 00 (e.g. 0500000000).
 */
@Injectable({ providedIn: 'root' })
export class OtpService {
  private readonly DEV_PHONE_SUFFIX = '00'; // dev: phone ending in 00 accepts any OTP
  private sentCodes = new Map<string, string>();

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizeKuwaitiPhone(phone);
    if (!normalized) {
      return { success: false, message: 'رقم الهاتف الكويتي غير صالح' };
    }
    // In production: call Twilio/Supabase API here
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.sentCodes.set(normalized, code);
    console.log('[OTP Dev] Phone:', normalized, 'Code:', code);
    return { success: true, message: 'تم إرسال رمز التحقق. في التطوير: استخدم أي رمز ٦ أرقام للأرقام المنتهية بـ ٠٠' };
  }

  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizeKuwaitiPhone(phone);
    const stored = this.sentCodes.get(normalized);
    const isDevPhone = normalized.slice(-2) === this.DEV_PHONE_SUFFIX;
    const codeClean = code.replace(/\D/g, '');
    if (codeClean.length !== 6) {
      return { success: false, message: 'رمز التحقق يجب أن يكون ٦ أرقام' };
    }
    if (isDevPhone || stored === codeClean) {
      this.sentCodes.delete(normalized);
      return { success: true, message: 'تم التحقق بنجاح' };
    }
    return { success: false, message: 'رمز التحقق غير صحيح' };
  }

  /**
   * Normalize a Kuwaiti mobile number to E.164-like format: 965XXXXXXXX.
   * Accepts:
   * - 8-digit local mobile numbers starting with 5, 6, or 9 (e.g. 51234567)
   * - With leading 0 (e.g. 051234567)
   * - With country code +965 or 965 (e.g. +96551234567, 96551234567)
   */
  private normalizeKuwaitiPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    // Strip leading 965 if present
    let local = digits;
    if (local.startsWith('965')) {
      local = local.slice(3);
    }

    // Strip leading 0 if present (e.g. 051234567)
    if (local.length === 9 && local.startsWith('0')) {
      local = local.slice(1);
    }

    // Now expect exactly 8 digits starting with 5, 6, or 9 (Kuwaiti mobile)
    if (/^[569]\d{7}$/.test(local)) {
      return '965' + local;
    }

    return '';
  }
}
