import { Component, OnInit, signal } from '@angular/core';
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
          <p class="muted">Твої власні навчальні маршрути.</p>
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
        @for (c of courses(); track c.id) {
          <a class="course-card" [routerLink]="['/courses', c.id]">
            <div class="card-body">
              <div class="badge">{{ pct(c) }}%</div>
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
    .card-body { padding: 1.25rem; flex: 1; position: relative; }
    .badge {
      position: absolute; top: 1rem; right: 1rem;
      background: var(--bg-elev-3);
      color: var(--accent);
      font-weight: 700;
      font-size: .75rem;
      padding: .25rem .55rem;
      border-radius: 99px;
    }
    .course-card h3 { font-size: 1.05rem; margin: 0 3rem .5rem 0; }
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
