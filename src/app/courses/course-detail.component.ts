import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { CoursesService } from '../core/courses.service';
import { AuthService } from '../core/auth.service';
import { StreakService } from '../core/streak.service';
import { Course, CourseVisibility, Lesson } from '../core/models';
import { toYouTubeEmbed } from '../core/youtube.util';
import { renderMarkdown } from '../core/markdown.util';

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
        @if (!isOwner()) {
          <div class="shared-banner">
            👥 Це чужий курс
            @if (ownerNickname()) { , автор: <strong>&#64;{{ ownerNickname() }}</strong> }
            . Ти можеш переглядати та відмічати свій прогрес — оригінал не зміниться.
          </div>
        }

        <header class="course-head">
          @if (!editingCourse()) {
            <div class="head-info">
              <h1>{{ c.title }}</h1>
              @if (c.description) { <p class="muted desc">{{ c.description }}</p> }
            </div>
            @if (isOwner()) {
              <div class="row">
                <button class="btn btn-ghost btn-sm" (click)="startEditCourse()">Редагувати</button>
                <button class="btn btn-danger btn-sm" (click)="removeCourse()">Видалити курс</button>
              </div>
            }
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

        @if (isOwner()) {
          <section class="card visibility-panel">
            <div class="vis-head">
              <div>
                <h3>Доступ до курсу</h3>
                <p class="muted small">Хто може бачити цей курс і його уроки.</p>
              </div>
              @if (savedVis()) { <span class="ok small">✓ Збережено</span> }
            </div>
            <div class="vis-options">
              @for (opt of VIS_OPTIONS; track opt.value) {
                <button
                  type="button"
                  class="vis-opt"
                  [class.active]="c.visibility === opt.value"
                  (click)="changeVisibility(opt.value)"
                >
                  <span class="vis-icon">{{ opt.icon }}</span>
                  <span class="vis-name">{{ opt.label }}</span>
                  <span class="vis-hint muted small">{{ opt.hint }}</span>
                </button>
              }
            </div>
            @if (c.visibility !== 'private') {
              <button class="btn btn-ghost btn-sm copy-btn" (click)="copyLink()">
                {{ copied() ? '✓ Скопійовано' : '🔗 Скопіювати посилання' }}
              </button>
            }
          </section>
        }

        <section class="progress-hero card">
          <div>
            <div class="muted small">{{ isOwner() ? 'ТВІЙ ПРОГРЕС' : 'ТВІЙ ПРОГРЕС ПО ЦЬОМУ КУРСУ' }}</div>
            <div class="big-num">{{ percent() }}%</div>
            <div class="muted small">{{ completedCount() }} з {{ lessons().length }} уроків</div>
          </div>
          <div class="bar-wrap">
            <div class="bar"><div class="fill" [style.width.%]="percent()"></div></div>
            @if (percent() === 100 && lessons().length > 0) {
              <p class="finished">🎉 Курс завершено! Молодець.</p>
            } @else if (lessons().length === 0) {
              <p class="muted">{{ isOwner() ? 'Додай уроки, щоб почати рухатися.' : 'Уроків поки нема.' }}</p>
            } @else {
              <p class="muted">Відмічай уроки галочкою — це особистий маркер тільки для тебе.</p>
            }
          </div>
        </section>

        <h2>Уроки</h2>

        <div class="lessons">
          @for (l of lessons(); track l.id; let i = $index) {
            <article class="lesson card" [class.done]="isCompleted(l.id)">
              @if (editingLessonId() !== l.id) {
                <header class="lesson-head">
                  <button
                    class="check"
                    [class.checked]="isCompleted(l.id)"
                    (click)="toggleCompleted(l.id)"
                    [attr.aria-label]="isCompleted(l.id) ? 'Зняти відмітку' : 'Відмітити пройденим'"
                    [title]="isCompleted(l.id) ? 'Знято відмітку' : 'Відмічено пройденим'"
                  >
                    @if (isCompleted(l.id)) { <span>✓</span> }
                  </button>
                  <div class="lesson-info">
                    <span class="position">Урок {{ i + 1 }}</span>
                    <h3>{{ l.title }}</h3>
                  </div>
                  @if (isOwner()) {
                    <div class="row">
                      <button class="btn btn-ghost btn-sm" (click)="startEditLesson(l)">✎</button>
                      <button class="btn btn-danger btn-sm" (click)="removeLesson(l.id)">✕</button>
                    </div>
                  }
                </header>

                @if (embedUrl(l.video_url); as src) {
                  <div class="video"><iframe [src]="src" frameborder="0" allowfullscreen></iframe></div>
                }

                @if (l.content) {
                  <div class="markdown content" [innerHTML]="renderedContent(l.content)"></div>
                }
                @if (!l.content && !l.video_url) {
                  <p class="muted faint">{{ isOwner() ? 'Урок поки порожній. Натисни ✎, щоб додати матеріали.' : 'Урок поки порожній.' }}</p>
                }
              } @else {
                <form class="lesson-form" (ngSubmit)="saveLesson(l.id)">
                  <input name="t" [(ngModel)]="lessonDraft.title" placeholder="Назва уроку" required />
                  <input name="v" [(ngModel)]="lessonDraft.video_url" placeholder="YouTube / Vimeo URL" />
                  <label class="muted small">
                    Текст уроку (підтримує <strong>Markdown</strong>: # Заголовок, **жирний**, *курсив*, - списки, [лінк](url), ` + '`код`' + `, &gt; цитата)
                  </label>
                  <textarea name="c" [(ngModel)]="lessonDraft.content" placeholder="Markdown..." rows="10"></textarea>
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

        @if (isOwner()) {
          @if (!showLessonForm()) {
            <button class="btn btn-primary add-btn" (click)="showLessonForm.set(true)">+ Додати урок</button>
          } @else {
            <form class="card lesson-form" (ngSubmit)="addLesson()">
              <h3>Новий урок</h3>
              <input name="nt" [(ngModel)]="newLesson.title" placeholder="Назва уроку" required />
              <input name="nv" [(ngModel)]="newLesson.video_url" placeholder="YouTube / Vimeo URL (необовʼязково)" />
              <label class="muted small">
                Підтримується <strong>Markdown</strong>: # Заголовок, **жирний**, *курсив*, - списки, [лінк](url), ` + '`код`' + `, &gt; цитата
              </label>
              <textarea name="nc" [(ngModel)]="newLesson.content" placeholder="Текст уроку (Markdown)..." rows="8"></textarea>
              <div class="row">
                <button type="submit" class="btn btn-primary" [disabled]="!newLesson.title.trim()">Додати</button>
                <button type="button" class="btn btn-ghost" (click)="showLessonForm.set(false)">Скасувати</button>
              </div>
            </form>
          }
        }
      }
    </div>
  `,
  styles: [`
    .back { color: var(--text-muted); display: inline-block; margin: 1rem 0 0; font-size: .9rem; }
    .back:hover { color: var(--accent); }

    .shared-banner {
      margin-top: 1rem; padding: .85rem 1rem;
      background: var(--bg-elev-2); border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      color: var(--text); font-size: .9rem;
    }

    .course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0; }
    .head-info h1 { margin: 0 0 .5rem; }
    .desc { max-width: 640px; }
    .edit-form { display: flex; flex-direction: column; gap: .75rem; flex: 1; }

    .visibility-panel { margin-bottom: 1.25rem; }
    .vis-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .vis-head h3 { margin: 0 0 .15rem; }
    .vis-head p { margin: 0; }
    .vis-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; }
    .vis-opt {
      background: var(--bg-elev-2);
      border: 2px solid var(--border);
      border-radius: var(--radius-sm);
      padding: .85rem .75rem;
      text-align: left;
      cursor: pointer;
      display: flex; flex-direction: column; gap: .25rem;
      transition: border-color .15s;
      color: var(--text);
    }
    .vis-opt:hover { border-color: var(--accent-hover); }
    .vis-opt.active { border-color: var(--accent); }
    .vis-icon { font-size: 1.25rem; }
    .vis-name { font-weight: 600; }
    .vis-hint { line-height: 1.4; }
    .copy-btn { margin-top: .85rem; }
    .small { font-size: .8rem; }

    .progress-hero {
      display: grid; grid-template-columns: auto 1fr; gap: 2rem;
      align-items: center;
      margin-bottom: 1rem;
    }
    .big-num { font-size: 3rem; font-weight: 700; color: var(--accent); line-height: 1; margin: .25rem 0; }
    .bar-wrap { display: flex; flex-direction: column; gap: .75rem; }
    .bar { height: 8px; background: var(--bg-elev-3); border-radius: 99px; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); transition: width .35s; }
    .finished { color: var(--success); font-weight: 600; margin: 0; }

    .lessons { display: flex; flex-direction: column; gap: .75rem; min-width: 0; }
    .lesson {
      padding: 1.25rem;
      transition: opacity .2s;
      min-width: 0;
      max-width: 100%;
    }
    .lesson.done { opacity: .7; }
    .lesson.done .lesson-info h3 { text-decoration: line-through; color: var(--text-muted); }

    .lesson-head { display: flex; align-items: flex-start; gap: 1rem; }
    .lesson-info { flex: 1; min-width: 0; }
    .position { font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: var(--text-faint); }
    .lesson-info h3 {
      margin: .15rem 0 0; font-size: 1.05rem;
      overflow-wrap: anywhere;
    }

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

    .markdown {
      line-height: 1.7; color: var(--text); margin-top: 1rem;
      max-width: 100%; min-width: 0;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    .markdown h1, .markdown h2, .markdown h3, .markdown h4 {
      margin: 1.25rem 0 .5rem; line-height: 1.3;
      overflow-wrap: break-word;
    }
    .markdown h1 { font-size: 1.5rem; }
    .markdown h2 { font-size: 1.25rem; }
    .markdown h3 { font-size: 1.05rem; }
    .markdown p { margin: .5rem 0; max-width: 100%; }
    .markdown ul, .markdown ol { padding-left: 1.5rem; margin: .5rem 0; }
    .markdown li { margin: .25rem 0; }
    .markdown a {
      color: var(--accent);
      overflow-wrap: anywhere;
    }
    .markdown a:hover { text-decoration: underline; }
    .markdown code {
      background: var(--bg-elev-3); padding: .1rem .35rem;
      border-radius: 4px; font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
      font-size: .9em;
      overflow-wrap: anywhere;
    }
    .markdown pre {
      background: var(--bg-elev-3); padding: .85rem 1rem;
      border-radius: var(--radius-sm);
      overflow-x: auto; max-width: 100%;
      white-space: pre;
    }
    .markdown pre code {
      background: transparent; padding: 0;
      overflow-wrap: normal; white-space: pre;
    }
    .markdown blockquote {
      border-left: 3px solid var(--accent);
      padding: .25rem 1rem;
      margin: .75rem 0;
      color: var(--text-muted);
      background: var(--bg-elev-2);
    }
    .markdown img { max-width: 100%; height: auto; border-radius: var(--radius-sm); display: block; }
    .markdown table {
      border-collapse: collapse; margin: .75rem 0;
      display: block; overflow-x: auto; max-width: 100%;
    }
    .markdown th, .markdown td { border: 1px solid var(--border); padding: .35rem .65rem; text-align: left; }
    .markdown hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }

    .faint { font-style: italic; }

    .lesson-form { display: flex; flex-direction: column; gap: .75rem; padding: 1.5rem; }

    .add-btn { margin-top: 1rem; }

    @media (max-width: 720px) {
      .progress-hero { grid-template-columns: 1fr; }
      .big-num { font-size: 2.25rem; }
      .course-head { flex-direction: column; }
      .vis-options { grid-template-columns: 1fr; }
    }
  `]
})
export class CourseDetailComponent implements OnInit {
  readonly VIS_OPTIONS: { value: CourseVisibility; icon: string; label: string; hint: string }[] = [
    { value: 'private', icon: '🔒', label: 'Приватний', hint: 'Бачиш тільки ти' },
    { value: 'friends', icon: '👥', label: 'Лише для друзів', hint: 'Бачать твої прийняті друзі' },
    { value: 'public', icon: '🌍', label: 'Публічний', hint: 'Будь-хто з посиланням' }
  ];

  course = signal<Course | null>(null);
  lessons = signal<Lesson[]>([]);
  completedSet = signal<Set<string>>(new Set());
  ownerNickname = signal<string | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);
  savedVis = signal(false);
  copied = signal(false);

  editingCourse = signal(false);
  editTitle = '';
  editDesc = '';

  showLessonForm = signal(false);
  newLesson = { title: '', content: '', video_url: '' };

  editingLessonId = signal<string | null>(null);
  lessonDraft: { title: string; content: string; video_url: string; position: number } = { title: '', content: '', video_url: '', position: 0 };

  isOwner = computed(() => {
    const c = this.course();
    return c ? c.user_id === this.auth.user()?.id : false;
  });

  completedCount = computed(() => this.lessons().filter(l => this.completedSet().has(l.id)).length);
  percent = computed(() => {
    const total = this.lessons().length;
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });

  private courseId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coursesSvc: CoursesService,
    private auth: AuthService,
    private streakSvc: StreakService,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    await this.load();
  }

  isCompleted(lessonId: string): boolean {
    return this.completedSet().has(lessonId);
  }

  embedUrl(url: string | null): SafeResourceUrl | null {
    const embed = toYouTubeEmbed(url);
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
  }

  renderedContent(text: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(text));
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [c, ls, progress] = await Promise.all([
        this.coursesSvc.getCourse(this.courseId),
        this.coursesSvc.listLessons(this.courseId),
        this.coursesSvc.listMyProgressForCourse(this.courseId)
      ]);
      if (!c) { this.router.navigate(['/courses']); return; }
      this.course.set(c);
      this.lessons.set(ls);
      this.completedSet.set(progress);
      if (c.user_id !== this.auth.user()?.id) {
        try {
          const owner = await this.coursesSvc.getCourseOwner(c.user_id);
          this.ownerNickname.set(owner?.nickname ?? null);
        } catch {}
      }
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleCompleted(lessonId: string) {
    const wasDone = this.completedSet().has(lessonId);
    const next = !wasDone;
    this.completedSet.update(s => {
      const ns = new Set(s);
      if (next) ns.add(lessonId); else ns.delete(lessonId);
      return ns;
    });
    try {
      await this.coursesSvc.setLessonCompleted(lessonId, next);
      try { await this.streakSvc.load(); } catch {}
    } catch (e: any) {
      this.error.set(e.message);
      this.completedSet.update(s => {
        const ns = new Set(s);
        if (wasDone) ns.add(lessonId); else ns.delete(lessonId);
        return ns;
      });
    }
  }

  async changeVisibility(v: CourseVisibility) {
    const c = this.course();
    if (!c || c.visibility === v) return;
    try {
      await this.coursesSvc.setVisibility(c.id, v);
      this.course.set({ ...c, visibility: v });
      this.savedVis.set(true);
      setTimeout(() => this.savedVis.set(false), 2000);
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {}
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
