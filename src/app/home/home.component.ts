import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoursesService } from '../core/courses.service';
import { ProfileService } from '../core/profile.service';
import { StreakService } from '../core/streak.service';
import { CourseWithProgress } from '../core/models';

const QUOTES = [
  'Знання — найкраща інвестиція. Без волатильності.',
  'Кожен пройдений урок — +1 до твого скіла.',
  'Час, вкладений у навчання, ніколи не обнуляється.',
  'Сьогодні гарний день, щоб закрити ще один урок.',
  'Маленькі щоденні кроки → великі річні стрибки.',
  'Не курс читає тебе. Це ти читаєш курс.',
  'Дисципліна > мотивація. Просто почни.'
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <section class="hero">
        <p class="kicker">{{ greetingPrefix() }}</p>
        <h1>{{ greeting() }}, <span class="accent">{{ nickname() }}</span> 👋</h1>
        <p class="quote">"{{ quote() }}"</p>
      </section>

      <section class="streak-banner card" [class.active]="streak().current_streak > 0">
        <div class="streak-icon">🔥</div>
        <div class="streak-body">
          @if (streak().current_streak > 0) {
            <h2><span class="num">{{ streak().current_streak }}</span> {{ daysWord(streak().current_streak) }} поспіль</h2>
            <p class="muted">
              Сьогодні: {{ streak().today_count }} уроків. Особистий рекорд: {{ streak().longest_streak }}.
              @if (streak().today_count === 0) { <span class="warn">Не зривай ланцюжок — пройди хоча б 1 урок сьогодні.</span> }
            </p>
          } @else if (streak().longest_streak > 0) {
            <h2>Серія обнулилася</h2>
            <p class="muted">Твій рекорд був <strong>{{ streak().longest_streak }}</strong> днів. Почни нову — пройди урок сьогодні.</p>
          } @else {
            <h2>Почни свою першу серію</h2>
            <p class="muted">Проходь хоча б 1 урок щодня — лічильник буде рости.</p>
          }
        </div>
      </section>

      <section class="stats">
        <div class="stat-card">
          <div class="stat-label">Курси</div>
          <div class="stat-value">{{ stats().courses }}</div>
          <div class="stat-sub">створено</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Уроки</div>
          <div class="stat-value">{{ stats().lessons }}</div>
          <div class="stat-sub">всього</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Пройдено</div>
          <div class="stat-value">{{ stats().completed }}</div>
          <div class="stat-sub">{{ completionPct() }}% від усіх</div>
        </div>
        <div class="stat-card big-progress">
          <div class="stat-label">Прогрес</div>
          <div class="ring">
            <svg viewBox="0 0 36 36" class="ring-svg">
              <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="ring-fg" [attr.stroke-dasharray]="completionPct() + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <div class="ring-text">{{ completionPct() }}%</div>
          </div>
        </div>
      </section>

      <section class="recent">
        <div class="between">
          <h2>Останні курси</h2>
          <a class="btn btn-ghost btn-sm" routerLink="/courses">Усі →</a>
        </div>
        @if (recent().length === 0) {
          <div class="card empty">
            <p>Ти ще не створив жодного курсу.</p>
            <a class="btn btn-primary" routerLink="/courses">+ Створити перший</a>
          </div>
        } @else {
          <div class="recent-grid">
            @for (c of recent(); track c.id) {
              <a [routerLink]="['/courses', c.id]" class="card mini-card">
                <h3>{{ c.title }}</h3>
                @if (c.description) { <p class="muted">{{ c.description }}</p> }
                <div class="mini-progress">
                  <div class="bar"><div class="fill" [style.width.%]="pct(c)"></div></div>
                  <span class="muted small">{{ c.completed_lessons }}/{{ c.total_lessons }}</span>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .hero { padding: 2.5rem 0 1.5rem; }
    .kicker { color: var(--text-muted); margin: 0 0 .25rem; font-size: .85rem; text-transform: uppercase; letter-spacing: .08em; }
    h1 { font-size: 2.25rem; }
    .accent { color: var(--accent); }
    .quote { color: var(--text-muted); font-style: italic; max-width: 580px; }

    .streak-banner {
      display: flex; align-items: center; gap: 1.25rem;
      padding: 1.25rem 1.5rem;
      margin: 1.25rem 0 1rem;
      border-left: 4px solid var(--bg-elev-3);
    }
    .streak-banner.active { border-left-color: #FF7A00; }
    .streak-icon { font-size: 2.5rem; flex-shrink: 0; }
    .streak-body h2 { margin: 0 0 .25rem; font-size: 1.15rem; }
    .streak-body p { margin: 0; }
    .streak-body .num { color: #FF7A00; font-weight: 800; font-size: 1.5rem; }
    .streak-body .warn { color: var(--accent); display: block; margin-top: .25rem; font-weight: 500; }

    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0 2.5rem; }
    .stat-card {
      background: var(--bg-elev-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.1rem 1.25rem;
      display: flex; flex-direction: column; gap: .25rem;
      position: relative; overflow: hidden;
    }
    .stat-label { color: var(--text-muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
    .stat-value { font-size: 2rem; font-weight: 700; color: var(--text); }
    .stat-sub { color: var(--text-faint); font-size: .8rem; }

    .big-progress { align-items: center; justify-content: center; }
    .ring { position: relative; width: 100px; height: 100px; }
    .ring-svg { transform: rotate(-90deg); width: 100%; height: 100%; }
    .ring-bg { fill: none; stroke: var(--bg-elev-3); stroke-width: 3; }
    .ring-fg { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray .6s; }
    .ring-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; color: var(--text); }

    .recent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .mini-card { display: flex; flex-direction: column; gap: .5rem; transition: border-color .15s, transform .15s; }
    .mini-card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .mini-progress { display: flex; align-items: center; gap: .6rem; margin-top: auto; padding-top: .5rem; }
    .bar { flex: 1; height: 6px; background: var(--bg-elev-3); border-radius: 99px; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); transition: width .3s; }
    .small { font-size: .8rem; }

    .empty { text-align: center; padding: 2rem; }
    .empty p { color: var(--text-muted); margin-bottom: 1rem; }

    @media (max-width: 720px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      h1 { font-size: 1.75rem; }
    }
  `]
})
export class HomeComponent implements OnInit {
  stats = signal({ courses: 0, lessons: 0, completed: 0 });
  recent = signal<CourseWithProgress[]>([]);

  nickname = computed(() => this.profile.profile()?.nickname ?? 'друже');

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Доброї ночі';
    if (h < 12) return 'Доброго ранку';
    if (h < 18) return 'Доброго дня';
    return 'Доброго вечора';
  });

  greetingPrefix = computed(() => {
    const day = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
    return day;
  });

  quote = signal(QUOTES[Math.floor((new Date().getDate() + new Date().getMonth()) % QUOTES.length)]);

  completionPct = computed(() => {
    const s = this.stats();
    return s.lessons === 0 ? 0 : Math.round((s.completed / s.lessons) * 100);
  });

  private streakSvc = inject(StreakService);
  streak = this.streakSvc.streak;

  constructor(
    private coursesSvc: CoursesService,
    private profile: ProfileService
  ) {}

  async ngOnInit() {
    if (!this.profile.profile()) { try { await this.profile.load(); } catch {} }
    try {
      const [s, list] = await Promise.all([
        this.coursesSvc.overallStats(),
        this.coursesSvc.listCoursesWithProgress()
      ]);
      this.stats.set(s);
      this.recent.set(list.slice(0, 3));
    } catch {}
    try { await this.streakSvc.load(); } catch {}
  }

  pct(c: CourseWithProgress): number {
    return c.total_lessons === 0 ? 0 : Math.round((c.completed_lessons / c.total_lessons) * 100);
  }

  daysWord(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дні';
    return 'днів';
  }
}
