import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const AUTH_KEY = 'crafted_admin_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(this.checkStoredAuth());

  isAuthenticated = computed(() => this.isAuthenticatedSignal());

  constructor(private router: Router) {}

  private checkStoredAuth(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  login(username: string, password: string): boolean {
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      this.isAuthenticatedSignal.set(true);
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/admin/login']);
  }

  get isAdmin(): boolean {
    return this.isAuthenticatedSignal();
  }

  /** Used by the guard so auth is read from storage (avoids timing issues after login). */
  isLoggedIn(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

}
