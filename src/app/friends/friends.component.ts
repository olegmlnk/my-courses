import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FriendsService } from '../core/friends.service';
import { UserSearchResult } from '../core/models';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="container friends">
      <header class="page-head">
        <div>
          <h1>Друзі</h1>
          <p class="muted">Знаходь людей за нікнеймом або email — і ділись курсами зі статусом «Лише для друзів».</p>
        </div>
      </header>

      <section class="card panel">
        <h2>Пошук</h2>
        <div class="search-row">
          <input
            type="text"
            [(ngModel)]="query"
            (ngModelChange)="onQueryChange($event)"
            placeholder="Нікнейм або email (мінімум 2 символи)"
          />
          @if (searching()) { <span class="muted small">Шукаю...</span> }
        </div>

        @if (searchError()) { <p class="err">{{ searchError() }}</p> }

        @if (results().length > 0) {
          <ul class="results">
            @for (u of results(); track u.id) {
              <li class="result-row">
                <div class="user">
                  @if (u.avatar_url) {
                    <img [src]="u.avatar_url" alt="" />
                  } @else {
                    <span class="avatar-fallback">{{ initial(u) }}</span>
                  }
                  <div class="user-info">
                    <strong>{{ u.nickname || 'Без імені' }}</strong>
                    <span class="muted small">{{ u.matched_by === 'email' ? 'збіг по email' : 'збіг по нікнейму' }}</span>
                  </div>
                </div>
                <button
                  class="btn btn-primary btn-sm"
                  [disabled]="addingId() === u.id || isAlreadyConnected(u.id)"
                  (click)="add(u)"
                >
                  {{ buttonLabel(u.id) }}
                </button>
              </li>
            }
          </ul>
        } @else if (query.length >= 2 && !searching()) {
          <p class="muted small">Нікого не знайдено</p>
        }
      </section>

      @if (incoming().length > 0) {
        <section class="card panel">
          <h2>Вхідні заявки <span class="count">{{ incoming().length }}</span></h2>
          <ul class="results">
            @for (e of incoming(); track e.friendship_id) {
              <li class="result-row">
                <div class="user">
                  @if (e.user.avatar_url) {
                    <img [src]="e.user.avatar_url" alt="" />
                  } @else {
                    <span class="avatar-fallback">{{ (e.user.nickname?.[0] ?? '?').toUpperCase() }}</span>
                  }
                  <div class="user-info">
                    <strong>{{ e.user.nickname || 'Без імені' }}</strong>
                    <span class="muted small">хоче додати тебе</span>
                  </div>
                </div>
                <div class="row">
                  <button class="btn btn-primary btn-sm" (click)="accept(e.friendship_id)">Прийняти</button>
                  <button class="btn btn-ghost btn-sm" (click)="reject(e.friendship_id)">Відхилити</button>
                </div>
              </li>
            }
          </ul>
        </section>
      }

      @if (outgoing().length > 0) {
        <section class="card panel">
          <h2>Вихідні заявки <span class="count">{{ outgoing().length }}</span></h2>
          <ul class="results">
            @for (e of outgoing(); track e.friendship_id) {
              <li class="result-row">
                <div class="user">
                  @if (e.user.avatar_url) {
                    <img [src]="e.user.avatar_url" alt="" />
                  } @else {
                    <span class="avatar-fallback">{{ (e.user.nickname?.[0] ?? '?').toUpperCase() }}</span>
                  }
                  <div class="user-info">
                    <strong>{{ e.user.nickname || 'Без імені' }}</strong>
                    <span class="muted small">очікує підтвердження</span>
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" (click)="cancel(e.friendship_id)">Скасувати</button>
              </li>
            }
          </ul>
        </section>
      }

      <section class="card panel">
        <h2>Мої друзі <span class="count">{{ friends().length }}</span></h2>
        @if (friends().length === 0) {
          <p class="muted">Поки порожньо. Знайди когось у пошуку вище.</p>
        } @else {
          <ul class="results">
            @for (e of friends(); track e.friendship_id) {
              <li class="result-row">
                <div class="user">
                  @if (e.user.avatar_url) {
                    <img [src]="e.user.avatar_url" alt="" />
                  } @else {
                    <span class="avatar-fallback">{{ (e.user.nickname?.[0] ?? '?').toUpperCase() }}</span>
                  }
                  <div class="user-info">
                    <strong>{{ e.user.nickname || 'Без імені' }}</strong>
                    <span class="muted small">друзі з {{ e.created_at | date:'mediumDate' }}</span>
                  </div>
                </div>
                <button class="btn btn-danger btn-sm" (click)="remove(e.friendship_id)">Видалити</button>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    .friends { max-width: 760px; }
    .page-head { padding: 1rem 0 1.5rem; }
    .page-head p { margin: .25rem 0 0; }
    .panel { margin-top: 1.25rem; }
    .panel h2 { display: flex; align-items: center; gap: .5rem; margin: 0 0 1rem; font-size: 1.1rem; }
    .count {
      background: var(--bg-elev-3); color: var(--text);
      font-size: .75rem; padding: .15rem .5rem; border-radius: 99px; font-weight: 600;
    }
    .search-row { display: flex; align-items: center; gap: .75rem; }
    .search-row input { flex: 1; }
    .results { list-style: none; padding: 0; margin: .75rem 0 0; display: flex; flex-direction: column; gap: .5rem; }
    .result-row {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: .75rem; background: var(--bg-elev-2);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .user { display: flex; align-items: center; gap: .75rem; min-width: 0; }
    .user img, .avatar-fallback {
      width: 40px; height: 40px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0;
    }
    .avatar-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--accent); color: var(--accent-contrast);
      font-weight: 700;
    }
    .user-info { display: flex; flex-direction: column; min-width: 0; }
    .user-info strong { color: var(--text); }
    .small { font-size: .75rem; }
    @media (max-width: 600px) {
      .result-row { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class FriendsComponent implements OnInit {
  public friendsSvc = inject(FriendsService);

  query = '';
  results = signal<UserSearchResult[]>([]);
  searching = signal(false);
  searchError = signal<string | null>(null);
  addingId = signal<string | null>(null);

  friends = this.friendsSvc.friends;
  incoming = this.friendsSvc.incoming;
  outgoing = this.friendsSvc.outgoing;

  private debounce: any = null;

  async ngOnInit() {
    try { await this.friendsSvc.loadAll(); } catch {}
  }

  initial(u: UserSearchResult): string {
    return (u.nickname?.[0] ?? '?').toUpperCase();
  }

  isAlreadyConnected(userId: string): boolean {
    return this.friends().some(f => f.user.id === userId)
      || this.outgoing().some(f => f.user.id === userId)
      || this.incoming().some(f => f.user.id === userId);
  }

  buttonLabel(userId: string): string {
    if (this.addingId() === userId) return '...';
    if (this.friends().some(f => f.user.id === userId)) return 'Уже друг';
    if (this.outgoing().some(f => f.user.id === userId)) return 'Заявку надіслано';
    if (this.incoming().some(f => f.user.id === userId)) return 'Чекає твоєї відповіді';
    return '+ Додати';
  }

  onQueryChange(value: string) {
    this.query = value;
    clearTimeout(this.debounce);
    if (value.trim().length < 2) {
      this.results.set([]);
      this.searchError.set(null);
      return;
    }
    this.debounce = setTimeout(() => this.runSearch(), 300);
  }

  async runSearch() {
    this.searching.set(true);
    this.searchError.set(null);
    try {
      const r = await this.friendsSvc.search(this.query);
      this.results.set(r);
    } catch (e: any) {
      this.searchError.set(e.message);
    } finally {
      this.searching.set(false);
    }
  }

  async add(u: UserSearchResult) {
    this.addingId.set(u.id);
    this.searchError.set(null);
    try {
      await this.friendsSvc.sendRequest(u.id);
    } catch (e: any) {
      this.searchError.set(e.message);
    } finally {
      this.addingId.set(null);
    }
  }

  async accept(id: string) {
    try { await this.friendsSvc.accept(id); } catch (e: any) { this.searchError.set(e.message); }
  }

  async reject(id: string) {
    try { await this.friendsSvc.reject(id); } catch (e: any) { this.searchError.set(e.message); }
  }

  async cancel(id: string) {
    try { await this.friendsSvc.remove(id); } catch (e: any) { this.searchError.set(e.message); }
  }

  async remove(id: string) {
    if (!confirm('Видалити з друзів?')) return;
    try { await this.friendsSvc.remove(id); } catch (e: any) { this.searchError.set(e.message); }
  }
}
