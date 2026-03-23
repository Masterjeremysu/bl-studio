import { Theme } from '../types';

export function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  const resolved = theme === 'auto' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0A0B0F' : '#F5F3EE');
  }
}

export function loadTheme(): Theme {
  return (localStorage.getItem('bl_theme') as Theme) || 'auto';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem('bl_theme', theme);
}
