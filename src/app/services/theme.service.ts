import { Injectable, signal } from '@angular/core';
import { Chart } from 'chart.js';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'control-gastos-theme';
  readonly isDarkMode = signal<boolean>(false);

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem(this.THEME_KEY);
    let prefersDark = false;
    if (!savedTheme) {
      prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    this.isDarkMode.set(isDark);
    this.applyTheme(isDark);
  }

  toggleDarkMode(): void {
    const newMode = !this.isDarkMode();
    this.isDarkMode.set(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.THEME_KEY, newMode ? 'dark' : 'light');
    }
    this.applyTheme(newMode);
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document === 'undefined') return;

    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';

    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    if (typeof Chart !== 'undefined' && Chart.instances) {
      Object.values(Chart.instances).forEach((chart: any) => {
        if (chart) {
          if (chart.options?.scales) {
            Object.values(chart.options.scales).forEach((scale: any) => {
              if (scale) {
                if (!scale.ticks) scale.ticks = {};
                scale.ticks.color = textColor;
              }
            });
          }
          if (chart.options?.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = textColor;
          }
          chart.update();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }
}
