import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoursesService } from '../core/courses.service';
import { Course, Lesson } from '../core/models';
import { toYouTubeEmbed } from '../core/youtube.util';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container">
      <a routerLink="/courses" class="back">← До списку курсів</a>

      @if (loading()) { <p class="muted">Завантаження...</p> }
      @if (error()) { <p class="err">{{ error() }}</p> }

      @if (course(); as c) {
        <header class="course-head">
          @if (!editingCourse()) {
            <div class="head-info">
              <h1>{{ c.title }}</h1>
              @if (c.description) { <p class="muted desc">{{ c.description }}</p> }
            </div>
            <div class="row">
              <button class="btn btn-ghost btn-sm" (click)="startEditCourse()">Редагувати</button>
              <button class="btn btn-danger btn-sm" (click)="removeCourse()">Видалити курс</button>
            </div>
          } @else {
            <form class="card edit-form" (ngSubmit)="saveCourse()">
              <input name="title" [(ngModel)]="editTitle" required />
              <textarea name="desc" [(ngModel)]="editDesc" rows="2" placeholder="Опис"></textarea>
              <div class="row">
                <button type="submit" class="btn btn-primary">Зберегти</button>
                <button type="button" class="btn btn-ghost" (click)="editingCourse.set(false)">Скасувати</button>
              </div>
            </form>
          }
        </header>

        <!-- Progress hero -->
        <section class="progress-hero card">
          <div>
            <div class="muted small">ТВІЙ ПРОГРЕС</div>
            <div class="big-num">{{ percent() }}%</div>
            <div class="muted small">{{ completedCount() }} з {{ lessons().length }} уроків</div>
          </div>
          <div class="bar-wrap">
            <div class="bar"><div class="fill" [style.width.%]="percent()"></div></div>
            @if (percent() === 100 && lessons().length > 0) {
              <p class="finished">🎉 Курс завершено! Молодець.</p>
            } @else if (lessons().length === 0) {
              <p class="muted">Додай уроки, щоб почати рухатися.</p>
            } @else {
              <p class="muted">Відмічай уроки галочкою — це не звіт, а просто маркер для тебе.</p>
            }
          </div>
        </section>

        <h2>Уроки</h2>

        <div class="lessons">
          @for (l of lessons(); track l.id; let i = $index) {
            <article class="lesson card" [class.done]="l.completed">
              @if (editingLessonId() !== l.id) {
                <header class="lesson-head">
                  <button
                    class="check"
                    [class.checked]="l.completed"
                    (click)="toggleCompleted(l)"
                    [attr.aria-label]="l.completed ? 'Зняти відмітку' : 'Відмітити пройденим'"
                    [title]="l.completed ? 'Знято відмітку' : 'Відмічено пройденим'"
                  >
                    @if (l.completed) { <span>✓</span> }
                  </button>
                  <div class="lesson-info">
                    <span class="position">Урок {{ i + 1 }}</span>
                    <h3>{{ l.title }}</h3>
                  </div>
                  <div class="row">
                    <button class="btn btn-ghost btn-sm" (click)="startEditLesson(l)">✎</button>
                    <button class="btn btn-danger btn-sm" (click)="removeLesson(l.id)">✕</button>
                  </div>
                </header>

                @if (embedUrl(l.video_url); as src) {
                  <div class="video"><iframe [src]="src" frameborder="0" allowfullscreen></iframe></div>
                }

                @if (l.content) { <p class="content">{{ l.content }}</p> }
                @if (!l.content && !l.video_url) { <p class="muted faint">Урок поки порожній. Натисни ✎, щоб додати матеріали.</p> }
              } @else {
                <form class="lesson-form" (ngSubmit)="saveLesson(l.id)">
                  <input name="t" [(ngModel)]="lessonDraft.title" placeholder="Назва уроку" required />
                  <input name="v" [(ngModel)]="lessonDraft.video_url" placeholder="YouTube / Vimeo URL" />
                  <textarea name="c" [(ngModel)]="lessonDraft.content" placeholder="Текст уроку, нотатки, висновки..." rows="6"></textarea>
                  <input name="p" type="number" [(ngModel)]="lessonDraft.position" placeholder="Порядковий номер" />
                  <div class="row">
                    <button type="submit" class="btn btn-primary">Зберегти</button>
                    <button type="button" class="btn btn-ghost" (click)="editingLessonId.set(null)">Скасувати</button>
                  </div>
                </form>
              }
            </article>
          }
        </div>

        @if (!showLessonForm()) {
          <button class="btn btn-primary add-btn" (click)="showLessonForm.set(true)">+ Додати урок</button>
        } @else {
          <form class="card lesson-form" (ngSubmit)="addLesson()">
            <h3>Новий урок</h3>
            <input name="nt" [(ngModel)]="newLesson.title" placeholder="Назва уроку" required />
            <input name="nv" [(ngModel)]="newLesson.video_url" placeholder="YouTube / Vimeo URL (необовʼязково)" />
            <textarea name="nc" [(ngModel)]="newLesson.content" placeholder="Текст уроку, нотатки..." rows="6"></textarea>
            <div class="row">
              <button type="submit" class="btn btn-primary" [disabled]="!newLesson.title.trim()">Додати</button>
              <button type="button" class="btn btn-ghost" (click)="showLessonForm.set(false)">Скасувати</button>
            </div>
          </form>
        }
      }
    </div>
  `,
  styles: [`
    .back { color: var(--text-muted); display: inline-block; margin: 1rem 0 0; font-size: .9rem; }
    .back:hover { color: var(--accent); }
    .course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0; }
    .head-info h1 { margin: 0 0 .5rem; }
    .desc { max-width: 640px; }
    .edit-form { display: flex; flex-direction: column; gap: .75rem; flex: 1; }

    .progress-hero {
      display: grid; grid-template-columns: auto 1fr; gap: 2rem;
      align-items: center;
      margin-bottom: 1rem;
    }
    .big-num { font-size: 3rem; font-weight: 700; color: var(--accent); line-height: 1; margin: .25rem 0; }
    .small { font-size: .8rem; }
    .bar-wrap { display: flex; flex-direction: column; gap: .75rem; }
    .bar { height: 8px; background: var(--bg-elev-3); border-radius: 99px; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); transition: width .35s; }
    .finished { color: var(--success); font-weight: 600; margin: 0; }

    .lessons { display: flex; flex-direction: column; gap: .75rem; }
    .lesson { padding: 1.25rem; transition: opacity .2s; }
    .lesson.done { opacity: .7; }
    .lesson.done .lesson-info h3 { text-decoration: line-through; color: var(--text-muted); }

    .lesson-head { display: flex; align-items: flex-start; gap: 1rem; }
    .lesson-info { flex: 1; }
    .position { font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: var(--text-faint); }
    .lesson-info h3 { margin: .15rem 0 0; font-size: 1.05rem; }

    .check {
      width: 28px; height: 28px;
      border: 2px solid var(--border-strong);
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--accent-contrast);
      font-weight: 800;
      flex-shrink: 0;
      margin-top: .15rem;
      transition: background .15s, border-color .15s;
      padding: 0;
    }
    .check:hover { border-color: var(--accent); }
    .check.checked { background: var(--accent); border-color: var(--accent); }

    .video { position: relative; padding-top: 56.25%; margin: 1rem 0 0; }
    .video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: var(--radius-sm); border: 0; }

    .content { white-space: pre-wrap; line-height: 1.65; margin-top: 1rem; color: var(--text); }
    .faint { font-style: italic; }

    .lesson-form { display: flex; flex-direction: column; gap: .75rem; padding: 1.5rem; }

    .add-btn { margin-top: 1rem; }

    @media (max-width: 720px) {
      .progress-hero { grid-template-columns: 1fr; }
      .big-num { font-size: 2.25rem; }
      .course-head { flex-direction: column; }
    }
  `]
})
export class CourseDetailComponent implements OnInit {
  course = signal<Course | null>(null);
  lessons = signal<Lesson[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  editingCourse = signal(false);
  editTitle = '';
  editDesc = '';

  showLessonForm = signal(false);
  newLesson = { title: '', content: '', video_url: '' };

  editingLessonId = signal<string | null>(null);
  lessonDraft: { title: string; content: string; video_url: string; position: number } = { title: '', content: '', video_url: '', position: 0 };

  completedCount = computed(() => this.lessons().filter(l => l.completed).length);
  percent = computed(() => {
    const total = this.lessons().length;
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });

  private courseId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coursesSvc: CoursesService,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [c, ls] = await Promise.all([
        this.coursesSvc.getCourse(this.courseId),
        this.coursesSvc.listLessons(this.courseId)
      ]);
      if (!c) { this.router.navigate(['/courses']); return; }
      this.course.set(c);
      this.lessons.set(ls);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  embedUrl(url: string | null): SafeResourceUrl | null {
    const embed = toYouTubeEmbed(url);
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
  }

  async toggleCompleted(l: Lesson) {
    const next = !l.completed;
    this.lessons.update(arr => arr.map(x => x.id === l.id ? { ...x, completed: next } : x));
    try {
      await this.coursesSvc.setLessonCompleted(l.id, next);
    } catch (e: any) {
      this.error.set(e.message);
      this.lessons.update(arr => arr.map(x => x.id === l.id ? { ...x, completed: !next } : x));
    }
  }

  startEditCourse() {
    const c = this.course();
    if (!c) return;
    this.editTitle = c.title;
    this.editDesc = c.description ?? '';
    this.editingCourse.set(true);
  }

  async saveCourse() {
    try {
      await this.coursesSvc.updateCourse(this.courseId, {
        title: this.editTitle.trim(),
        description: this.editDesc.trim() || null
      });
      this.editingCourse.set(false);
      await this.load();
    } catch (e: any) { this.error.set(e.message); }
  }

  async removeCourse() {
    if (!confirm('Видалити курс і всі його уроки?')) return;
    try {
      await this.coursesSvc.deleteCourse(this.courseId);
      this.router.navigate(['/courses']);
    } catch (e: any) { this.error.set(e.message); }
  }

  async addLesson() {
    if (!this.newLesson.title.trim()) return;
    try {
      const nextPos = (this.lessons()[this.lessons().length - 1]?.position ?? 0) + 1;
      await this.coursesSvc.createLesson({
        course_id: this.courseId,
        title: this.newLesson.title.trim(),
        content: this.newLesson.content.trim() || undefined,
        video_url: this.newLesson.video_url.trim() || undefined,
        position: nextPos
      });
      this.newLesson = { title: '', content: '', video_url: '' };
      this.showLessonForm.set(false);
      await this.load();
    } catch (e: any) { this.error.set(e.message); }
  }

  startEditLesson(l: Lesson) {
    this.lessonDraft = {
      title: l.title,
      content: l.content ?? '',
      video_url: l.video_url ?? '',
      position: l.position
    };
    this.editingLessonId.set(l.id);
  }

  async saveLesson(id: string) {
    try {
      await this.coursesSvc.updateLesson(id, {
        title: this.lessonDraft.title.trim(),
        content: this.lessonDraft.content.trim() || null,
        video_url: this.lessonDraft.video_url.trim() || null,
        position: Number(this.lessonDraft.position) || 0
      });
      this.editingLessonId.set(null);
      await this.load();
    } catch (e: any) { this.error.set(e.message); }
  }

  async removeLesson(id: string) {
    if (!confirm('Видалити урок?')) return;
    try {
      await this.coursesSvc.deleteLesson(id);
      await this.load();
    } catch (e: any) { this.error.set(e.message); }
  }
}
