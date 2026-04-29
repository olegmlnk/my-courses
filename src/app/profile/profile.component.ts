import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { CoursesService } from '../core/courses.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container profile">
      <section class="hero card">
        <div class="hero-avatar">
          @if (avatar()) {
            <img [src]="avatar()" alt="avatar" />
          } @else {
            <div class="fallback">{{ initials() }}</div>
          }
        </div>
        <div class="hero-info">
          <p class="kicker">Кабінет користувача</p>
          <h1>{{ nickname() }}</h1>
          <p class="muted email">{{ email() }}</p>
          @if (memberSince()) {
            <p class="muted small">З нами з {{ memberSince() }}</p>
          }
          <div class="hero-actions">
            <a class="btn btn-primary btn-sm" routerLink="/settings">Редагувати профіль</a>
            <a class="btn btn-ghost btn-sm" routerLink="/courses">Мої курси</a>
            <button class="btn btn-ghost btn-sm" (click)="logout()">Вийти</button>
          </div>
        </div>
      </section>

      <section class="stats">
        <div class="stat">
          <div class="stat-label">Курси</div>
          <div class="stat-value">{{ stats().courses }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Уроки</div>
          <div class="stat-value">{{ stats().lessons }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Пройдено</div>
          <div class="stat-value">{{ stats().completed }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Прогрес</div>
          <div class="stat-value">{{ completionPct() }}%</div>
        </div>
      </section>

      <section class="card panel">
        <h2>Акаунт</h2>
        <div class="account-grid">
          <div class="kv">
            <span class="muted">Email</span>
            <span>{{ email() }}</span>
          </div>
          <div class="kv">
            <span class="muted">Нікнейм</span>
            <span>{{ nickname() }}</span>
          </div>
          <div class="kv">
            <span class="muted">ID користувача</span>
            <span class="mono small">{{ userId() }}</span>
          </div>
        </div>
        <p class="muted small hint">
          Щоб змінити email, пароль або видалити акаунт — перейди в
          <a routerLink="/settings">Налаштування</a>.
        </p>
      </section>
    </div>
  `,
  styles: [`
    .profile { max-width: 860px; }

    .hero {
      display: flex; gap: 1.75rem; align-items: center;
      padding: 1.75rem;
      margin-top: 1.5rem;
    }
    .hero-avatar img, .hero-avatar .fallback {
      width: 120px; height: 120px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid var(--border);
      background: var(--bg-elev-2);
      display: block;
    }
    .hero-avatar .fallback {
      display: flex; align-items: center; justify-content: center;
      background: var(--accent); color: var(--accent-contrast);
      font-weight: 700; font-size: 2.5rem;
    }
    .hero-info { flex: 1; min-width: 0; }
    .kicker {
      color: var(--text-muted); margin: 0 0 .25rem;
      font-size: .75rem; text-transform: uppercase; letter-spacing: .08em;
    }
    .hero-info h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
    .email { margin: 0; word-break: break-all; }
    .small { font-size: .8rem; }
    .hero-actions { display: flex; gap: .5rem; margin-top: 1rem; flex-wrap: wrap; }

    .stats {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 1rem; margin: 1.25rem 0;
    }
    .stat {
      background: var(--bg-elev-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem 1.25rem;
    }
    .stat-label {
      color: var(--text-muted); font-size: .75rem;
      text-transform: uppercase; letter-spacing: .06em;
    }
    .stat-value { font-size: 1.75rem; font-weight: 700; margin-top: .25rem; }

    .panel { margin-top: 1.25rem; }
    .panel h2 { margin: 0 0 1rem; }
    .account-grid {
      display: grid; gap: .75rem;
    }
    .kv {
      display: grid; grid-template-columns: 140px 1fr; gap: 1rem;
      padding: .65rem 0;
      border-bottom: 1px solid var(--border);
    }
    .kv:last-child { border-bottom: none; }
    .mono { font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace; }
    .hint { margin-top: 1rem; }

    @media (max-width: 720px) {
      .hero { flex-direction: column; text-align: center; }
      .hero-actions { justify-content: center; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .kv { grid-template-columns: 1fr; gap: .25rem; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  stats = signal({ courses: 0, lessons: 0, completed: 0 });

  nickname = computed(() =>
    this.profileSvc.profile()?.nickname ??
    this.auth.user()?.email?.split('@')[0] ??
    'Користувач'
  );
  avatar = computed(() => this.profileSvc.profile()?.avatar_url ?? null);
  email = computed(() => this.auth.user()?.email ?? '');
  userId = computed(() => this.auth.user()?.id ?? '');
  initials = computed(() => (this.nickname()[0] ?? '?').toUpperCase());
  memberSince = computed(() => {
    const created = this.auth.user()?.created_at;
    if (!created) return null;
    return new Date(created).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  });
  completionPct = computed(() => {
    const s = this.stats();
    return s.lessons === 0 ? 0 : Math.round((s.completed / s.lessons) * 100);
  });

  constructor(
    public auth: AuthService,
    public profileSvc: ProfileService,
    private coursesSvc: CoursesService,
    private router: Router
  ) {}

  async ngOnInit() {
    if (!this.profileSvc.profile()) { try { await this.profileSvc.load(); } catch {} }
    try {
      this.stats.set(await this.coursesSvc.overallStats());
    } catch {}
  }

  async logout() {
    await this.auth.signOut();
    this.profileSvc.clear();
    this.router.navigate(['/login']);
  }
}
