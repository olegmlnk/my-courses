import { Component, computed, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { ProfileService } from './core/profile.service';
import { FriendsService } from './core/friends.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a routerLink="/home" class="brand">
        <span class="brand-mark">M<span class="dot">·</span>C</span>
        <span class="brand-name">MyCourses</span>
      </a>

      @if (auth.isAuthenticated()) {
        <nav class="nav">
          <a routerLink="/home" routerLinkActive="active">Кабінет</a>
          <a routerLink="/courses" routerLinkActive="active">Курси</a>
          <a routerLink="/friends" routerLinkActive="active" class="with-badge">
            Друзі
            @if (incomingCount() > 0) { <span class="badge">{{ incomingCount() }}</span> }
          </a>
          <a routerLink="/settings" routerLinkActive="active">Налаштування</a>
        </nav>
      }

      <div class="spacer"></div>

      @if (auth.isAuthenticated()) {
        <button class="btn btn-ghost btn-sm" (click)="theme.toggle()" title="Тема">
          @if (theme.theme() === 'dark') { ☀️ } @else { 🌙 }
        </button>

        <a
          routerLink="/profile"
          routerLinkActive="active"
          class="user-pill"
          title="Кабінет користувача"
        >
          @if (avatar()) {
            <img [src]="avatar()" alt="" />
          } @else {
            <span class="avatar-fallback">{{ initials() }}</span>
          }
          <span class="nick">{{ nickname() }}</span>
        </a>

        <button class="btn btn-ghost btn-sm" (click)="logout()">Вийти</button>
      } @else {
        <button class="btn btn-ghost btn-sm" (click)="theme.toggle()">
          @if (theme.theme() === 'dark') { ☀️ } @else { 🌙 }
        </button>
        <a class="btn btn-ghost btn-sm" routerLink="/login">Вхід</a>
        <a class="btn btn-primary btn-sm" routerLink="/register">Реєстрація</a>
      }
    </header>

    <main><router-outlet /></main>
  `,
  styles: [`
    :host { display: block; }
    .topbar {
      display: flex; align-items: center; gap: 1rem;
      padding: .85rem 1.5rem;
      background: var(--bg-elev-1);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10;
    }
    .brand { display: flex; align-items: center; gap: .6rem; color: var(--text); font-weight: 700; }
    .brand:hover { color: var(--text); }
    .brand-mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      background: var(--accent);
      color: var(--accent-contrast);
      border-radius: 8px;
      font-size: .85rem;
      letter-spacing: -.05em;
    }
    .brand-mark .dot { color: var(--accent-contrast); opacity: .55; margin: 0 1px; }
    .brand-name { font-size: 1rem; }
    .nav { display: flex; gap: .25rem; margin-left: 1rem; }
    .nav a {
      color: var(--text-muted);
      padding: .5rem .9rem;
      border-radius: var(--radius-sm);
      font-weight: 500;
    }
    .nav a:hover { color: var(--text); background: var(--bg-elev-2); }
    .nav a.active { color: var(--accent); background: var(--bg-elev-2); }
    .with-badge { position: relative; display: inline-flex; align-items: center; gap: .35rem; }
    .with-badge .badge {
      background: var(--danger); color: #fff;
      font-size: .65rem; font-weight: 700;
      min-width: 18px; height: 18px;
      border-radius: 99px;
      padding: 0 .35rem;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .spacer { flex: 1; }
    .user-pill {
      display: flex; align-items: center; gap: .55rem;
      padding: .25rem .65rem .25rem .25rem;
      background: var(--bg-elev-2);
      border-radius: 20px;
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .user-pill:hover { border-color: var(--accent); color: var(--text); }
    .user-pill.active { border-color: var(--accent); background: var(--bg-elev-3); }
    .user-pill img, .avatar-fallback {
      width: 28px; height: 28px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0;
    }
    .avatar-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--accent); color: var(--accent-contrast);
      font-weight: 700; font-size: .75rem;
    }
    .nick { font-size: .85rem; color: var(--text); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    main { min-height: calc(100vh - 60px); }
    @media (max-width: 720px) {
      .topbar { flex-wrap: wrap; padding: .75rem 1rem; }
      .nav { order: 3; width: 100%; margin: .5rem 0 0; justify-content: space-around; }
      .brand-name { display: none; }
      .nick { display: none; }
    }
  `]
})
export class App {
  nickname = computed(() => this.profile.profile()?.nickname ?? this.auth.user()?.email?.split('@')[0] ?? 'User');
  avatar = computed(() => this.profile.profile()?.avatar_url ?? null);
  initials = computed(() => (this.nickname()[0] ?? '?').toUpperCase());
  incomingCount = computed(() => this.friends.incoming().length);

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private profile: ProfileService,
    private friends: FriendsService,
    private router: Router
  ) {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.profile.load().catch(() => {});
        this.friends.loadAll().catch(() => {});
      } else {
        this.profile.clear();
        this.friends.clear();
      }
    });
  }

  async logout() {
    await this.auth.signOut();
    this.profile.clear();
    this.friends.clear();
    this.router.navigate(['/login']);
  }
}
