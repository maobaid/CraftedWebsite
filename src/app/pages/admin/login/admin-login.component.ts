import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  error = '';
  loading = false;

  async submit(): Promise<void> {
    this.error = '';
    if (this.form.invalid) return;
    const { username, password } = this.form.getRawValue();
    this.loading = true;
    try {
      const ok = await this.auth.login(username ?? '', password ?? '');
      if (ok) {
        this.router.navigate(['/admin']);
      } else {
        this.error = 'اسم المستخدم أو كلمة المرور غير صحيحة';
      }
    } finally {
      this.loading = false;
    }
  }
}
