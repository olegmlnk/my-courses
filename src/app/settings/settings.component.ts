import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container settings">
      <h1>Налаштування</h1>
      <p class="muted">Керуй своїм профілем, темою інтерфейсу та акаунтом.</p>

      <!-- Profile -->
      <section class="card panel">
        <header class="panel-head">
          <div>
            <h2>Профіль</h2>
            <p class="muted">Як тебе бачитимуть у додатку.</p>
          </div>
          @if (profileSaved()) { <span class="ok">✓ Збережено</span> }
        </header>

        <div class="profile-row">
          <div class="avatar-block">
            <div class="avatar-wrap">
              @if (avatarUrl) {
                <img [src]="avatarUrl" alt="avatar" class="avatar-lg" />
              } @else {
                <div class="avatar-lg fallback">{{ initials() }}</div>
              }
              @if (avatarUploading()) { <div class="avatar-overlay">…</div> }
            </div>

            <input #fileInput type="file" accept="image/*" hidden (change)="onAvatarFile($event)" />
            <div class="avatar-actions">
              <button type="button" class="btn btn-ghost btn-sm" (click)="fileInput.click()" [disabled]="avatarUploading()">
                {{ avatarUploading() ? 'Завантаження...' : 'Завантажити фото' }}
              </button>
              @if (avatarUrl) {
                <button type="button" class="btn btn-danger btn-sm" (click)="removeAvatar()" [disabled]="avatarUploading()">Прибрати</button>
              }
            </div>
            @if (avatarErr()) { <p class="err">{{ avatarErr() }}</p> }
            <p class="muted small">JPG / PNG / WEBP, до 5 МБ</p>
          </div>

          <div class="form-block">
            <label>Нікнейм</label>
            <input type="text" [(ngModel)]="nickname" placeholder="Ваше імʼя" maxlength="40" />

            <button class="btn btn-primary" (click)="saveProfile()" [disabled]="profileSaving()">
              {{ profileSaving() ? 'Збереження...' : 'Зберегти' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Theme -->
      <section class="card panel">
        <header class="panel-head">
          <div>
            <h2>Тема</h2>
            <p class="muted">Темна для вечорів, світла для ранків.</p>
          </div>
        </header>
        <div class="theme-grid">
          <button class="theme-card" [class.active]="theme.theme() === 'dark'" (click)="theme.set('dark')">
            <div class="preview dark-preview">
              <div class="dot1"></div><div class="dot2"></div><div class="bar1"></div><div class="bar2"></div>
            </div>
            <span>Темна</span>
          </button>
          <button class="theme-card" [class.active]="theme.theme() === 'light'" (click)="theme.set('light')">
            <div class="preview light-preview">
              <div class="dot1"></div><div class="dot2"></div><div class="bar1"></div><div class="bar2"></div>
            </div>
            <span>Світла</span>
          </button>
        </div>
      </section>

      <!-- Email -->
      <section class="card panel">
        <header class="panel-head">
          <div>
            <h2>Email</h2>
            <p class="muted">Поточний: <b>{{ currentEmail() }}</b></p>
          </div>
        </header>
        <div class="form-row">
          <input type="email" [(ngModel)]="newEmail" placeholder="Новий email" />
          <button class="btn btn-ghost" (click)="changeEmail()" [disabled]="emailSaving() || !newEmail">
            {{ emailSaving() ? '...' : 'Змінити' }}
          </button>
        </div>
        @if (emailMsg()) { <p class="ok">{{ emailMsg() }}</p> }
        @if (emailErr()) { <p class="err">{{ emailErr() }}</p> }
      </section>

      <!-- Password -->
      <section class="card panel">
        <header class="panel-head">
          <div>
            <h2>Пароль</h2>
            <p class="muted">Мінімум 6 символів.</p>
          </div>
        </header>
        <div class="form-row">
          <input type="password" [(ngModel)]="newPassword" placeholder="Новий пароль" />
          <button class="btn btn-ghost" (click)="changePassword()" [disabled]="passSaving() || newPassword.length < 6">
            {{ passSaving() ? '...' : 'Оновити' }}
          </button>
        </div>
        @if (passMsg()) { <p class="ok">{{ passMsg() }}</p> }
        @if (passErr()) { <p class="err">{{ passErr() }}</p> }
      </section>

      <!-- Danger zone -->
      <section class="card panel danger-panel">
        <header class="panel-head">
          <div>
            <h2 class="danger-title">Зона ризику</h2>
            <p class="muted">Видалення акаунту незворотне. Усі курси та уроки зникнуть.</p>
          </div>
        </header>

        @if (!confirmDelete()) {
          <button class="btn btn-danger" (click)="confirmDelete.set(true)">Видалити акаунт</button>
        } @else {
          <div class="confirm-block">
            <p>Підтверди: введи <b>{{ currentEmail() }}</b> і натисни «Видалити назавжди».</p>
            <input type="text" [(ngModel)]="deleteConfirmText" [placeholder]="currentEmail() ?? 'email'" />
            <div class="row">
              <button class="btn btn-danger" (click)="doDelete()" [disabled]="deleteConfirmText !== currentEmail() || deleting()">
                {{ deleting() ? 'Видалення...' : 'Видалити назавжди' }}
              </button>
              <button class="btn btn-ghost" (click)="cancelDelete()">Скасувати</button>
            </div>
            @if (deleteErr()) { <p class="err">{{ deleteErr() }}</p> }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .settings { max-width: 760px; }
    .panel { margin-top: 1.5rem; }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .panel h2 { margin: 0 0 .25rem; }
    .panel p { margin: 0; }

    .profile-row { display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: start; }
    .avatar-block { display: flex; flex-direction: column; gap: .5rem; align-items: center; }
    .avatar-wrap { position: relative; }
    .avatar-lg {
      width: 96px; height: 96px; border-radius: 50%;
      object-fit: cover; background: var(--bg-elev-2);
      border: 2px solid var(--border);
      display: block;
    }
    .avatar-lg.fallback {
      display: flex; align-items: center; justify-content: center;
      background: var(--accent); color: var(--accent-contrast);
      font-weight: 700; font-size: 2rem;
    }
    .avatar-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.5);
      border-radius: 50%;
      color: #fff; font-size: 1.5rem;
    }
    .avatar-actions { display: flex; gap: .35rem; }
    .small { font-size: .75rem; }
    .form-block { display: flex; flex-direction: column; gap: .5rem; }
    .form-block label { font-size: .85rem; color: var(--text-muted); }
    .form-block button { align-self: flex-start; margin-top: .5rem; }

    .theme-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; max-width: 360px; }
    .theme-card {
      background: var(--bg-elev-2);
      border: 2px solid var(--border);
      border-radius: var(--radius);
      padding: .75rem;
      cursor: pointer;
      display: flex; flex-direction: column; gap: .5rem;
      align-items: stretch;
      transition: border-color .15s;
    }
    .theme-card.active { border-color: var(--accent); }
    .theme-card:hover { border-color: var(--accent-hover); }
    .preview {
      height: 80px; border-radius: 6px; padding: .5rem;
      display: grid; grid-template-columns: 1fr 1fr; gap: .25rem;
    }
    .dark-preview { background: #0B0E11; }
    .light-preview { background: #F5F6FA; }
    .preview .dot1, .preview .dot2 { width: 12px; height: 12px; border-radius: 50%; }
    .dark-preview .dot1 { background: #F7A600; }
    .dark-preview .dot2 { background: #2B3139; }
    .light-preview .dot1 { background: #F7A600; }
    .light-preview .dot2 { background: #C9CDD3; }
    .preview .bar1, .preview .bar2 { height: 6px; border-radius: 3px; grid-column: span 2; }
    .dark-preview .bar1 { background: #2B3139; }
    .dark-preview .bar2 { background: #1E2329; width: 60%; }
    .light-preview .bar1 { background: #C9CDD3; }
    .light-preview .bar2 { background: #E6E8EC; width: 60%; }
    .theme-card span { font-weight: 600; text-align: center; }

    .form-row { display: flex; gap: .5rem; }
    .form-row input { flex: 1; }

    .danger-panel { border-color: var(--danger); }
    .danger-title { color: var(--danger); }
    .confirm-block { display: flex; flex-direction: column; gap: .75rem; }

    @media (max-width: 600px) {
      .profile-row { grid-template-columns: 1fr; }
      .form-row { flex-direction: column; }
    }
  `]
})
export class SettingsComponent implements OnInit {
  nickname = '';
  avatarUrl = '';
  newEmail = '';
  newPassword = '';
  deleteConfirmText = '';

  profileSaving = signal(false);
  profileSaved = signal(false);
  avatarUploading = signal(false);
  avatarErr = signal<string | null>(null);
  emailSaving = signal(false);
  emailMsg = signal<string | null>(null);
  emailErr = signal<string | null>(null);
  passSaving = signal(false);
  passMsg = signal<string | null>(null);
  passErr = signal<string | null>(null);
  confirmDelete = signal(false);
  deleting = signal(false);
  deleteErr = signal<string | null>(null);

  currentEmail = computed(() => this.auth.user()?.email ?? null);
  initials = computed(() => (this.nickname[0] ?? this.currentEmail()?.[0] ?? '?').toUpperCase());

  constructor(
    public auth: AuthService,
    public profile: ProfileService,
    public theme: ThemeService,
    private router: Router
  ) {}

  async ngOnInit() {
    let p = this.profile.profile();
    if (!p) { try { p = await this.profile.load(); } catch {} }
    if (p) {
      this.nickname = p.nickname ?? '';
      this.avatarUrl = p.avatar_url ?? '';
    }
  }

  async onAvatarFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarErr.set(null);
    this.avatarUploading.set(true);
    try {
      const url = await this.profile.uploadAvatar(file);
      this.avatarUrl = url;
    } catch (e: any) {
      this.avatarErr.set(e.message);
    } finally {
      this.avatarUploading.set(false);
    }
  }

  async removeAvatar() {
    this.avatarErr.set(null);
    this.avatarUploading.set(true);
    try {
      await this.profile.update({ avatar_url: null });
      this.avatarUrl = '';
    } catch (e: any) {
      this.avatarErr.set(e.message);
    } finally {
      this.avatarUploading.set(false);
    }
  }

  async saveProfile() {
    this.profileSaving.set(true);
    this.profileSaved.set(false);
    try {
      await this.profile.update({
        nickname: this.nickname.trim() || null,
        avatar_url: this.avatarUrl.trim() || null
      });
      this.profileSaved.set(true);
      setTimeout(() => this.profileSaved.set(false), 2500);
    } finally {
      this.profileSaving.set(false);
    }
  }

  async changeEmail() {
    this.emailSaving.set(true);
    this.emailMsg.set(null);
    this.emailErr.set(null);
    try {
      const { error } = await this.profile.updateEmail(this.newEmail.trim());
      if (error) throw error;
      this.emailMsg.set('Лист підтвердження надіслано на нову адресу.');
      this.newEmail = '';
    } catch (e: any) {
      this.emailErr.set(e.message);
    } finally {
      this.emailSaving.set(false);
    }
  }

  async changePassword() {
    this.passSaving.set(true);
    this.passMsg.set(null);
    this.passErr.set(null);
    try {
      const { error } = await this.profile.updatePassword(this.newPassword);
      if (error) throw error;
      this.passMsg.set('Пароль оновлено.');
      this.newPassword = '';
    } catch (e: any) {
      this.passErr.set(e.message);
    } finally {
      this.passSaving.set(false);
    }
  }

  cancelDelete() {
    this.confirmDelete.set(false);
    this.deleteConfirmText = '';
    this.deleteErr.set(null);
  }

  async doDelete() {
    this.deleting.set(true);
    this.deleteErr.set(null);
    try {
      await this.profile.deleteAccount();
      this.router.navigate(['/login']);
    } catch (e: any) {
      this.deleteErr.set(e.message);
      this.deleting.set(false);
    }
  }
}
