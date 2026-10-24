import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** 改名等于清空所有人的主题偏好，所以单独定个常量，测试里也锁住它。 */
export const THEME_STORAGE_KEY = 'cuojian:theme';

/** 浏览器地址栏/状态栏颜色，跟页面底色保持一致，避免切主题时上下两条边露馅 */
const THEME_COLOR: Record<Theme, string> = {
  light: '#f7f6f2',
  dark: '#121316',
};

/** 有记录就听记录；没记录或存了脏数据，才跟系统。 */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 隐私模式 / 禁用站点数据：读不到就跟随系统，不能让整个应用起不来
    return null;
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  if (applied === 'light' || applied === 'dark') return applied;
  return resolveInitialTheme(readStored(), systemPrefersDark());
}

// 模块加载即应用一次：抢在首帧渲染之前，深色用户不会先看到一屏白闪。
// 放在模块顶层是刻意的，别挪进 effect——那时已经画过一帧了。
if (typeof document !== 'undefined') {
  applyTheme(currentTheme());
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = toggleTheme(prev);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // 存不进去也能用，只是下次进来跟随系统
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
