import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CoursesService } from '../core/courses.service';
import { CourseWithProgress } from '../core/models';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container">
      <header class="page-head">
        <div>
          <h1>Курси</h1>
          <p class="muted">Свої курси та ті, якими з тобою поділились.</p>
        </div>
        <button class="btn btn-primary" (click)="toggleForm()">
          {{ showForm() ? 'Скасувати' : '+ Новий курс' }}
        </button>
      </header>

      @if (showForm()) {
        <form class="card new-form" (ngSubmit)="create()">
          <input name="title" [(ngModel)]="newTitle" placeholder="Назва курсу (наприклад, «Скіли рієлтора»)" required />
          <textarea name="desc" [(ngModel)]="newDesc" placeholder="Короткий опис: про що цей курс?" rows="3"></textarea>
          <div class="row">
            <button type="submit" class="btn btn-primary" [disabled]="!newTitle.trim() || saving()">
              {{ saving() ? 'Створення...' : 'Створити курс' }}
            </button>
            <button type="button" class="btn btn-ghost" (click)="toggleForm()">Скасувати</button>
          </div>
        </form>
      }

      @if (loading()) { <p class="muted">Завантаження...</p> }
      @if (error()) { <p class="err">{{ error() }}</p> }

      @if (!loading() && courses().length > 0) {
        <div class="filters">
          <button class="chip" [class.active]="filter() === 'all'" (click)="filter.set('all')">
            Усі <span class="chip-count">{{ courses().length }}</span>
          </button>
          <button class="chip" [class.active]="filter() === 'mine'" (click)="filter.set('mine')">
            Мої <span class="chip-count">{{ ownCount() }}</span>
          </button>
          <button class="chip" [class.active]="filter() === 'shared'" (click)="filter.set('shared')">
            Поділилися зі мною <span class="chip-count">{{ sharedCount() }}</span>
          </button>
        </div>
      }

      @if (!loading() && courses().length === 0) {
        <div class="card empty">
          <div class="empty-icon">📚</div>
          <h3>Поки що порожньо</h3>
          <p class="muted">Створи свій перший курс — і почни вчитися систематично.</p>
          @if (!showForm()) {
            <button class="btn btn-primary" (click)="toggleForm()">+ Створити курс</button>
          }
        </div>
      }

      <div class="grid">
        @for (c of visibleCourses(); track c.id) {
          <a class="course-card" [class.shared]="!c.is_own" [routerLink]="['/courses', c.id]">
            <div class="card-body">
              <div class="badge-row">
                @if (c.is_own) {
                  <span class="vis-badge" [class]="'vis-' + c.visibility" [title]="visTitle(c.visibility)">
                    {{ visIcon(c.visibility) }} {{ visLabel(c.visibility) }}
                  </span>
                } @else {
                  <span class="owner-badge" [title]="'Автор: ' + (c.owner_nickname || 'без імені')">
                    @if (c.owner_avatar_url) {
                      <img [src]="c.owner_avatar_url" alt="" />
                    } @else {
                      <span class="mini-avatar">{{ ownerInitial(c) }}</span>
                    }
                    {{ '@' + (c.owner_nickname || 'user') }}
                  </span>
                }
                <div class="pct-badge">{{ pct(c) }}%</div>
              </div>
              <h3>{{ c.title }}</h3>
              @if (c.description) {
                <p class="muted desc">{{ c.description }}</p>
              } @else {
                <p class="muted desc faint">Без опису</p>
              }
            </div>
            <div class="card-foot">
              <div class="bar"><div class="fill" [style.width.%]="pct(c)"></div></div>
              <div class="meta">
                <span>{{ c.completed_lessons }} / {{ c.total_lessons }} уроків</span>
                @if (c.total_lessons > 0 && c.completed_lessons === c.total_lessons) {
                  <span class="done-badge">✓ Пройдено</span>
                }
              </div>
            </div>
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 0 1.5rem; }
    .page-head p { margin: 0; }
    .new-form { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.5rem; }

    .filters { display: flex; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .chip {
      background: var(--bg-elev-2);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: .4rem .85rem;
      border-radius: 99px;
      font-size: .85rem; font-weight: 500;
      cursor: pointer;
      display: inline-flex; align-items: center; gap: .4rem;
      transition: border-color .15s, color .15s;
    }
    .chip:hover { border-color: var(--accent); }
    .chip.active { border-color: var(--accent); color: var(--accent); }
    .chip-count {
      background: var(--bg-elev-3); color: var(--text);
      padding: .05rem .4rem; border-radius: 99px; font-size: .7rem; font-weight: 700;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .course-card {
      display: flex; flex-direction: column;
      background: var(--bg-elev-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0;
      text-decoration: none;
      color: var(--text);
      overflow: hidden;
      transition: border-color .15s, transform .15s, box-shadow .15s;
      min-height: 200px;
    }
    .course-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    .course-card.shared { border-left: 3px solid var(--accent); }

    .card-body { padding: 1.25rem; flex: 1; position: relative; }
    .badge-row {
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
      margin-bottom: .75rem;
    }
    .vis-badge, .owner-badge {
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .2rem .55rem;
      border-radius: 99px;
      font-size: .7rem; font-weight: 600;
      background: var(--bg-elev-3);
      color: var(--text-muted);
      max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .vis-private { color: var(--text-muted); }
    .vis-friends { color: #4FC1FF; }
    .vis-public { color: var(--success); }
    .owner-badge img, .owner-badge .mini-avatar {
      width: 16px; height: 16px; border-radius: 50%;
      object-fit: cover;
    }
    .owner-badge .mini-avatar {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--accent); color: var(--accent-contrast);
      font-size: .55rem; font-weight: 700;
    }
    .pct-badge {
      background: var(--bg-elev-3); color: var(--accent);
      font-weight: 700; font-size: .7rem;
      padding: .2rem .5rem; border-radius: 99px;
    }
    .course-card h3 { font-size: 1.05rem; margin: 0 0 .5rem; }
    .desc { font-size: .85rem; line-height: 1.5; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .desc.faint { color: var(--text-faint); font-style: italic; }
    .card-foot { padding: .9rem 1.25rem; border-top: 1px solid var(--border); background: var(--bg-elev-2); }
    .bar { height: 4px; background: var(--bg-elev-3); border-radius: 99px; overflow: hidden; margin-bottom: .5rem; }
    .fill { height: 100%; background: var(--accent); transition: width .3s; }
    .meta { display: flex; justify-content: space-between; align-items: center; font-size: .8rem; color: var(--text-muted); }
    .done-badge { color: var(--success); font-weight: 600; }

    .empty { text-align: center; padding: 3rem 1rem; }
    .empty-icon { font-size: 3rem; margin-bottom: .5rem; }
    .empty h3 { font-size: 1.25rem; }
    .empty p { margin: .5rem 0 1.25rem; }
  `]
})
export class CourseListComponent implements OnInit {
  courses = signal<CourseWithProgress[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);
  saving = signal(false);
  newTitle = '';
  newDesc = '';

  filter = signal<'all' | 'mine' | 'shared'>('all');

  ownCount = computed(() => this.courses().filter(c => c.is_own).length);
  sharedCount = computed(() => this.courses().filter(c => !c.is_own).length);
  visibleCourses = computed(() => {
    const f = this.filter();
    if (f === 'mine') return this.courses().filter(c => c.is_own);
    if (f === 'shared') return this.courses().filter(c => !c.is_own);
    return this.courses();
  });

  constructor(private coursesSvc: CoursesService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.courses.set(await this.coursesSvc.listCoursesWithProgress());
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  toggleForm() { this.showForm.update(v => !v); }

  pct(c: CourseWithProgress): number {
    return c.total_lessons === 0 ? 0 : Math.round((c.completed_lessons / c.total_lessons) * 100);
  }

  ownerInitial(c: CourseWithProgress): string {
    return (c.owner_nickname?.[0] ?? '?').toUpperCase();
  }

  visIcon(v: string): string {
    return v === 'public' ? '🌍' : v === 'friends' ? '👥' : '🔒';
  }
  visLabel(v: string): string {
    return v === 'public' ? 'Публічний' : v === 'friends' ? 'Друзі' : 'Приватний';
  }
  visTitle(v: string): string {
    return v === 'public' ? 'Бачать усі юзери з прямим лінком'
         : v === 'friends' ? 'Бачать твої друзі'
         : 'Бачиш тільки ти';
  }

  async create() {
    if (!this.newTitle.trim()) return;
    this.saving.set(true);
    try {
      await this.coursesSvc.createCourse({ title: this.newTitle.trim(), description: this.newDesc.trim() || undefined });
      this.newTitle = '';
      this.newDesc = '';
      this.showForm.set(false);
      await this.load();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }
}
