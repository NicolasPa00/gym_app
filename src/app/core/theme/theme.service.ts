import { Injectable, signal, computed, inject, PLATFORM_ID, effect, DestroyRef } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gym_theme';

/**
 * Tema claro / oscuro / sistema. Setea `data-theme` en <html> para activar
 * los tokens CSS definidos en _theme.scss.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly theme = signal<ThemeMode>('light');
  private readonly systemPref = signal<'light' | 'dark'>('light');

  readonly resolved = computed<'light' | 'dark'>(() =>
    this.theme() === 'system' ? this.systemPref() : (this.theme() as 'light' | 'dark')
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPref.set(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => this.systemPref.set(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.theme.set(saved);
    }

    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.resolved());
    });
  }

  toggle(): void {
    const next: ThemeMode = this.resolved() === 'light' ? 'dark' : 'light';
    this.set(next);
  }

  set(mode: ThemeMode): void {
    this.theme.set(mode);
    if (isPlatformBrowser(this.platformId)) localStorage.setItem(STORAGE_KEY, mode);
  }
}
