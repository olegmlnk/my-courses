import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="auth-card card">
        <div class="logo-mark">M<span class="dot">·</span>C</div>
        <h1>Створи свій кабінет</h1>
        <p class="muted">Особистий простір для твоїх курсів.</p>

        <form (ngSubmit)="submit()" class="form">
          <label>
            <span class="label">Email</span>
            <input type="email" name="email" [(ngModel)]="email" placeholder="you@example.com" required autofocus />
          </label>
          <label>
            <span class="label">Пароль</span>
            <input type="password" name="password" [(ngModel)]="password" placeholder="мінімум 6 символів" required minlength="6" />
          </label>
          <button type="submit" class="btn btn-primary" [disabled]="loading()">
            {{ loading() ? 'Створення...' : 'Створити акаунт' }}
          </button>
          @if (info()) { <p class="ok">{{ info() }}</p> }
          @if (error()) { <p class="err">{{ error() }}</p> }
        </form>

        <p class="hint">Уже маєте акаунт? <a routerLink="/login">Увійти</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 60px); padding: 2rem 1rem;
    }
    .auth-card {
      width: 100%; max-width: 420px;
      padding: 2.5rem 2rem;
      box-shadow: var(--shadow);
    }
    .logo-mark {
      width: 48px; height: 48px;
      background: var(--accent);
      color: var(--accent-contrast);
      border-radius: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.1rem;
      margin-bottom: 1.5rem;
    }
    .logo-mark .dot { opacity: .55; margin: 0 1px; }
    h1 { margin: 0 0 .25rem; }
    .muted { margin: 0 0 1.75rem; }

    .form { display: flex; flex-direction: column; gap: 1rem; }
    .form label { display: flex; flex-direction: column; gap: .35rem; }
    .label { font-size: .8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
    .form button { padding: .75rem; margin-top: .5rem; }

    .hint { margin: 1.5rem 0 0; text-align: center; color: var(--text-muted); }
  `]
})
export class RegisterComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);
    const { data, error } = await this.auth.signUp(this.email, this.password);
    this.loading.set(false);
    if (error) { this.error.set(error.message); return; }
    if (data.session) {
      this.router.navigate(['/home']);
    } else {
      this.info.set('Перевірте пошту для підтвердження акаунту.');
    }
  }
}
