import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const AUTH_KEY = 'crafted_admin_auth';
const AUTH_TOKEN_KEY = 'crafted_admin_token';
const AUTH_USER_KEY = 'crafted_admin_user';
const LOGIN_URL = '/auth/login';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  store_id: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(this.checkStoredAuth());
  private userSignal = signal<AuthUser | null>(this.getStoredUser());

  isAuthenticated = computed(() => this.isAuthenticatedSignal());
  user = computed(() => this.userSignal());

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  private checkStoredAuth(): boolean {
    return !!sessionStorage.getItem(AUTH_TOKEN_KEY);
  }

  private getStoredUser(): AuthUser | null {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  async login(emailOrUsername: string, password: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(LOGIN_URL, {
          email: emailOrUsername,
          password,
        }, { observe: 'response' })
      );

      if (res.status !== 201 || !res.body) return false;

      const { access_token, user } = res.body;
      sessionStorage.setItem(AUTH_KEY, 'true');
      sessionStorage.setItem(AUTH_TOKEN_KEY, access_token);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      this.isAuthenticatedSignal.set(true);
      this.userSignal.set(user);
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    this.isAuthenticatedSignal.set(false);
    this.userSignal.set(null);
    this.router.navigate(['/admin/login']);
  }

  get isAdmin(): boolean {
    return this.isAuthenticatedSignal();
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  }

  /** Decode JWT payload (unverified) to read exp and other claims. */
  private getTokenPayload(): Record<string, unknown> | null {
    const token = this.getAccessToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(base64);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Check if the current access token is expired (uses JWT exp, with small leeway). */
  isTokenExpired(leewaySeconds = 30): boolean {
    const payload = this.getTokenPayload();
    const exp = payload && typeof payload['exp'] === 'number' ? payload['exp'] : null;
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return now >= exp - leewaySeconds;
  }

  /** Used by the guard so auth is read from storage (avoids timing issues after login). */
  isLoggedIn(): boolean {
    return !!sessionStorage.getItem(AUTH_TOKEN_KEY);
  }
}
