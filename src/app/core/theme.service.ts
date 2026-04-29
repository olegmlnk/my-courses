import { Injectable, signal, effect } from '@angular/core';

type Theme = 'dark' | 'light';
const KEY = 'mc-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.read());
  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem(KEY, t);
    });
  }

  set(theme: Theme) { this._theme.set(theme); }
  toggle() { this._theme.update(t => (t === 'dark' ? 'light' : 'dark')); }

  private read(): Theme {
    const stored = localStorage.getItem(KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
