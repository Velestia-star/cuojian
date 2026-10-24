import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, resolveInitialTheme, toggleTheme } from './useTheme';

describe('初始主题（R: 跟随系统 / 记住选择）', () => {
  it('第一次进来跟随系统偏好', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
    expect(resolveInitialTheme(null, true)).toBe('dark');
  });

  it('用户选过就听用户的，不再看系统', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('存了脏数据当作没选过', () => {
    expect(resolveInitialTheme('', false)).toBe('light');
    expect(resolveInitialTheme('purple', true)).toBe('dark');
    expect(resolveInitialTheme('DARK', false)).toBe('light');
  });

  it('存储键名固定，改名会静默清空老用户的偏好', () => {
    expect(THEME_STORAGE_KEY).toBe('cuojian:theme');
  });
});

describe('切换', () => {
  it('两个方向都切得回来', () => {
    expect(toggleTheme('light')).toBe('dark');
    expect(toggleTheme('dark')).toBe('light');
    expect(toggleTheme(toggleTheme('light'))).toBe('light');
  });
});
